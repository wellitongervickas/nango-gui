import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  IpcResponse,
  NangoTriggerActionResult,
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
    proxyRequest: mockProxyRequest,
  },
});

import { useActionsStore } from "../store/actionsStore.js";

beforeEach(() => {
  useActionsStore.setState({
    actionResult: null,
    isExecutingAction: false,
    actionError: null,
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
});
