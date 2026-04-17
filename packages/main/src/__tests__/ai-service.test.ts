/**
 * Unit tests for aiService — the main-process service that calls Nango AI
 * endpoints for integration generation and refinement.
 *
 * Coverage:
 *  - generate(): calls /ai/generate with correct headers and body
 *  - refine(): calls /ai/refine with conversation history
 *  - Conversation history trimming (MAX_CONVERSATION_TURNS = 10)
 *  - Rate-limit header capture via rateLimitTracker.observe()
 *  - Error handling: 401, 403, 429, 400, and generic 5xx
 *  - Error handling: missing API key (credentialStore.load() returns null)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Logger mock ──────────────────────────────────────────────────────────────

vi.mock("../logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── credentialStore mock ──────────────────────────────────────────────────────

const mockLoad = vi.fn<() => string | null>().mockReturnValue("test-secret-key");

vi.mock("../credential-store.js", () => ({
  credentialStore: { load: (..._args: unknown[]) => mockLoad() },
}));

// ── rateLimitTracker mock ─────────────────────────────────────────────────────

const mockObserve = vi.fn();

vi.mock("../rate-limit-tracker.js", () => ({
  rateLimitTracker: { observe: (...args: unknown[]) => mockObserve(...args) },
}));

// ── fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_RESULT = {
  provider: "github",
  description: "Lists open issues",
  yaml: "models:\n  Issue:\n    id: string",
  typescript: "export default createSync({});",
};

function makeOkResponse(body: unknown, headers: Record<string, string> = {}): Response {
  const headerMap = new Headers(headers);
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: headerMap,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makeErrorResponse(status: number, statusText: string, body = ""): Response {
  return {
    ok: false,
    status,
    statusText,
    headers: new Headers(),
    text: () => Promise.resolve(body),
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("aiService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockReturnValue("test-secret-key");
    mockFetch.mockResolvedValue(makeOkResponse(MOCK_RESULT));
  });

  // Fresh import each suite to avoid module singleton issues with mocks
  async function importService() {
    vi.resetModules();
    vi.doMock("../logger.js", () => ({
      default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("../credential-store.js", () => ({
      credentialStore: { load: () => mockLoad() },
    }));
    vi.doMock("../rate-limit-tracker.js", () => ({
      rateLimitTracker: { observe: (...args: unknown[]) => mockObserve(...args) },
    }));
    const { aiService } = await import("../ai-service.js");
    return aiService;
  }

  describe("generate()", () => {
    it("calls /ai/generate with provider and prompt in the body", async () => {
      const svc = await importService();
      const result = await svc.generate({ provider: "github", prompt: "List open issues" });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/ai/generate");
      const body = JSON.parse(init.body as string);
      expect(body.provider).toBe("github");
      expect(body.prompt).toBe("List open issues");
      expect(result).toEqual(MOCK_RESULT);
    });

    it("includes Authorization: Bearer header with the stored secret key", async () => {
      const svc = await importService();
      await svc.generate({ provider: "slack", prompt: "Get messages" });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer test-secret-key");
    });

    it("does NOT include conversationHistory when none supplied", async () => {
      const svc = await importService();
      await svc.generate({ provider: "github", prompt: "List stars" });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.conversationHistory).toBeUndefined();
    });

    it("includes conversationHistory when provided", async () => {
      const svc = await importService();
      const history = [{ role: "user" as const, content: "hello" }];
      await svc.generate({ provider: "github", prompt: "Refine", conversationHistory: history });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.conversationHistory).toEqual(history);
    });

    it("returns parsed AiGenerationResult with all required fields", async () => {
      const svc = await importService();
      const result = await svc.generate({ provider: "github", prompt: "Test" });
      expect(result.provider).toBe("github");
      expect(result.description).toBe("Lists open issues");
      expect(result.yaml).toContain("Issue");
      expect(result.typescript).toContain("createSync");
    });
  });

  describe("refine()", () => {
    it("calls /ai/refine with conversationHistory and currentDefinition", async () => {
      const svc = await importService();
      const history = [{ role: "user" as const, content: "first prompt" }];
      await svc.refine({
        provider: "github",
        prompt: "Add pagination",
        conversationHistory: history,
        currentDefinition: MOCK_RESULT,
      });

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/ai/refine");
      const body = JSON.parse(init.body as string);
      expect(body.conversationHistory).toEqual(history);
      expect(body.currentDefinition).toEqual(MOCK_RESULT);
    });
  });

  describe("conversation history trimming", () => {
    it("trims history to the last 10 turns when more than 10 are provided", async () => {
      const svc = await importService();
      const history = Array.from({ length: 15 }, (_, i) => ({
        role: "user" as const,
        content: `turn ${i + 1}`,
      }));
      await svc.generate({ provider: "github", prompt: "Test", conversationHistory: history });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.conversationHistory).toHaveLength(10);
      expect(body.conversationHistory[0].content).toBe("turn 6"); // last 10 of 15
    });

    it("passes history unchanged when ≤ 10 turns", async () => {
      const svc = await importService();
      const history = Array.from({ length: 5 }, (_, i) => ({
        role: "user" as const,
        content: `turn ${i + 1}`,
      }));
      await svc.generate({ provider: "github", prompt: "Test", conversationHistory: history });

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.conversationHistory).toHaveLength(5);
    });
  });

  describe("rate-limit header capture", () => {
    it("calls rateLimitTracker.observe('nango-ai', headers) on success", async () => {
      const svc = await importService();
      // Headers API lowercases all keys when iterating with forEach
      mockFetch.mockResolvedValueOnce(
        makeOkResponse(MOCK_RESULT, {
          "x-ratelimit-limit": "1000",
          "x-ratelimit-remaining": "900",
        })
      );
      await svc.generate({ provider: "github", prompt: "Test" });

      expect(mockObserve).toHaveBeenCalledOnce();
      const [provider, headers] = mockObserve.mock.calls[0] as [string, Record<string, string>];
      expect(provider).toBe("nango-ai");
      expect(headers["x-ratelimit-limit"]).toBe("1000");
      expect(headers["x-ratelimit-remaining"]).toBe("900");
    });
  });

  describe("error handling — missing API key", () => {
    it("throws a 401 error when credentialStore.load() returns null", async () => {
      mockLoad.mockReturnValue(null);
      const svc = await importService();
      await expect(svc.generate({ provider: "github", prompt: "Test" })).rejects.toThrow(
        /API key not configured/i
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("error handling — HTTP error codes", () => {
    it("throws rate-limit error on 429", async () => {
      const svc = await importService();
      mockFetch.mockResolvedValueOnce(makeErrorResponse(429, "Too Many Requests"));
      await expect(svc.generate({ provider: "github", prompt: "Test" })).rejects.toThrow(
        /rate limit/i
      );
    });

    it("throws auth error on 401", async () => {
      const svc = await importService();
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401, "Unauthorized"));
      await expect(svc.generate({ provider: "github", prompt: "Test" })).rejects.toThrow(
        /invalid or expired/i
      );
    });

    it("throws auth error on 403", async () => {
      const svc = await importService();
      mockFetch.mockResolvedValueOnce(makeErrorResponse(403, "Forbidden"));
      await expect(svc.generate({ provider: "github", prompt: "Test" })).rejects.toThrow(
        /invalid or expired/i
      );
    });

    it("throws bad-request error on 400 with message body", async () => {
      const svc = await importService();
      mockFetch.mockResolvedValueOnce(
        makeErrorResponse(400, "Bad Request", JSON.stringify({ message: "Prompt too long" }))
      );
      await expect(svc.generate({ provider: "github", prompt: "Test" })).rejects.toThrow(
        /Prompt too long/i
      );
    });

    it("throws generic error on 400 with no parseable message", async () => {
      const svc = await importService();
      mockFetch.mockResolvedValueOnce(makeErrorResponse(400, "Bad Request", "plain text error"));
      await expect(svc.generate({ provider: "github", prompt: "Test" })).rejects.toThrow(
        /Bad request/i
      );
    });

    it("throws generic error on 500", async () => {
      const svc = await importService();
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500, "Internal Server Error"));
      await expect(svc.generate({ provider: "github", prompt: "Test" })).rejects.toThrow(
        /failed: 500/i
      );
    });
  });
});
