import { create } from "zustand";
import type { NangoProxyMethod, AsyncActionStatus } from "@nango-gui/shared";
import { notifyIpcError } from "./notifyError";

// ── History entry types ────────────────────────────────────────────────────

export interface ActionHistoryEntry {
  id: string;
  type: "action";
  timestamp: string;
  integrationId: string;
  connectionId: string;
  actionName: string;
  input: Record<string, unknown>;
  result: unknown | null;
  error: string | null;
  durationMs: number;
  asyncStatus?: AsyncActionStatus;
}

export interface ProxyHistoryEntry {
  id: string;
  type: "proxy";
  timestamp: string;
  integrationId: string;
  connectionId: string;
  method: NangoProxyMethod;
  endpoint: string;
  requestHeaders: Record<string, string>;
  requestParams: Record<string, string>;
  requestBody: unknown;
  responseStatus: number | null;
  responseHeaders: Record<string, string> | null;
  responseData: unknown | null;
  error: string | null;
  durationMs: number;
}

export type HistoryEntry = ActionHistoryEntry | ProxyHistoryEntry;

const MAX_HISTORY = 20;

// ── Async polling constants ──────────────────────────────────────────────

const ASYNC_POLL_INTERVAL_MS = 5_000;
const ASYNC_POLL_MAX_DURATION_MS = 10 * 60 * 1_000; // 10 minutes

// ── Store interface ────────────────────────────────────────────────────────

interface LastAsyncAction {
  integrationId: string;
  connectionId: string;
  actionName: string;
  input: Record<string, unknown>;
}

interface ActionsState {
  // Action runner
  actionResult: unknown | null;
  isExecutingAction: boolean;
  actionError: string | null;

  // Async action runner
  asyncJobId: string | null;
  asyncStatus: AsyncActionStatus | null;
  asyncPollCount: number;
  isPollingAsync: boolean;
  lastAsyncAction: LastAsyncAction | null;

  // Proxy tester
  proxyStatus: number | null;
  proxyHeaders: Record<string, string> | null;
  proxyData: unknown | null;
  isExecutingProxy: boolean;
  proxyError: string | null;

  // Shared history
  history: HistoryEntry[];

  // Actions
  triggerAction: (
    integrationId: string,
    connectionId: string,
    actionName: string,
    input: Record<string, unknown>
  ) => Promise<void>;
  triggerActionAsync: (
    integrationId: string,
    connectionId: string,
    actionName: string,
    input: Record<string, unknown>
  ) => Promise<void>;
  retryLastAsyncAction: () => Promise<void>;
  cancelAsyncPolling: () => void;
  sendProxyRequest: (
    integrationId: string,
    connectionId: string,
    method: NangoProxyMethod,
    endpoint: string,
    opts?: {
      headers?: Record<string, string>;
      data?: unknown;
      params?: Record<string, string>;
    }
  ) => Promise<void>;
  clearHistory: () => void;
  clearActionResult: () => void;
  clearProxyResult: () => void;
  getHistoryForIntegration: (integrationId: string) => ActionHistoryEntry[];
}

let _nextId = 1;
let _asyncPollTimer: ReturnType<typeof setInterval> | null = null;
let _asyncStartTime: number | null = null;

function clearAsyncPollTimer() {
  if (_asyncPollTimer !== null) {
    clearInterval(_asyncPollTimer);
    _asyncPollTimer = null;
  }
  _asyncStartTime = null;
}

export const useActionsStore = create<ActionsState>((set, get) => ({
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

  triggerAction: async (integrationId, connectionId, actionName, input) => {
    if (!window.nango) return;
    set({ isExecutingAction: true, actionError: null, actionResult: null });
    const start = Date.now();

    try {
      const res = await window.nango.triggerAction({
        integrationId,
        connectionId,
        actionName,
        input,
      });

      const durationMs = Date.now() - start;

      if (res.status === "error") {
        notifyIpcError(res);
        const entry: ActionHistoryEntry = {
          id: String(_nextId++),
          type: "action",
          timestamp: new Date().toISOString(),
          integrationId,
          connectionId,
          actionName,
          input,
          result: null,
          error: res.error,
          durationMs,
        };
        set((s) => ({
          actionError: res.error,
          isExecutingAction: false,
          history: [entry, ...s.history].slice(0, MAX_HISTORY),
        }));
        return;
      }

      const entry: ActionHistoryEntry = {
        id: String(_nextId++),
        type: "action",
        timestamp: new Date().toISOString(),
        integrationId,
        connectionId,
        actionName,
        input,
        result: res.data.result,
        error: null,
        durationMs,
      };
      set((s) => ({
        actionResult: res.data.result,
        isExecutingAction: false,
        history: [entry, ...s.history].slice(0, MAX_HISTORY),
      }));
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMsg =
        err instanceof Error ? err.message : "Failed to trigger action";
      const entry: ActionHistoryEntry = {
        id: String(_nextId++),
        type: "action",
        timestamp: new Date().toISOString(),
        integrationId,
        connectionId,
        actionName,
        input,
        result: null,
        error: errorMsg,
        durationMs,
      };
      set((s) => ({
        actionError: errorMsg,
        isExecutingAction: false,
        history: [entry, ...s.history].slice(0, MAX_HISTORY),
      }));
    }
  },

  triggerActionAsync: async (integrationId, connectionId, actionName, input) => {
    if (!window.nango) return;
    clearAsyncPollTimer();
    set({
      isExecutingAction: true,
      actionError: null,
      actionResult: null,
      asyncJobId: null,
      asyncStatus: null,
      asyncPollCount: 0,
      isPollingAsync: false,
      lastAsyncAction: { integrationId, connectionId, actionName, input },
    });
    const start = Date.now();

    try {
      const res = await window.nango.triggerActionAsync({
        integrationId,
        connectionId,
        actionName,
        input,
      });

      if (res.status === "error") {
        notifyIpcError(res);
        const entry: ActionHistoryEntry = {
          id: String(_nextId++),
          type: "action",
          timestamp: new Date().toISOString(),
          integrationId,
          connectionId,
          actionName,
          input,
          result: null,
          error: res.error,
          durationMs: Date.now() - start,
          asyncStatus: "failed",
        };
        set((s) => ({
          actionError: res.error,
          isExecutingAction: false,
          history: [entry, ...s.history].slice(0, MAX_HISTORY),
        }));
        return;
      }

      const jobId = res.data.id;
      _asyncStartTime = Date.now();
      set({
        asyncJobId: jobId,
        asyncStatus: "pending",
        isExecutingAction: false,
        isPollingAsync: true,
        asyncPollCount: 0,
      });

      _asyncPollTimer = setInterval(async () => {
        const state = get();
        if (!state.isPollingAsync || !window.nango) {
          clearAsyncPollTimer();
          return;
        }

        const elapsed = Date.now() - (_asyncStartTime ?? Date.now());
        const pollCount = state.asyncPollCount + 1;
        set({ asyncPollCount: pollCount });

        if (elapsed >= ASYNC_POLL_MAX_DURATION_MS) {
          clearAsyncPollTimer();
          const entry: ActionHistoryEntry = {
            id: String(_nextId++),
            type: "action",
            timestamp: new Date().toISOString(),
            integrationId,
            connectionId,
            actionName,
            input,
            result: null,
            error: "Async action timed out after 10 minutes",
            durationMs: elapsed,
            asyncStatus: "timed_out",
          };
          set((s) => ({
            isPollingAsync: false,
            asyncStatus: "timed_out",
            actionError: "Async action timed out after 10 minutes",
            history: [entry, ...s.history].slice(0, MAX_HISTORY),
          }));
          return;
        }

        try {
          const pollRes = await window.nango.getAsyncActionResult({ id: jobId });

          if (pollRes.status === "error") {
            clearAsyncPollTimer();
            notifyIpcError(pollRes);
            const entry: ActionHistoryEntry = {
              id: String(_nextId++),
              type: "action",
              timestamp: new Date().toISOString(),
              integrationId,
              connectionId,
              actionName,
              input,
              result: null,
              error: pollRes.error,
              durationMs: Date.now() - start,
              asyncStatus: "failed",
            };
            set((s) => ({
              isPollingAsync: false,
              asyncStatus: "failed",
              actionError: pollRes.error,
              history: [entry, ...s.history].slice(0, MAX_HISTORY),
            }));
            return;
          }

          const { status: asyncStatus, output, error } = pollRes.data;

          if (asyncStatus === "running") {
            set({ asyncStatus: "running" });
          } else if (asyncStatus === "success") {
            clearAsyncPollTimer();
            const entry: ActionHistoryEntry = {
              id: String(_nextId++),
              type: "action",
              timestamp: new Date().toISOString(),
              integrationId,
              connectionId,
              actionName,
              input,
              result: output ?? null,
              error: null,
              durationMs: Date.now() - start,
              asyncStatus: "success",
            };
            set((s) => ({
              isPollingAsync: false,
              asyncStatus: "success",
              actionResult: output,
              history: [entry, ...s.history].slice(0, MAX_HISTORY),
            }));
          } else if (asyncStatus === "failed") {
            clearAsyncPollTimer();
            const errorMsg = error ?? "Async action failed";
            const entry: ActionHistoryEntry = {
              id: String(_nextId++),
              type: "action",
              timestamp: new Date().toISOString(),
              integrationId,
              connectionId,
              actionName,
              input,
              result: null,
              error: errorMsg,
              durationMs: Date.now() - start,
              asyncStatus: "failed",
            };
            set((s) => ({
              isPollingAsync: false,
              asyncStatus: "failed",
              actionError: errorMsg,
              history: [entry, ...s.history].slice(0, MAX_HISTORY),
            }));
          }
          // "pending" — keep polling
        } catch {
          // Network or IPC error during poll — keep trying
        }
      }, ASYNC_POLL_INTERVAL_MS);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to trigger async action";
      const entry: ActionHistoryEntry = {
        id: String(_nextId++),
        type: "action",
        timestamp: new Date().toISOString(),
        integrationId,
        connectionId,
        actionName,
        input,
        result: null,
        error: errorMsg,
        durationMs: Date.now() - start,
        asyncStatus: "failed",
      };
      set((s) => ({
        actionError: errorMsg,
        isExecutingAction: false,
        history: [entry, ...s.history].slice(0, MAX_HISTORY),
      }));
    }
  },

  retryLastAsyncAction: async () => {
    const { lastAsyncAction, triggerActionAsync } = get();
    if (!lastAsyncAction) return;
    const { integrationId, connectionId, actionName, input } = lastAsyncAction;
    await triggerActionAsync(integrationId, connectionId, actionName, input);
  },

  cancelAsyncPolling: () => {
    clearAsyncPollTimer();
    set({ isPollingAsync: false, asyncStatus: null, asyncJobId: null, asyncPollCount: 0 });
  },

  sendProxyRequest: async (
    integrationId,
    connectionId,
    method,
    endpoint,
    opts
  ) => {
    if (!window.nango) return;
    set({
      isExecutingProxy: true,
      proxyError: null,
      proxyStatus: null,
      proxyHeaders: null,
      proxyData: null,
    });
    const start = Date.now();

    try {
      const res = await window.nango.proxyRequest({
        integrationId,
        connectionId,
        method,
        endpoint,
        ...(opts?.headers ? { headers: opts.headers } : {}),
        ...(opts?.data ? { data: opts.data } : {}),
        ...(opts?.params ? { params: opts.params } : {}),
      });

      const durationMs = Date.now() - start;

      if (res.status === "error") {
        notifyIpcError(res);
        const entry: ProxyHistoryEntry = {
          id: String(_nextId++),
          type: "proxy",
          timestamp: new Date().toISOString(),
          integrationId,
          connectionId,
          method,
          endpoint,
          requestHeaders: opts?.headers ?? {},
          requestParams: opts?.params ?? {},
          requestBody: opts?.data ?? null,
          responseStatus: null,
          responseHeaders: null,
          responseData: null,
          error: res.error,
          durationMs,
        };
        set((s) => ({
          proxyError: res.error,
          isExecutingProxy: false,
          history: [entry, ...s.history].slice(0, MAX_HISTORY),
        }));
        return;
      }

      const entry: ProxyHistoryEntry = {
        id: String(_nextId++),
        type: "proxy",
        timestamp: new Date().toISOString(),
        integrationId,
        connectionId,
        method,
        endpoint,
        requestHeaders: opts?.headers ?? {},
        requestParams: opts?.params ?? {},
        requestBody: opts?.data ?? null,
        responseStatus: res.data.status,
        responseHeaders: res.data.headers,
        responseData: res.data.data,
        error: null,
        durationMs,
      };
      set((s) => ({
        proxyStatus: res.data.status,
        proxyHeaders: res.data.headers,
        proxyData: res.data.data,
        isExecutingProxy: false,
        history: [entry, ...s.history].slice(0, MAX_HISTORY),
      }));
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMsg =
        err instanceof Error ? err.message : "Failed to send proxy request";
      const entry: ProxyHistoryEntry = {
        id: String(_nextId++),
        type: "proxy",
        timestamp: new Date().toISOString(),
        integrationId,
        connectionId,
        method,
        endpoint,
        requestHeaders: opts?.headers ?? {},
        requestParams: opts?.params ?? {},
        requestBody: opts?.data ?? null,
        responseStatus: null,
        responseHeaders: null,
        responseData: null,
        error: errorMsg,
        durationMs,
      };
      set((s) => ({
        proxyError: errorMsg,
        isExecutingProxy: false,
        history: [entry, ...s.history].slice(0, MAX_HISTORY),
      }));
    }
  },

  clearHistory: () => set({ history: [] }),
  clearActionResult: () => {
    clearAsyncPollTimer();
    set({
      actionResult: null,
      actionError: null,
      asyncJobId: null,
      asyncStatus: null,
      asyncPollCount: 0,
      isPollingAsync: false,
    });
  },
  clearProxyResult: () =>
    set({
      proxyStatus: null,
      proxyHeaders: null,
      proxyData: null,
      proxyError: null,
    }),

  getHistoryForIntegration: (integrationId: string): ActionHistoryEntry[] => {
    return get()
      .history
      .filter(
        (e): e is ActionHistoryEntry =>
          e.type === "action" && e.integrationId === integrationId
      )
      .slice(0, MAX_HISTORY);
  },
}));
