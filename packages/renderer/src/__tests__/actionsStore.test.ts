import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  IpcResponse,
  NangoTriggerActionResult,
  NangoTriggerActionAsyncResult,
  NangoGetAsyncActionResultResult,
  NangoProxyResult,
} from "@nango-gui/shared";

// ── window.nango mock ───────────────────────────────────────────────────────

const mockTriggerAction = vi.fn(
  (): Promise<IpcResponse<NangoTriggerActionResult>> =>
    Promise.resolve({
      status: "ok",
      data: { result: { id: "contact-1", name: "Alice" } },
      error: null,
    })
);

const mockTriggerActionAsync = vi.fn(
  (): Promise<IpcResponse<NangoTriggerActionAsyncResult>> =>
    Promise.resolve({
      status: "ok",
      data: { id: "job-1", statusUrl: "/jobs/job-1" },
      error: null,
    })
);

const mockGetAsyncActionResult = vi.fn(
  (): Promise<IpcResponse<NangoGetAsyncActionResultResult>> =>
    Promise.resolve({
      status: "ok",
      data: { status: "pending" },
      error: null,
    })
);

const mockProxyRequest = vi.fn(
  (): Promise<IpcResponse<NangoProxyResult>> =>
    Promise.resolve({
      status: "ok",
      data: {
        status: 200,
        headers: { "content-type": "application/json" },
        data: { users: [{ id: 1 }] },
      },
      error: null,
    })
);

vi.stubGlobal("window", {
  nango: {
    triggerAction: mockTriggerAction,
    triggerActionAsync: mockTriggerActionAsync,
    getAsyncActionResult: mockGetAsyncActionResult,
    proxyRequest: mockProxyRequest,
  },
});

import { useActionsStore } from "../store/actionsStore.js";

beforeEach(() => {
  useActionsStore.setState({
    actionResult: null,
    isExecutingAction: false,
    actionError: null,
    asyncJobId: null,
    asyncStatus: null,
    asyncPollCount: 0,
    isPollingAsync: false,
    lastAsyncAction: null,
    proxyStatus: null,
    proxyHeaders: null,
    proxyData: null,
    isExecutingProxy: false,
    proxyError: null,
    history: [],
  });
  vi.clearAllMocks();
  mockTriggerAction.mockImplementation(() =>
    Promise.resolve({
      status: "ok" as const,
      data: { result: { id: "contact-1", name: "Alice" } },
      error: null,
    })
  );
  mockTriggerActionAsync.mockImplementation(() =>
    Promise.resolve({
      status: "ok" as const,
      data: { id: "job-1", statusUrl: "/jobs/job-1" },
      error: null,
    })
  );
  mockGetAsyncActionResult.mockImplementation(() =>
    Promise.resolve({
      status: "ok" as const,
      data: { status: "pending" },
      error: null,
    })
  );
  mockProxyRequest.mockImplementation(() =>
    Promise.resolve({
      status: "ok" as const,
      data: {
        status: 200,
        headers: { "content-type": "application/json" },
        data: { users: [{ id: 1 }] },
      },
      error: null,
    })
  );
});

describe("useActionsStore", () => {
  describe("triggerAction", () => {
    it("sets action result on success", async () => {
      await useActionsStore
        .getState()
        .triggerAction("github", "user-1", "create-contact", { name: "Alice" });

      const state = useActionsStore.getState();
      expect(state.actionResult).toEqual({ id: "contact-1", name: "Alice" });
      expect(state.isExecutingAction).toBe(false);
      expect(state.actionError).toBeNull();
    });

    it("calls window.nango.triggerAction with correct params", async () => {
      await useActionsStore
        .getState()
        .triggerAction("github", "user-1", "create-contact", { name: "Alice" });

      expect(mockTriggerAction).toHaveBeenCalledWith({
        integrationId: "github",
        connectionId: "user-1",
        actionName: "create-contact",
        input: { name: "Alice" },
      });
    });

    it("adds a history entry on success", async () => {
      await useActionsStore
        .getState()
        .triggerAction("github", "user-1", "create-contact", { name: "Alice" });

      const { history } = useActionsStore.getState();
      expect(history).toHaveLength(1);
      expect(history[0]!.type).toBe("action");
      expect(history[0]!.error).toBeNull();
      if (history[0]!.type === "action") {
        expect(history[0]!.actionName).toBe("create-contact");
        expect(history[0]!.result).toEqual({ id: "contact-1", name: "Alice" });
      }
    });

    it("sets error on API failure", async () => {
      mockTriggerAction.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Action not found",
        errorCode: "UNKNOWN",
      });

      await useActionsStore
        .getState()
        .triggerAction("github", "user-1", "bad-action", {});

      const state = useActionsStore.getState();
      expect(state.actionError).toBe("Action not found");
      expect(state.actionResult).toBeNull();
      expect(state.history).toHaveLength(1);
      expect(state.history[0]!.error).toBe("Action not found");
    });

    it("sets error on thrown exception", async () => {
      mockTriggerAction.mockRejectedValueOnce(new Error("Network error"));

      await useActionsStore
        .getState()
        .triggerAction("github", "user-1", "create-contact", {});

      const state = useActionsStore.getState();
      expect(state.actionError).toBe("Network error");
      expect(state.isExecutingAction).toBe(false);
    });

    it("records durationMs in history", async () => {
      await useActionsStore
        .getState()
        .triggerAction("github", "user-1", "create-contact", {});

      const { history } = useActionsStore.getState();
      expect(history[0]!.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("sendProxyRequest", () => {
    it("sets proxy result on success", async () => {
      await useActionsStore
        .getState()
        .sendProxyRequest("github", "user-1", "GET", "/api/users");

      const state = useActionsStore.getState();
      expect(state.proxyStatus).toBe(200);
      expect(state.proxyHeaders).toEqual({ "content-type": "application/json" });
      expect(state.proxyData).toEqual({ users: [{ id: 1 }] });
      expect(state.isExecutingProxy).toBe(false);
      expect(state.proxyError).toBeNull();
    });

    it("calls window.nango.proxyRequest with correct params", async () => {
      await useActionsStore
        .getState()
        .sendProxyRequest("github", "user-1", "POST", "/api/users", {
          headers: { "x-custom": "value" },
          data: { name: "Bob" },
          params: { page: "1" },
        });

      expect(mockProxyRequest).toHaveBeenCalledWith({
        integrationId: "github",
        connectionId: "user-1",
        method: "POST",
        endpoint: "/api/users",
        headers: { "x-custom": "value" },
        data: { name: "Bob" },
        params: { page: "1" },
      });
    });

    it("adds proxy history entry on success", async () => {
      await useActionsStore
        .getState()
        .sendProxyRequest("github", "user-1", "GET", "/api/users");

      const { history } = useActionsStore.getState();
      expect(history).toHaveLength(1);
      expect(history[0]!.type).toBe("proxy");
      if (history[0]!.type === "proxy") {
        expect(history[0]!.method).toBe("GET");
        expect(history[0]!.endpoint).toBe("/api/users");
        expect(history[0]!.responseStatus).toBe(200);
      }
    });

    it("sets error on API failure", async () => {
      mockProxyRequest.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Connection not found",
        errorCode: "UNKNOWN",
      });

      await useActionsStore
        .getState()
        .sendProxyRequest("github", "user-1", "GET", "/api/users");

      const state = useActionsStore.getState();
      expect(state.proxyError).toBe("Connection not found");
      expect(state.proxyStatus).toBeNull();
    });

    it("sets error on thrown exception", async () => {
      mockProxyRequest.mockRejectedValueOnce(new Error("Timeout"));

      await useActionsStore
        .getState()
        .sendProxyRequest("github", "user-1", "GET", "/api/users");

      expect(useActionsStore.getState().proxyError).toBe("Timeout");
      expect(useActionsStore.getState().isExecutingProxy).toBe(false);
    });

    it("omits empty opts from request", async () => {
      await useActionsStore
        .getState()
        .sendProxyRequest("github", "user-1", "GET", "/api/users");

      expect(mockProxyRequest).toHaveBeenCalledWith({
        integrationId: "github",
        connectionId: "user-1",
        method: "GET",
        endpoint: "/api/users",
      });
    });
  });

  describe("history management", () => {
    it("prepends new entries (most recent first)", async () => {
      await useActionsStore
        .getState()
        .triggerAction("github", "user-1", "action-1", {});
      await useActionsStore
        .getState()
        .sendProxyRequest("github", "user-1", "GET", "/api/users");

      const { history } = useActionsStore.getState();
      expect(history).toHaveLength(2);
      expect(history[0]!.type).toBe("proxy");
      expect(history[1]!.type).toBe("action");
    });

    it("limits history to 20 entries", async () => {
      for (let i = 0; i < 25; i++) {
        await useActionsStore
          .getState()
          .triggerAction("github", "user-1", `action-${i}`, {});
      }

      expect(useActionsStore.getState().history).toHaveLength(20);
    });

    it("clearHistory empties the list", async () => {
      await useActionsStore
        .getState()
        .triggerAction("github", "user-1", "action-1", {});

      useActionsStore.getState().clearHistory();

      expect(useActionsStore.getState().history).toEqual([]);
    });
  });

  describe("clear helpers", () => {
    it("clearActionResult resets action fields", async () => {
      await useActionsStore
        .getState()
        .triggerAction("github", "user-1", "create-contact", {});

      useActionsStore.getState().clearActionResult();

      const state = useActionsStore.getState();
      expect(state.actionResult).toBeNull();
      expect(state.actionError).toBeNull();
    });

    it("clearProxyResult resets proxy fields", async () => {
      await useActionsStore
        .getState()
        .sendProxyRequest("github", "user-1", "GET", "/api/users");

      useActionsStore.getState().clearProxyResult();

      const state = useActionsStore.getState();
      expect(state.proxyStatus).toBeNull();
      expect(state.proxyHeaders).toBeNull();
      expect(state.proxyData).toBeNull();
      expect(state.proxyError).toBeNull();
    });
  });

  // ── Async actions ──────────────────────────────────────────────────────

  describe("triggerActionAsync", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      // Cancel any active polling so timers from one test do not leak into the next.
      useActionsStore.getState().cancelAsyncPolling();
      vi.useRealTimers();
    });

    it("polls until success and records history with asyncStatus=success", async () => {
      mockGetAsyncActionResult
        .mockResolvedValueOnce({
          status: "ok",
          data: { status: "running" },
          error: null,
        })
        .mockResolvedValueOnce({
          status: "ok",
          data: { status: "success", output: { ok: true, value: 42 } },
          error: null,
        });

      await useActionsStore
        .getState()
        .triggerActionAsync("github", "user-1", "long-job", { foo: "bar" });

      // After the initial trigger, polling has started.
      expect(useActionsStore.getState().asyncJobId).toBe("job-1");
      expect(useActionsStore.getState().isPollingAsync).toBe(true);
      expect(useActionsStore.getState().asyncStatus).toBe("pending");
      expect(useActionsStore.getState().lastAsyncAction).toEqual({
        integrationId: "github",
        connectionId: "user-1",
        actionName: "long-job",
        input: { foo: "bar" },
      });

      // First poll → running.
      await vi.advanceTimersByTimeAsync(5_000);
      expect(useActionsStore.getState().asyncStatus).toBe("running");
      expect(useActionsStore.getState().isPollingAsync).toBe(true);

      // Second poll → success.
      await vi.advanceTimersByTimeAsync(5_000);
      const state = useActionsStore.getState();
      expect(state.asyncStatus).toBe("success");
      expect(state.isPollingAsync).toBe(false);
      expect(state.actionResult).toEqual({ ok: true, value: 42 });
      expect(state.history).toHaveLength(1);
      expect(state.history[0]!.type).toBe("action");
      if (state.history[0]!.type === "action") {
        expect(state.history[0]!.asyncStatus).toBe("success");
        expect(state.history[0]!.result).toEqual({ ok: true, value: 42 });
        expect(state.history[0]!.error).toBeNull();
      }
    });

    it("polls until failed and records history with error message", async () => {
      mockGetAsyncActionResult.mockResolvedValueOnce({
        status: "ok",
        data: { status: "failed", error: "Upstream service exploded" },
        error: null,
      });

      await useActionsStore
        .getState()
        .triggerActionAsync("github", "user-1", "long-job", {});

      await vi.advanceTimersByTimeAsync(5_000);

      const state = useActionsStore.getState();
      expect(state.asyncStatus).toBe("failed");
      expect(state.isPollingAsync).toBe(false);
      expect(state.actionError).toBe("Upstream service exploded");
      expect(state.history).toHaveLength(1);
      if (state.history[0]!.type === "action") {
        expect(state.history[0]!.asyncStatus).toBe("failed");
        expect(state.history[0]!.error).toBe("Upstream service exploded");
      }
    });

    it("times out after 10 minutes and records asyncStatus=timed_out", async () => {
      // Always return pending so we drive the timeout branch.
      mockGetAsyncActionResult.mockResolvedValue({
        status: "ok",
        data: { status: "pending" },
        error: null,
      });

      await useActionsStore
        .getState()
        .triggerActionAsync("github", "user-1", "long-job", {});

      // Advance past the 10-minute cap (poll runs every 5s).
      await vi.advanceTimersByTimeAsync(10 * 60 * 1_000 + 5_000);

      const state = useActionsStore.getState();
      expect(state.asyncStatus).toBe("timed_out");
      expect(state.isPollingAsync).toBe(false);
      expect(state.actionError).toBe("Async action timed out after 10 minutes");
      const last = state.history[0];
      expect(last?.type).toBe("action");
      if (last?.type === "action") {
        expect(last.asyncStatus).toBe("timed_out");
        expect(last.error).toBe("Async action timed out after 10 minutes");
      }
    });

    it("records a failed history entry when the initial trigger IPC errors", async () => {
      mockTriggerActionAsync.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Action not found",
        errorCode: "UNKNOWN",
      });

      await useActionsStore
        .getState()
        .triggerActionAsync("github", "user-1", "missing", {});

      const state = useActionsStore.getState();
      expect(state.actionError).toBe("Action not found");
      expect(state.isPollingAsync).toBe(false);
      expect(state.asyncJobId).toBeNull();
      expect(state.history).toHaveLength(1);
      if (state.history[0]!.type === "action") {
        expect(state.history[0]!.asyncStatus).toBe("failed");
        expect(state.history[0]!.error).toBe("Action not found");
      }
      // No polling timer should have been scheduled.
      expect(mockGetAsyncActionResult).not.toHaveBeenCalled();
    });
  });

  describe("cancelAsyncPolling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("clears the timer and resets all async state fields", async () => {
      mockGetAsyncActionResult.mockResolvedValue({
        status: "ok",
        data: { status: "pending" },
        error: null,
      });

      await useActionsStore
        .getState()
        .triggerActionAsync("github", "user-1", "long-job", {});

      expect(useActionsStore.getState().isPollingAsync).toBe(true);

      useActionsStore.getState().cancelAsyncPolling();

      const state = useActionsStore.getState();
      expect(state.isPollingAsync).toBe(false);
      expect(state.asyncJobId).toBeNull();
      expect(state.asyncStatus).toBeNull();
      expect(state.asyncPollCount).toBe(0);

      // Subsequent timer ticks must NOT invoke the poll API after cancel.
      mockGetAsyncActionResult.mockClear();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(mockGetAsyncActionResult).not.toHaveBeenCalled();
    });
  });

  describe("retryLastAsyncAction", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      useActionsStore.getState().cancelAsyncPolling();
      vi.useRealTimers();
    });

    it("re-invokes the last async action with the saved params", async () => {
      mockGetAsyncActionResult.mockResolvedValue({
        status: "ok",
        data: { status: "pending" },
        error: null,
      });

      await useActionsStore
        .getState()
        .triggerActionAsync("github", "user-1", "long-job", { id: 7 });

      mockTriggerActionAsync.mockClear();

      await useActionsStore.getState().retryLastAsyncAction();

      expect(mockTriggerActionAsync).toHaveBeenCalledTimes(1);
      expect(mockTriggerActionAsync).toHaveBeenCalledWith({
        integrationId: "github",
        connectionId: "user-1",
        actionName: "long-job",
        input: { id: 7 },
      });
    });

    it("is a no-op when there is no last async action", async () => {
      await useActionsStore.getState().retryLastAsyncAction();
      expect(mockTriggerActionAsync).not.toHaveBeenCalled();
    });
  });

  describe("getHistoryForIntegration", () => {
    it("returns only action entries for the requested integration", async () => {
      await useActionsStore
        .getState()
        .triggerAction("github", "user-1", "create-contact", { name: "A" });
      await useActionsStore
        .getState()
        .triggerAction("slack", "user-2", "send-message", { text: "hi" });
      await useActionsStore
        .getState()
        .sendProxyRequest("github", "user-1", "GET", "/api/users");

      const githubHistory = useActionsStore
        .getState()
        .getHistoryForIntegration("github");

      expect(githubHistory).toHaveLength(1);
      expect(githubHistory[0]!.type).toBe("action");
      expect(githubHistory[0]!.integrationId).toBe("github");
      expect(githubHistory[0]!.actionName).toBe("create-contact");
    });

    it("returns an empty array when no entries match", async () => {
      await useActionsStore
        .getState()
        .triggerAction("github", "user-1", "create-contact", {});

      const result = useActionsStore
        .getState()
        .getHistoryForIntegration("nonexistent");

      expect(result).toEqual([]);
    });
  });
});
