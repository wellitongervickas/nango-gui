import type {
  AiBuilderRunRequest,
  AiBuilderRunResult,
  AiBuilderToolCallEvent,
  AiBuilderMessageEvent,
  AiCanvasSnapshot,
} from "@nango-gui/shared";
import { credentialStore } from "./credential-store.js";
import log from "./logger.js";

const MAX_TOOL_TURNS = 15;

// ── Canvas tool definitions ───────────────────────────────────────────────

interface CanvasToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const CANVAS_TOOLS: CanvasToolDef[] = [
  {
    name: "addNode",
    description:
      "Add a node to the integration canvas. Supported types: sync, action, webhook, model, on-event.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["sync", "action", "webhook", "model", "on-event"],
          description: "The type of node to add.",
        },
        config: {
          type: "object",
          description:
            "Node configuration. For sync/action: { name, endpoint?, description? }. For model: { name, fields: [{ name, type }] }. For webhook: { name }. For on-event: { name, event }.",
        },
      },
      required: ["type", "config"],
    },
  },
  {
    name: "addEdge",
    description: "Connect two nodes on the canvas with an edge.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Source node ID." },
        to: { type: "string", description: "Target node ID." },
        mapping: {
          type: "object",
          description: "Optional field mappings between the nodes.",
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "setIntegrationMeta",
    description: "Set integration metadata (name, provider, description).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Integration name." },
        provider: {
          type: "string",
          description: 'Nango provider key (e.g. "github", "slack").',
        },
        description: {
          type: "string",
          description: "Human-readable integration description.",
        },
      },
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────

interface ToolContext {
  createdNodeIds: string[];
  integrationMeta: { name?: string; provider?: string; description?: string };
  nodeCounter: number;
}

function executeCanvasTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
  ctx: ToolContext,
): unknown {
  switch (toolName) {
    case "addNode": {
      const nodeType = String(toolArgs.type ?? "action");
      const config = (toolArgs.config ?? {}) as Record<string, unknown>;
      const nodeId = `${nodeType}-${Date.now()}-${ctx.nodeCounter++}`;
      ctx.createdNodeIds.push(nodeId);
      return {
        nodeId,
        type: nodeType,
        config,
        message: `Node "${config.name ?? nodeId}" added.`,
      };
    }
    case "addEdge": {
      const from = String(toolArgs.from ?? "");
      const to = String(toolArgs.to ?? "");
      if (!ctx.createdNodeIds.includes(from) && !from.includes("-")) {
        return { error: `Source node "${from}" not found in this session.` };
      }
      if (!ctx.createdNodeIds.includes(to) && !to.includes("-")) {
        return { error: `Target node "${to}" not found in this session.` };
      }
      return {
        from,
        to,
        mapping: toolArgs.mapping ?? null,
        message: `Edge from "${from}" to "${to}" added.`,
      };
    }
    case "setIntegrationMeta": {
      if (toolArgs.name) ctx.integrationMeta.name = String(toolArgs.name);
      if (toolArgs.provider)
        ctx.integrationMeta.provider = String(toolArgs.provider);
      if (toolArgs.description)
        ctx.integrationMeta.description = String(toolArgs.description);
      return { ...ctx.integrationMeta, message: "Integration metadata updated." };
    }
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ── System prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(snapshot?: AiCanvasSnapshot): string {
  let prompt =
    "You are an integration builder assistant for Nango. " +
    "You help users design integration flows by adding nodes and edges to a visual canvas. " +
    "Use the provided tools to add sync, action, webhook, model, and on-event nodes, " +
    "connect them with edges, and set integration metadata.\n\n" +
    "Available node types:\n" +
    "- sync: Scheduled data reads from an external API\n" +
    "- action: On-demand operations (create, update, delete)\n" +
    "- webhook: Incoming webhook event handlers\n" +
    "- model: Data model definitions with typed fields\n" +
    "- on-event: Lifecycle hooks (connection created/deleted)\n\n" +
    "When the user describes an integration, plan the nodes and edges needed, " +
    "then use the tools to build it step by step. Always set integration metadata " +
    "with setIntegrationMeta. After building, provide a brief summary of what you created.";

  if (snapshot && (snapshot.nodes.length > 0 || snapshot.edges.length > 0)) {
    prompt +=
      "\n\nCurrent canvas state:\n" + JSON.stringify(snapshot, null, 2);
  }

  return prompt;
}

// ── OpenAI tool-calling loop ──────────────────────────────────────────────

async function runOpenAi(
  request: AiBuilderRunRequest,
  onToolCall: (event: AiBuilderToolCallEvent) => void,
  onMessage: (event: AiBuilderMessageEvent) => void,
): Promise<AiBuilderRunResult> {
  const apiKey = credentialStore.loadAiProviderKey("openai");
  if (!apiKey) {
    throw Object.assign(
      new Error("OpenAI API key not configured. Add it in Settings → AI Providers."),
      { status: 401 },
    );
  }

  const tools = CANVAS_TOOLS.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: buildSystemPrompt(request.canvasSnapshot) },
  ];

  if (request.conversationHistory) {
    for (const turn of request.conversationHistory) {
      messages.push({ role: turn.role, content: turn.content });
    }
  }
  messages.push({ role: "user", content: request.prompt });

  const ctx: ToolContext = {
    createdNodeIds: [],
    integrationMeta: {},
    nodeCounter: 0,
  };
  const allToolCalls: AiBuilderToolCallEvent[] = [];
  let turnsUsed = 0;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    turnsUsed++;
    log.info(`[AIBuilder] OpenAI turn ${turn + 1}`);

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
      log.error(`[AIBuilder] OpenAI ${response.status}: ${body}`);
      throw Object.assign(
        new Error(`OpenAI API error: ${response.status} ${response.statusText}`),
        { status: response.status },
      );
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          role: string;
          content: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
    };

    const choice = data.choices[0];
    const msg = choice.message;

    // Append assistant message to context
    messages.push(msg);

    // Process tool calls
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }

        const result = executeCanvasTool(tc.function.name, args, ctx);
        const event: AiBuilderToolCallEvent = {
          tool: tc.function.name,
          args,
          result,
        };
        allToolCalls.push(event);
        onToolCall(event);

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    // No tool calls — final text response
    const text = msg.content ?? "";
    onMessage({ text, done: true });
    return { toolCalls: allToolCalls, summary: text, turnsUsed };
  }

  onMessage({ text: "Reached maximum tool-calling turns.", done: true });
  return {
    toolCalls: allToolCalls,
    summary: "Reached maximum tool-calling turns.",
    turnsUsed,
  };
}

// ── Anthropic tool-calling loop ───────────────────────────────────────────

async function runAnthropic(
  request: AiBuilderRunRequest,
  onToolCall: (event: AiBuilderToolCallEvent) => void,
  onMessage: (event: AiBuilderMessageEvent) => void,
): Promise<AiBuilderRunResult> {
  const apiKey = credentialStore.loadAiProviderKey("anthropic");
  if (!apiKey) {
    throw Object.assign(
      new Error(
        "Anthropic API key not configured. Add it in Settings → AI Providers.",
      ),
      { status: 401 },
    );
  }

  const tools = CANVAS_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  const messages: Array<Record<string, unknown>> = [];

  if (request.conversationHistory) {
    for (const turn of request.conversationHistory) {
      messages.push({ role: turn.role, content: turn.content });
    }
  }
  messages.push({ role: "user", content: request.prompt });

  const ctx: ToolContext = {
    createdNodeIds: [],
    integrationMeta: {},
    nodeCounter: 0,
  };
  const allToolCalls: AiBuilderToolCallEvent[] = [];
  let turnsUsed = 0;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    turnsUsed++;
    log.info(`[AIBuilder] Anthropic turn ${turn + 1}`);

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
        system: buildSystemPrompt(request.canvasSnapshot),
        messages,
        tools,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      log.error(`[AIBuilder] Anthropic ${response.status}: ${body}`);
      throw Object.assign(
        new Error(
          `Anthropic API error: ${response.status} ${response.statusText}`,
        ),
        { status: response.status },
      );
    }

    const data = (await response.json()) as {
      content: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      >;
      stop_reason: string;
    };

    // Build assistant message content for conversation context
    messages.push({ role: "assistant", content: data.content });

    const toolUseBlocks = data.content.filter(
      (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        b.type === "tool_use",
    );

    if (toolUseBlocks.length > 0) {
      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }> = [];

      for (const block of toolUseBlocks) {
        const result = executeCanvasTool(block.name, block.input, ctx);
        const event: AiBuilderToolCallEvent = {
          tool: block.name,
          args: block.input,
          result,
        };
        allToolCalls.push(event);
        onToolCall(event);

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // No tool use — extract final text
    const textBlocks = data.content.filter(
      (b): b is { type: "text"; text: string } => b.type === "text",
    );
    const text = textBlocks.map((b) => b.text).join("\n") || "";
    onMessage({ text, done: true });
    return { toolCalls: allToolCalls, summary: text, turnsUsed };
  }

  onMessage({ text: "Reached maximum tool-calling turns.", done: true });
  return {
    toolCalls: allToolCalls,
    summary: "Reached maximum tool-calling turns.",
    turnsUsed,
  };
}

// ── Public entry point ────────────────────────────────────────────────────

export async function runAiBuilder(
  request: AiBuilderRunRequest,
  onToolCall: (event: AiBuilderToolCallEvent) => void,
  onMessage: (event: AiBuilderMessageEvent) => void,
): Promise<AiBuilderRunResult> {
  log.info(`[AIBuilder] Starting run with provider=${request.aiProvider}`);

  if (request.aiProvider === "openai") {
    return runOpenAi(request, onToolCall, onMessage);
  }
  return runAnthropic(request, onToolCall, onMessage);
}
