/**
 * Provider-agnostic AI Integration Builder service.
 *
 * Dispatches to OpenAI (GPT-4o) or Anthropic (Claude) with function-calling
 * tools that manipulate the canvas. The AI reasons about the user's prompt
 * and iteratively calls addNode, addEdge, setIntegrationMeta, and
 * getAvailableProviders to build an integration on the canvas.
 */
import type {
  AiProviderType,
  AiBuilderRunRequest,
  AiBuilderRunResult,
  AiBuilderToolCallEvent,
  AiCanvasSnapshot,
  NangoProvider,
} from "@nango-gui/shared";
import { credentialStore } from "./credential-store.js";
import log from "./logger.js";

const MAX_TURNS = 10;

// ── Tool definitions ────────────────────────────────────────────────────────

/** JSON Schema definitions for tools the AI can call against the canvas. */
const CANVAS_TOOLS = [
  {
    name: "addNode",
    description:
      "Add a node to the integration canvas. Supported types: sync, action, webhook, model, trigger, transform.",
    parameters: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["sync", "action", "webhook", "model", "trigger", "transform"],
          description: "The node type to add.",
        },
        config: {
          type: "object",
          description:
            "Node configuration. For sync: {label, description, frequency, endpoint, method, modelRef}. " +
            "For action: {label, description, endpoint, method, inputModelRef, outputModelRef}. " +
            "For model: {label, fields: [{name, type, optional}]}. " +
            "For webhook: {label, description, endpoint, method, modelRef}. " +
            "For trigger: {label, description, frequency, modelRef}. " +
            "For transform: {label, description, inputModelRef, outputModelRef, mappings: [{sourceField, targetField, transform}]}.",
          additionalProperties: true,
        },
      },
      required: ["type", "config"],
    },
  },
  {
    name: "addEdge",
    description:
      "Connect two nodes on the canvas with an edge. Optionally include field mappings for transform edges.",
    parameters: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Source node ID.",
        },
        to: {
          type: "string",
          description: "Target node ID.",
        },
        mapping: {
          type: "object",
          description:
            "Optional field mapping for transform edges. {mappings: [{sourceField, targetField, transform}]}.",
          additionalProperties: true,
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "setIntegrationMeta",
    description:
      "Set top-level integration properties (name, provider, description).",
    parameters: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Integration name.",
        },
        provider: {
          type: "string",
          description: "Integration provider key (e.g. 'github', 'slack').",
        },
        description: {
          type: "string",
          description: "Human-readable description of the integration.",
        },
      },
      required: ["name", "provider", "description"],
    },
  },
  {
    name: "getAvailableProviders",
    description:
      "Retrieve the list of available Nango integration providers. Use this to discover which providers are available before building an integration.",
    parameters: {
      type: "object" as const,
      properties: {
        search: {
          type: "string",
          description: "Optional search term to filter providers by name.",
        },
      },
    },
  },
] as const;

// ── System prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(snapshot?: AiCanvasSnapshot): string {
  let prompt =
    "You are an AI integration builder for Nango. " +
    "Users describe integrations in plain English, and you build them by calling tools that manipulate a visual canvas.\n\n" +
    "Available tools:\n" +
    "- addNode(type, config): Add a sync, action, webhook, model, trigger, or transform node to the canvas.\n" +
    "- addEdge(from, to, mapping?): Connect two nodes. Use node IDs returned by addNode.\n" +
    "- setIntegrationMeta(name, provider, description): Set the integration name, provider, and description.\n" +
    "- getAvailableProviders(search?): Look up available Nango providers.\n\n" +
    "Guidelines:\n" +
    "1. Always call setIntegrationMeta first to establish the integration identity.\n" +
    "2. Create model nodes before sync/action nodes that reference them.\n" +
    "3. Connect syncs/actions to their output models with addEdge.\n" +
    "4. Use descriptive labels and descriptions.\n" +
    "5. For syncs, set frequency (e.g. 'every 1h'), endpoint, and method.\n" +
    "6. For actions, set endpoint, method, input/output model refs.\n" +
    "7. If unsure about the provider, call getAvailableProviders to discover options.\n" +
    "8. After building, summarize what you created.\n";

  if (snapshot && snapshot.nodes.length > 0) {
    prompt +=
      "\nCurrent canvas state:\n" +
      "Nodes: " +
      JSON.stringify(snapshot.nodes) +
      "\n" +
      "Edges: " +
      JSON.stringify(snapshot.edges) +
      "\n";
    if (snapshot.integrationMeta) {
      prompt +=
        "Integration: " + JSON.stringify(snapshot.integrationMeta) + "\n";
    }
    prompt +=
      "\nBuild upon the existing canvas. Do not recreate nodes that already exist.\n";
  }

  return prompt;
}

// ── Provider dispatch ───────────────────────────────────────────────────────

/**
 * Run the AI builder conversation loop.
 *
 * @param request       The builder run request from the renderer.
 * @param onToolCall    Callback invoked each time the AI calls a canvas tool (for streaming to renderer).
 * @param onMessage     Callback invoked when the AI sends a text message.
 * @param listProviders Function to fetch available Nango providers (injected from IPC context).
 */
export async function runAiBuilder(
  request: AiBuilderRunRequest,
  onToolCall: (event: AiBuilderToolCallEvent) => void,
  onMessage: (text: string, done: boolean) => void,
  listProviders: (search?: string) => Promise<NangoProvider[]>,
): Promise<AiBuilderRunResult> {
  const apiKey = credentialStore.loadAiProviderKey(request.aiProvider);
  if (!apiKey) {
    throw Object.assign(
      new Error(
        `No API key configured for ${request.aiProvider}. Please add your ${request.aiProvider === "openai" ? "OpenAI" : "Anthropic"} API key in Settings.`,
      ),
      { status: 401 },
    );
  }

  const systemPrompt = buildSystemPrompt(request.canvasSnapshot);
  const toolCalls: AiBuilderToolCallEvent[] = [];

  // Track node IDs created during this session for addEdge resolution
  const createdNodeIds: string[] = [];
  let nodeCounter = 0;

  /** Execute a tool call from the AI and return the result. */
  async function executeTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case "addNode": {
        const nodeType = args.type as string;
        const config = args.config as Record<string, unknown>;
        const nodeId = `${nodeType}-${Date.now()}-${nodeCounter++}`;
        const result = { nodeId, type: nodeType, config };
        createdNodeIds.push(nodeId);
        return result;
      }
      case "addEdge": {
        const from = args.from as string;
        const to = args.to as string;
        const mapping = args.mapping as Record<string, unknown> | undefined;
        return { edgeId: `edge-${from}-${to}`, from, to, mapping };
      }
      case "setIntegrationMeta": {
        return {
          name: args.name,
          provider: args.provider,
          description: args.description,
        };
      }
      case "getAvailableProviders": {
        const search = args.search as string | undefined;
        const providers = await listProviders(search);
        // Return a trimmed list to save tokens
        return providers.slice(0, 20).map((p) => ({
          name: p.name,
          display_name: p.display_name,
          auth_mode: p.auth_mode,
          categories: p.categories,
        }));
      }
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  if (request.aiProvider === "openai") {
    return runOpenAiLoop(
      apiKey,
      systemPrompt,
      request,
      executeTool,
      onToolCall,
      onMessage,
      toolCalls,
    );
  }
  return runAnthropicLoop(
    apiKey,
    systemPrompt,
    request,
    executeTool,
    onToolCall,
    onMessage,
    toolCalls,
  );
}

// ── OpenAI provider ─────────────────────────────────────────────────────────

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

interface OpenAiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

async function runOpenAiLoop(
  apiKey: string,
  systemPrompt: string,
  request: AiBuilderRunRequest,
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  onToolCall: (event: AiBuilderToolCallEvent) => void,
  onMessage: (text: string, done: boolean) => void,
  toolCalls: AiBuilderToolCallEvent[],
): Promise<AiBuilderRunResult> {
  const messages: OpenAiMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history
  if (request.conversationHistory) {
    for (const turn of request.conversationHistory) {
      messages.push({ role: turn.role as "user" | "assistant", content: turn.content });
    }
  }

  // Add current user prompt
  messages.push({ role: "user", content: request.prompt });

  const tools = CANVAS_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  let turnsUsed = 0;
  let summary = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    turnsUsed++;
    log.info(`[AI Builder] OpenAI turn ${turn + 1}/${MAX_TURNS}`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      log.error(`[AI Builder] OpenAI ${response.status}: ${body}`);
      throw Object.assign(
        new Error(`OpenAI API error: ${response.status} ${response.statusText}`),
        { status: response.status },
      );
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: OpenAiMessage;
        finish_reason: string;
      }>;
    };

    const choice = data.choices[0];
    const assistantMsg = choice.message;
    messages.push(assistantMsg);

    // If the model wants to call tools
    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      for (const tc of assistantMsg.tool_calls) {
        const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        const result = await executeTool(tc.function.name, args);
        const event: AiBuilderToolCallEvent = {
          tool: tc.function.name,
          args,
          result,
        };
        toolCalls.push(event);
        onToolCall(event);

        // Push tool result back into conversation
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      continue; // Let the model process tool results
    }

    // Model returned a text response — conversation is done
    summary = assistantMsg.content ?? "";
    onMessage(summary, true);
    break;
  }

  return { toolCalls, summary, turnsUsed };
}

// ── Anthropic provider ──────────────────────────────────────────────────────

interface AnthropicMessage {
  role: "user" | "assistant";
  content: AnthropicContent[];
}

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

async function runAnthropicLoop(
  apiKey: string,
  systemPrompt: string,
  request: AiBuilderRunRequest,
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  onToolCall: (event: AiBuilderToolCallEvent) => void,
  onMessage: (text: string, done: boolean) => void,
  toolCalls: AiBuilderToolCallEvent[],
): Promise<AiBuilderRunResult> {
  const messages: AnthropicMessage[] = [];

  // Add conversation history
  if (request.conversationHistory) {
    for (const turn of request.conversationHistory) {
      messages.push({
        role: turn.role as "user" | "assistant",
        content: [{ type: "text", text: turn.content }],
      });
    }
  }

  // Add current user prompt
  messages.push({
    role: "user",
    content: [{ type: "text", text: request.prompt }],
  });

  const tools = CANVAS_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  let turnsUsed = 0;
  let summary = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    turnsUsed++;
    log.info(`[AI Builder] Anthropic turn ${turn + 1}/${MAX_TURNS}`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      log.error(`[AI Builder] Anthropic ${response.status}: ${body}`);
      throw Object.assign(
        new Error(`Anthropic API error: ${response.status} ${response.statusText}`),
        { status: response.status },
      );
    }

    const data = (await response.json()) as {
      content: AnthropicContent[];
      stop_reason: string;
    };

    // Add assistant response to conversation
    messages.push({ role: "assistant", content: data.content });

    // Check if AI wants to use tools
    const toolUseBlocks = data.content.filter(
      (b): b is Extract<AnthropicContent, { type: "tool_use" }> =>
        b.type === "tool_use",
    );

    if (toolUseBlocks.length > 0) {
      const toolResults: AnthropicContent[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input);
        const event: AiBuilderToolCallEvent = {
          tool: toolUse.name,
          args: toolUse.input,
          result,
        };
        toolCalls.push(event);
        onToolCall(event);

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Push tool results back as a user message
      messages.push({ role: "user", content: toolResults });
      continue; // Let the model process tool results
    }

    // Extract text blocks as summary
    const textBlocks = data.content.filter(
      (b): b is Extract<AnthropicContent, { type: "text" }> =>
        b.type === "text",
    );
    summary = textBlocks.map((b) => b.text).join("\n");
    onMessage(summary, true);
    break;
  }

  return { toolCalls, summary, turnsUsed };
}
