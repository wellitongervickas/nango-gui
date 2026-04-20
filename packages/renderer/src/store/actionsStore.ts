import { create } from "zustand";
import type { AsyncActionStatus, NangoProxyMethod } from "@nango-gui/shared";
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
  /** True when this entry was triggered as an async action. */
  isAsync: boolean;
  /** Final async status — only set when isAsync is true. */
  asyncStatus: AsyncActionStatus | null;
  /** Number of automatic retries reported by Nango. */
  retryCount: number;
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
/** Polling interval for async action status (ms). */
const ASYNC_POLL_INTERVAL_MS = 2_000;

// ── Store interface ────────────────────────────────────────────────────────

interface ActionsState {
  // Sync action runner
  actionResult: unknown | null;
  isExecutingAction: boolean;
  actionError: string | null;

  // Async action runner
  asyncActionId: string | null;
  asyncActionStatusUrl: string | null;
  asyncActionStatus: AsyncActionStatus | null;
  asyncActionRetryCount: number;

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

export const useActionsStore = create<ActionsState>((set, get) => ({
  actionResult: null,
  isExecutingAction: false,
  actionError: null,

  asyncActionId: null,
  asyncActionStatusUrl: null,
  asyncActionStatus: null,
  asyncActionRetryCount: 0,

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
          isAsync: false,
          asyncStatus: null,
          retryCount: 0,
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
        isAsync: false,
        asyncStatus: null,
        retryCount: 0,
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
        isAsync: false,
        asyncStatus: null,
        retryCount: 0,
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
      isExecutingAction: true,
      actionError: null,
      actionResult: null,
      asyncActionId: null,
      asyncActionStatusUrl: null,
      asyncActionStatus: "pending",
      asyncActionRetryCount: 0,
    });
    const start = Date.now();

    try {
      // Step 1: trigger the async action — get back id + statusUrl
      const triggerRes = await window.nango.triggerActionAsync({
        integrationId,
        connectionId,
        actionName,
        input,
      });

      if (triggerRes.status === "error") {
        notifyIpcError(triggerRes);
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
          error: triggerRes.error,
          durationMs,
          isAsync: true,
          asyncStatus: "failed",
          retryCount: 0,
        };
        set((s) => ({
          actionError: triggerRes.error,
          isExecutingAction: false,
          asyncActionStatus: "failed",
          history: [entry, ...s.history].slice(0, MAX_HISTORY),
        }));
        return;
      }

      const { id, statusUrl } = triggerRes.data;
      set({ asyncActionId: id, asyncActionStatusUrl: statusUrl, asyncActionStatus: "pending" });

      // Step 2: poll until terminal status
      await new Promise<void>((resolve) => {
        const poll = async () => {
          // Guard: if the action was cleared while polling, stop
          const current = get();
          if (!current.isExecutingAction) {
            resolve();
            return;
          }

          try {
            const pollRes = await window.nango.getAsyncActionResult({ id, statusUrl });

            if (pollRes.status === "error") {
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
                error: pollRes.error,
                durationMs,
                isAsync: true,
                asyncStatus: "failed",
                retryCount: get().asyncActionRetryCount,
              };
              set((s) => ({
                actionError: pollRes.error,
                isExecutingAction: false,
                asyncActionStatus: "failed",
                history: [entry, ...s.history].slice(0, MAX_HISTORY),
              }));
              resolve();
              return;
            }

            const data = pollRes.data;
            const retryCount = data.retryCount ?? 0;
            set({ asyncActionStatus: data.status, asyncActionRetryCount: retryCount });

            if (data.status === "succeeded") {
              const durationMs = Date.now() - start;
              const entry: ActionHistoryEntry = {
                id: String(_nextId++),
                type: "action",
                timestamp: new Date().toISOString(),
                integrationId,
                connectionId,
                actionName,
                input,
                result: data.result ?? null,
                error: null,
                durationMs,
                isAsync: true,
                asyncStatus: "succeeded",
                retryCount,
              };
              set((s) => ({
                actionResult: data.result ?? null,
                isExecutingAction: false,
                asyncActionStatus: "succeeded",
                history: [entry, ...s.history].slice(0, MAX_HISTORY),
              }));
              resolve();
            } else if (data.status === "failed") {
              const durationMs = Date.now() - start;
              const errorMsg = data.error ?? "Async action failed";
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
                asyncStatus: "failed",
                retryCount,
              };
              set((s) => ({
                actionError: errorMsg,
                isExecutingAction: false,
                asyncActionStatus: "failed",
                history: [entry, ...s.history].slice(0, MAX_HISTORY),
              }));
              resolve();
            } else {
              // Still pending or running — continue polling
              setTimeout(poll, ASYNC_POLL_INTERVAL_MS);
            }
          } catch {
            // Network/IPC error during polling — retry
            setTimeout(poll, ASYNC_POLL_INTERVAL_MS);
          }
        };

        // First poll after a short delay (the action was just enqueued)
        setTimeout(poll, ASYNC_POLL_INTERVAL_MS);
      });
    } catch (err) {
      const durationMs = Date.now() - start;
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
        durationMs,
        isAsync: true,
        asyncStatus: "failed",
        retryCount: 0,
      };
      set((s) => ({
        actionError: errorMsg,
        isExecutingAction: false,
        asyncActionStatus: "failed",
        history: [entry, ...s.history].slice(0, MAX_HISTORY),
      }));
    }
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
  clearActionResult: () =>
    set({
      actionResult: null,
      actionError: null,
      asyncActionId: null,
      asyncActionStatusUrl: null,
      asyncActionStatus: null,
      asyncActionRetryCount: 0,
    }),
  clearProxyResult: () =>
    set({
      proxyStatus: null,
      proxyHeaders: null,
      proxyData: null,
      proxyError: null,
    }),
}));
