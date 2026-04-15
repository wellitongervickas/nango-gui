import { create } from "zustand";
import type { WebhookEvent, WebhookServerStatus } from "@nango-gui/shared";

interface WebhookState {
  status: WebhookServerStatus;
  events: WebhookEvent[];
  isStarting: boolean;
  isStopping: boolean;
  error: string | null;
  /** Client-side filter string — matches method or path. */
  filterText: string;
  /** Filtered to a specific HTTP method, or null for all. */
  filterMethod: string | null;
  /** The event currently expanded in the detail view. */
  selectedEventId: string | null;

  fetchStatus(): Promise<void>;
  fetchEvents(): Promise<void>;
  startServer(port?: number): Promise<void>;
  stopServer(): Promise<void>;
  clearEvents(): Promise<void>;
  appendEvent(event: WebhookEvent): void;
  setFilterText(text: string): void;
  setFilterMethod(method: string | null): void;
  setSelectedEventId(id: string | null): void;
}

const INITIAL_STATUS: WebhookServerStatus = {
  running: false,
  port: null,
  url: null,
  eventCount: 0,
};

export const useWebhookStore = create<WebhookState>((set, get) => ({
  status: INITIAL_STATUS,
  events: [],
  isStarting: false,
  isStopping: false,
  error: null,
  filterText: "",
  filterMethod: null,
  selectedEventId: null,

  fetchStatus: async () => {
    if (!window.webhook) return;
    const res = await window.webhook.getStatus();
    if (res.status === "ok") {
      set({ status: res.data });
    }
  },

  fetchEvents: async () => {
    if (!window.webhook) return;
    const res = await window.webhook.getEvents();
    if (res.status === "ok") {
      set({ events: res.data.events });
    }
  },

  startServer: async (port?: number) => {
    if (!window.webhook) return;
    set({ isStarting: true, error: null });
    try {
      const res = await window.webhook.startServer(port != null ? { port } : undefined);
      if (res.status === "error") {
        set({ error: res.error, isStarting: false });
        return;
      }
      set({
        status: {
          running: true,
          port: res.data.port,
          url: res.data.url,
          eventCount: get().status.eventCount,
        },
        isStarting: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to start server",
        isStarting: false,
      });
    }
  },

  stopServer: async () => {
    if (!window.webhook) return;
    set({ isStopping: true, error: null });
    try {
      const res = await window.webhook.stopServer();
      if (res.status === "error") {
        set({ error: res.error, isStopping: false });
        return;
      }
      set({
        status: { running: false, port: null, url: null, eventCount: get().events.length },
        isStopping: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to stop server",
        isStopping: false,
      });
    }
  },

  clearEvents: async () => {
    if (!window.webhook) return;
    const res = await window.webhook.clearEvents();
    if (res.status === "ok") {
      set((state) => ({
        events: [],
        status: { ...state.status, eventCount: 0 },
        selectedEventId: null,
      }));
    }
  },

  appendEvent: (event: WebhookEvent) => {
    set((state) => ({
      events: [...state.events, event],
      status: { ...state.status, eventCount: state.status.eventCount + 1 },
    }));
  },

  setFilterText: (text: string) => set({ filterText: text }),
  setFilterMethod: (method: string | null) => set({ filterMethod: method }),
  setSelectedEventId: (id: string | null) => set({ selectedEventId: id }),
}));

/** Returns events filtered by the current filter state. */
export function selectFilteredEvents(state: WebhookState): WebhookEvent[] {
  const { events, filterText, filterMethod } = state;
  return events.filter((e) => {
    if (filterMethod && e.method !== filterMethod) return false;
    if (filterText) {
      const q = filterText.toLowerCase();
      if (!e.path.toLowerCase().includes(q) && !e.method.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });
}
