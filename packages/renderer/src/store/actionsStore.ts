import { create } from "zustand";
import type { NangoProxyMethod, NangoAsyncActionStatus } from "@nango-gui/shared";
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
  /** Present when the action was triggered asynchronously. */
  isAsync?: boolean;
  taskId?: string;
  taskStatus?: NangoAsyncActionStatus;
  retryCount?: number;
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

// ── Store interface ────────────────────────────────────────────────────────

interface ActionsState {
  // Action runner (sync)
  actionResult: unknown | null;
  isExecutingAction: boolean;
  actionError: string | null;

  // Async action runner
  asyncTaskId: string | null;
  asyncTaskStatus: NangoAsyncActionStatus | null;
  asyncTaskResult: unknown | null;
  asyncTaskError: string | null;
  asyncTaskRetryCount: number;
  isExecutingAsyncAction: boolean;

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
  clearAsyncResult: () => void;
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
}

let _nextId = 1;

const ASYNC_POLL_INTERVAL_MS = 2000;
const ASYNC_MAX_POLLS = 60; // 2 minutes

export const useActionsStore = create<ActionsState>((set, get) => ({
  actionResult: null,
  isExecutingAction: false,
  actionError: null,

  asyncTaskId: null,
  asyncTaskStatus: null,
  asyncTaskResult: null,
  asyncTaskError: null,
  asyncTaskRetryCount: 0,
  isExecutingAsyncAction: false,

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
    set({
      isExecutingAsyncAction: true,
      asyncTaskId: null,
      asyncTaskStatus: "PENDING",
      asyncTaskResult: null,
      asyncTaskError: null,
      asyncTaskRetryCount: 0,
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
        const durationMs = Date.now() - start;
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
          isAsync: true,
        };
        set((s) => ({
          asyncTaskError: res.error,
          asyncTaskStatus: "ERROR",
          isExecutingAsyncAction: false,
          history: [entry, ...s.history].slice(0, MAX_HISTORY),
        }));
        return;
      }

      const { id, statusUrl } = res.data;
      set({ asyncTaskId: id, asyncTaskStatus: "RUNNING" });

      // Add a RUNNING entry to history immediately so user sees it
      const runningEntry: ActionHistoryEntry = {
        id: String(_nextId++),
        type: "action",
        timestamp: new Date().toISOString(),
        integrationId,
        connectionId,
        actionName,
        input,
        result: null,
        error: null,
        durationMs: 0,
        isAsync: true,
        taskId: id,
        taskStatus: "RUNNING",
      };
      set((s) => ({ history: [runningEntry, ...s.history].slice(0, MAX_HISTORY) }));

      // Poll for result
      let polls = 0;
      const historyId = runningEntry.id;

      const poll = async (): Promise<void> => {
        if (polls >= ASYNC_MAX_POLLS) {
          const durationMs = Date.now() - start;
          set((s) => ({
            asyncTaskStatus: "ERROR",
            asyncTaskError: "Polling timed out after 2 minutes",
            isExecutingAsyncAction: false,
            history: s.history.map((e) =>
              e.id === historyId
                ? { ...e, error: "Polling timed out", taskStatus: "ERROR" as NangoAsyncActionStatus, durationMs }
                : e
            ),
          }));
          return;
        }

        // Check if user cleared the result between polls
        if (!get().isExecutingAsyncAction) return;

        polls++;
        await new Promise((r) => setTimeout(r, ASYNC_POLL_INTERVAL_MS));

        try {
          const pollRes = await window.nango!.getAsyncActionResult({ id, statusUrl });

          if (pollRes.status === "error") {
            notifyIpcError(pollRes);
            const durationMs = Date.now() - start;
            set((s) => ({
              asyncTaskStatus: "ERROR",
              asyncTaskError: pollRes.error,
              isExecutingAsyncAction: false,
              history: s.history.map((e) =>
                e.id === historyId
                  ? { ...e, error: pollRes.error, taskStatus: "ERROR" as NangoAsyncActionStatus, durationMs }
                  : e
              ),
            }));
            return;
          }

          const { status, result, error, retryCount } = pollRes.data;

          set({ asyncTaskStatus: status, asyncTaskRetryCount: retryCount ?? 0 });
          if (retryCount !== undefined) {
            set((s) => ({
              history: s.history.map((e) =>
                e.id === historyId ? { ...e, retryCount, taskStatus: status } : e
              ),
            }));
          }

          const isTerminal = status === "SUCCESS" || status === "ERROR" || status === "PAUSED" || status === "STOPPED";
          if (isTerminal) {
            const durationMs = Date.now() - start;
            const taskError = status !== "SUCCESS" ? (error ?? `Action ${status.toLowerCase()}`) : null;
            set((s) => ({
              asyncTaskResult: result ?? null,
              asyncTaskError: taskError,
              isExecutingAsyncAction: false,
              history: s.history.map((e) =>
                e.id === historyId
                  ? { ...e, result: result ?? null, error: taskError, taskStatus: status, durationMs }
                  : e
              ),
            }));
            return;
          }

          // Still running — continue polling
          await poll();
        } catch (err) {
          const durationMs = Date.now() - start;
          const errorMsg = err instanceof Error ? err.message : "Poll failed";
          set((s) => ({
            asyncTaskStatus: "ERROR",
            asyncTaskError: errorMsg,
            isExecutingAsyncAction: false,
            history: s.history.map((e) =>
              e.id === historyId
                ? { ...e, error: errorMsg, taskStatus: "ERROR" as NangoAsyncActionStatus, durationMs }
                : e
            ),
          }));
        }
      };

      await poll();
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : "Failed to trigger async action";
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
        isAsync: true,
      };
      set((s) => ({
        asyncTaskError: errorMsg,
        asyncTaskStatus: "ERROR",
        isExecutingAsyncAction: false,
        history: [entry, ...s.history].slice(0, MAX_HISTORY),
      }));
    }
  },

  clearAsyncResult: () =>
    set({
      asyncTaskId: null,
      asyncTaskStatus: null,
      asyncTaskResult: null,
      asyncTaskError: null,
      asyncTaskRetryCount: 0,
      isExecutingAsyncAction: false,
    }),

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
  clearActionResult: () => set({ actionResult: null, actionError: null }),
  clearProxyResult: () =>
    set({
      proxyStatus: null,
      proxyHeaders: null,
      proxyData: null,
      proxyError: null,
    }),
}));
