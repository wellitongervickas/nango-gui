import { create } from "zustand";
import type { NangoProxyMethod } from "@nango-gui/shared";

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
  // Action runner
  actionResult: unknown | null;
  isExecutingAction: boolean;
  actionError: string | null;

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

export const useActionsStore = create<ActionsState>((set) => ({
  actionResult: null,
  isExecutingAction: false,
  actionError: null,

  proxyStatus: null,
  proxyHeaders: null,
  proxyData: null,
  isExecutingProxy: false,
  proxyError: null,

  history: [],

  triggerAction: async (integrationId, connectionId, actionName, input) => {
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

  sendProxyRequest: async (
    integrationId,
    connectionId,
    method,
    endpoint,
    opts
  ) => {
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
