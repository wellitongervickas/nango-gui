import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  IpcResponse,
  WebhookServerStatus,
  WebhookGetEventsResult,
  WebhookStartServerResult,
  WebhookEvent,
} from "@nango-gui/shared";

// ── Fixtures ────────────────────────────────────────────────────────────────

const INITIAL_STATUS: WebhookServerStatus = {
  running: false,
  port: null,
  url: null,
  eventCount: 0,
};

const RUNNING_STATUS: WebhookServerStatus = {
  running: true,
  port: 3456,
  url: "http://127.0.0.1:3456",
  eventCount: 0,
};

function makeEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    id: "evt-1",
    timestamp: "2026-04-15T12:00:00.000Z",
    method: "POST",
    path: "/webhook/nango",
    query: {},
    headers: { "content-type": "application/json" },
    body: { foo: "bar" },
    ...overrides,
  };
}

// ── window.webhook mock ─────────────────────────────────────────────────────

const mockGetStatus = vi.fn(
  (): Promise<IpcResponse<WebhookServerStatus>> =>
    Promise.resolve({ status: "ok", data: INITIAL_STATUS, error: null })
);
const mockGetEvents = vi.fn(
  (): Promise<IpcResponse<WebhookGetEventsResult>> =>
    Promise.resolve({
      status: "ok",
      data: { events: [] },
      error: null,
    })
);
const mockStartServer = vi.fn(
  (): Promise<IpcResponse<WebhookStartServerResult>> =>
    Promise.resolve({
      status: "ok",
      data: { port: 3456, url: "http://127.0.0.1:3456" },
      error: null,
    })
);
const mockStopServer = vi.fn(
  (): Promise<IpcResponse<void>> =>
    Promise.resolve({ status: "ok", data: undefined, error: null })
);
const mockClearEvents = vi.fn(
  (): Promise<IpcResponse<void>> =>
    Promise.resolve({ status: "ok", data: undefined, error: null })
);

const mockOnEvent = vi.fn();
const mockRemoveAllEventListeners = vi.fn();

vi.stubGlobal("window", {
  webhook: {
    getStatus: mockGetStatus,
    getEvents: mockGetEvents,
    startServer: mockStartServer,
    stopServer: mockStopServer,
    clearEvents: mockClearEvents,
    onEvent: mockOnEvent,
    removeAllEventListeners: mockRemoveAllEventListeners,
  },
});

import {
  useWebhookStore,
  selectFilteredEvents,
} from "../store/webhookStore.js";

// ── Reset store between tests ───────────────────────────────────────────────

beforeEach(() => {
  useWebhookStore.setState({
    status: { ...INITIAL_STATUS },
    events: [],
    isStarting: false,
    isStopping: false,
    error: null,
    filterText: "",
    filterMethod: null,
    selectedEventId: null,
  });
  vi.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("useWebhookStore", () => {
  describe("fetchStatus", () => {
    it("populates status on success", async () => {
      mockGetStatus.mockResolvedValueOnce({
        status: "ok",
        data: RUNNING_STATUS,
        error: null,
      });
      await useWebhookStore.getState().fetchStatus();
      expect(useWebhookStore.getState().status).toEqual(RUNNING_STATUS);
    });

    it("does nothing when window.webhook is missing", async () => {
      const orig = window.webhook;
      Object.defineProperty(window, "webhook", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      await useWebhookStore.getState().fetchStatus();
      expect(useWebhookStore.getState().status).toEqual(INITIAL_STATUS);
      Object.defineProperty(window, "webhook", {
        value: orig,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("fetchEvents", () => {
    it("populates events on success", async () => {
      const events = [makeEvent(), makeEvent({ id: "evt-2", method: "GET" })];
      mockGetEvents.mockResolvedValueOnce({
        status: "ok",
        data: { events },
        error: null,
      });
      await useWebhookStore.getState().fetchEvents();
      expect(useWebhookStore.getState().events).toEqual(events);
    });

    it("handles error response gracefully", async () => {
      mockGetEvents.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Server error",
        errorCode: "UNKNOWN",
      });
      await useWebhookStore.getState().fetchEvents();
      // Events stay empty — no crash
      expect(useWebhookStore.getState().events).toEqual([]);
    });
  });

  describe("startServer", () => {
    it("sets running status on success", async () => {
      await useWebhookStore.getState().startServer(3456);
      const state = useWebhookStore.getState();
      expect(state.status.running).toBe(true);
      expect(state.status.port).toBe(3456);
      expect(state.status.url).toBe("http://127.0.0.1:3456");
      expect(state.isStarting).toBe(false);
    });

    it("passes port to window.webhook.startServer", async () => {
      await useWebhookStore.getState().startServer(9999);
      expect(mockStartServer).toHaveBeenCalledWith({ port: 9999 });
    });

    it("sets error on API error response", async () => {
      mockStartServer.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Port in use",
        errorCode: "UNKNOWN",
      });
      await useWebhookStore.getState().startServer(3456);
      const state = useWebhookStore.getState();
      expect(state.error).toBe("Port in use");
      expect(state.isStarting).toBe(false);
      expect(state.status.running).toBe(false);
    });

    it("sets error on thrown exception", async () => {
      mockStartServer.mockRejectedValueOnce(new Error("Connection refused"));
      await useWebhookStore.getState().startServer();
      const state = useWebhookStore.getState();
      expect(state.error).toBe("Connection refused");
      expect(state.isStarting).toBe(false);
    });
  });

  describe("stopServer", () => {
    it("resets status on success", async () => {
      useWebhookStore.setState({ status: { ...RUNNING_STATUS } });
      await useWebhookStore.getState().stopServer();
      const state = useWebhookStore.getState();
      expect(state.status.running).toBe(false);
      expect(state.status.port).toBeNull();
      expect(state.status.url).toBeNull();
      expect(state.isStopping).toBe(false);
    });

    it("sets error on API error response", async () => {
      mockStopServer.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Failed to stop",
        errorCode: "UNKNOWN",
      });
      useWebhookStore.setState({ status: { ...RUNNING_STATUS } });
      await useWebhookStore.getState().stopServer();
      expect(useWebhookStore.getState().error).toBe("Failed to stop");
      expect(useWebhookStore.getState().isStopping).toBe(false);
    });
  });

  describe("clearEvents", () => {
    it("empties events and resets count", async () => {
      useWebhookStore.setState({
        events: [makeEvent()],
        status: { ...RUNNING_STATUS, eventCount: 1 },
        selectedEventId: "evt-1",
      });
      await useWebhookStore.getState().clearEvents();
      const state = useWebhookStore.getState();
      expect(state.events).toEqual([]);
      expect(state.status.eventCount).toBe(0);
      expect(state.selectedEventId).toBeNull();
    });
  });

  describe("appendEvent", () => {
    it("appends event and increments count", () => {
      const event = makeEvent();
      useWebhookStore.getState().appendEvent(event);
      const state = useWebhookStore.getState();
      expect(state.events).toHaveLength(1);
      expect(state.events[0]).toEqual(event);
      expect(state.status.eventCount).toBe(1);
    });

    it("appends multiple events in order", () => {
      const e1 = makeEvent({ id: "evt-1" });
      const e2 = makeEvent({ id: "evt-2", method: "GET" });
      useWebhookStore.getState().appendEvent(e1);
      useWebhookStore.getState().appendEvent(e2);
      const state = useWebhookStore.getState();
      expect(state.events).toHaveLength(2);
      expect(state.events[0]!.id).toBe("evt-1");
      expect(state.events[1]!.id).toBe("evt-2");
      expect(state.status.eventCount).toBe(2);
    });
  });

  describe("filter setters", () => {
    it("setFilterText updates filterText", () => {
      useWebhookStore.getState().setFilterText("/api/test");
      expect(useWebhookStore.getState().filterText).toBe("/api/test");
    });

    it("setFilterMethod updates filterMethod", () => {
      useWebhookStore.getState().setFilterMethod("POST");
      expect(useWebhookStore.getState().filterMethod).toBe("POST");
    });

    it("setFilterMethod clears with null", () => {
      useWebhookStore.getState().setFilterMethod("GET");
      useWebhookStore.getState().setFilterMethod(null);
      expect(useWebhookStore.getState().filterMethod).toBeNull();
    });

    it("setSelectedEventId updates selection", () => {
      useWebhookStore.getState().setSelectedEventId("evt-1");
      expect(useWebhookStore.getState().selectedEventId).toBe("evt-1");
    });
  });
});

describe("selectFilteredEvents", () => {
  it("returns all events when no filters active", () => {
    const events = [
      makeEvent({ id: "1", method: "GET" }),
      makeEvent({ id: "2", method: "POST" }),
    ];
    useWebhookStore.setState({ events });
    const result = selectFilteredEvents(useWebhookStore.getState());
    expect(result).toHaveLength(2);
  });

  it("filters by method", () => {
    const events = [
      makeEvent({ id: "1", method: "GET", path: "/a" }),
      makeEvent({ id: "2", method: "POST", path: "/b" }),
      makeEvent({ id: "3", method: "GET", path: "/c" }),
    ];
    useWebhookStore.setState({ events, filterMethod: "GET" });
    const result = selectFilteredEvents(useWebhookStore.getState());
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.method === "GET")).toBe(true);
  });

  it("filters by path text (case-insensitive)", () => {
    const events = [
      makeEvent({ id: "1", method: "POST", path: "/webhook/nango" }),
      makeEvent({ id: "2", method: "POST", path: "/api/health" }),
      makeEvent({ id: "3", method: "GET", path: "/WEBHOOK/test" }),
    ];
    useWebhookStore.setState({ events, filterText: "webhook" });
    const result = selectFilteredEvents(useWebhookStore.getState());
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("combines method and text filters", () => {
    const events = [
      makeEvent({ id: "1", method: "POST", path: "/webhook/nango" }),
      makeEvent({ id: "2", method: "GET", path: "/webhook/test" }),
      makeEvent({ id: "3", method: "POST", path: "/api/health" }),
    ];
    useWebhookStore.setState({
      events,
      filterMethod: "POST",
      filterText: "webhook",
    });
    const result = selectFilteredEvents(useWebhookStore.getState());
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("1");
  });

  it("returns empty array when no events match", () => {
    const events = [makeEvent({ id: "1", method: "GET", path: "/api" })];
    useWebhookStore.setState({
      events,
      filterMethod: "DELETE",
    });
    const result = selectFilteredEvents(useWebhookStore.getState());
    expect(result).toHaveLength(0);
  });

  it("returns empty array on empty events", () => {
    useWebhookStore.setState({ events: [], filterMethod: "POST" });
    const result = selectFilteredEvents(useWebhookStore.getState());
    expect(result).toEqual([]);
  });
});
