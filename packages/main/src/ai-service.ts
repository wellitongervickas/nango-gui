import type {
  AiConversationTurn,
  AiGenerateRequest,
  AiRefineRequest,
  AiGenerationResult,
} from "@nango-gui/shared";
import { credentialStore } from "./credential-store.js";
import { rateLimitTracker } from "./rate-limit-tracker.js";
import log from "./logger.js";

const NANGO_API_BASE = "https://api.nango.dev";
const MAX_CONVERSATION_TURNS = 10;

/**
 * Wraps Nango AI HTTP calls for integration generation and refinement.
 * Uses raw `fetch()` since the Nango SDK does not expose AI endpoints.
 */
export const aiService = {
  /**
   * Generate a new integration from a plain-English prompt.
   */
  async generate(args: AiGenerateRequest): Promise<AiGenerationResult> {
    const history = trimHistory(args.conversationHistory);

    const body = {
      provider: args.provider,
      prompt: args.prompt,
      ...(history.length > 0 ? { conversationHistory: history } : {}),
    };

    const data = await nangoAiFetch("/ai/generate", body);
    return parseGenerationResult(data);
  },

  /**
   * Refine an existing generated integration with a follow-up prompt.
   */
  async refine(args: AiRefineRequest): Promise<AiGenerationResult> {
    const history = trimHistory(args.conversationHistory);

    const body = {
      provider: args.provider,
      prompt: args.prompt,
      conversationHistory: history,
      currentDefinition: args.currentDefinition,
    };

    const data = await nangoAiFetch("/ai/refine", body);
    return parseGenerationResult(data);
  },
};

// ── Internal helpers ────────────────────────────────────────────────────────

async function nangoAiFetch(path: string, body: unknown): Promise<unknown> {
  const secretKey = credentialStore.load();
  if (!secretKey) {
    throw Object.assign(
      new Error("Nango API key not configured. Please set your secret key in Settings."),
      { status: 401 }
    );
  }

  const url = `${NANGO_API_BASE}${path}`;
  log.info(`[AI] POST ${path}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secretKey}`,
    },
    body: JSON.stringify(body),
  });

  // Capture rate-limit headers from the AI endpoint
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  rateLimitTracker.observe("nango-ai", headers);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    log.error(`[AI] ${response.status} ${response.statusText}: ${errorBody}`);

    if (response.status === 429) {
      throw Object.assign(
        new Error("Nango AI rate limit reached. Please wait a moment and try again."),
        { status: 429 }
      );
    }
    if (response.status === 400) {
      throw Object.assign(
        new Error(tryExtractMessage(errorBody) || "Bad request — check your prompt and try again."),
        { status: 400 }
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw Object.assign(
        new Error("Your Nango API key is invalid or expired."),
        { status: response.status }
      );
    }

    throw Object.assign(
      new Error(`Nango AI request failed: ${response.status} ${response.statusText}`),
      { status: response.status }
    );
  }

  return response.json();
}

function parseGenerationResult(data: unknown): AiGenerationResult {
  const obj = data as Record<string, unknown>;
  return {
    provider: String(obj.provider ?? ""),
    description: String(obj.description ?? ""),
    yaml: String(obj.yaml ?? ""),
    typescript: String(obj.typescript ?? ""),
  };
}

/** Cap conversation history to the most recent N turns. */
function trimHistory(history?: AiConversationTurn[]): AiConversationTurn[] {
  if (!history || history.length === 0) return [];
  return history.slice(-MAX_CONVERSATION_TURNS);
}

/** Try to extract a human-readable message from an error response body. */
function tryExtractMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.message === "string") return parsed.message;
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    // Not JSON — ignore
  }
  return null;
}
