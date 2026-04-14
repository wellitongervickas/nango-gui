import { create } from "zustand";
import type { NangoSyncRecord, NangoSyncStatus } from "@nango-gui/shared";
import { notifyIpcError } from "./notifyError";

interface SyncsState {
  syncs: NangoSyncRecord[];
  isLoading: boolean;
  error: string | null;
  /** Per-sync loading flags keyed by sync name, prevents concurrent action races. */
  syncActionLoading: Record<string, boolean>;
  selectedConnectionId: string | null;
  selectedProviderConfigKey: string | null;
  /** Consecutive fetch error count for backoff. */
  fetchErrorCount: number;
  fetchSyncs: (connectionId: string, providerConfigKey: string) => Promise<void>;
  triggerSync: (
    providerConfigKey: string,
    syncName: string,
    connectionId: string,
    fullResync?: boolean
  ) => Promise<void>;
  pauseSync: (
    providerConfigKey: string,
    syncName: string,
    connectionId: string
  ) => Promise<void>;
  startSync: (
    providerConfigKey: string,
    syncName: string,
    connectionId: string
  ) => Promise<void>;
  reset: () => void;
}

/** Apply an optimistic status change and return the previous status for rollback. */
function optimisticUpdate(
  set: (fn: (state: SyncsState) => Partial<SyncsState>) => void,
  syncName: string,
  newStatus: NangoSyncStatus
): NangoSyncStatus | null {
  let previousStatus: NangoSyncStatus | null = null;
  set((state) => {
    const sync = state.syncs.find((s) => s.name === syncName);
    previousStatus = sync?.status ?? null;
    return {
      syncs: state.syncs.map((s) =>
        s.name === syncName ? { ...s, status: newStatus } : s
      ),
    };
  });
  return previousStatus;
}

/** Revert a sync back to its previous status. */
function rollback(
  set: (fn: (state: SyncsState) => Partial<SyncsState>) => void,
  syncName: string,
  previousStatus: NangoSyncStatus | null
) {
  if (previousStatus == null) return;
  set((state) => ({
    syncs: state.syncs.map((s) =>
      s.name === syncName ? { ...s, status: previousStatus } : s
    ),
  }));
}

export const useSyncsStore = create<SyncsState>((set, get) => ({
  syncs: [],
  isLoading: false,
  error: null,
  syncActionLoading: {},
  selectedConnectionId: null,
  selectedProviderConfigKey: null,
  fetchErrorCount: 0,

  fetchSyncs: async (connectionId, providerConfigKey) => {
    set({
      isLoading: true,
      error: null,
      selectedConnectionId: connectionId,
      selectedProviderConfigKey: providerConfigKey,
    });
    try {
      const res = await window.nango.listSyncs({
        connectionId,
        providerConfigKey,
      });
      if (res.status === "error") {
        notifyIpcError(res);
        set((state) => ({
          error: res.error,
          isLoading: false,
          fetchErrorCount: state.fetchErrorCount + 1,
        }));
        return;
      }
      set({ syncs: res.data, isLoading: false, fetchErrorCount: 0 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load syncs";
      set((state) => ({
        error: message,
        isLoading: false,
        fetchErrorCount: state.fetchErrorCount + 1,
      }));
    }
  },

  triggerSync: async (providerConfigKey, syncName, connectionId, fullResync) => {
    if (get().syncActionLoading[syncName]) return;
    set((state) => ({
      syncActionLoading: { ...state.syncActionLoading, [syncName]: true },
    }));
    const previousStatus = optimisticUpdate(set, syncName, "RUNNING");
    try {
      const res = await window.nango.triggerSync({
        providerConfigKey,
        syncs: [syncName],
        connectionId,
        fullResync,
      });
      if (res.status === "error") {
        rollback(set, syncName, previousStatus);
        throw new Error(res.error);
      }
    } catch (err) {
      rollback(set, syncName, previousStatus);
      throw err;
    } finally {
      set((state) => {
        const next = { ...state.syncActionLoading };
        delete next[syncName];
        return { syncActionLoading: next };
      });
    }
  },

  pauseSync: async (providerConfigKey, syncName, connectionId) => {
    if (get().syncActionLoading[syncName]) return;
    set((state) => ({
      syncActionLoading: { ...state.syncActionLoading, [syncName]: true },
    }));
    const previousStatus = optimisticUpdate(set, syncName, "PAUSED");
    try {
      const res = await window.nango.pauseSync({
        providerConfigKey,
        syncs: [syncName],
        connectionId,
      });
      if (res.status === "error") {
        rollback(set, syncName, previousStatus);
        throw new Error(res.error);
      }
    } catch (err) {
      rollback(set, syncName, previousStatus);
      throw err;
    } finally {
      set((state) => {
        const next = { ...state.syncActionLoading };
        delete next[syncName];
        return { syncActionLoading: next };
      });
    }
  },

  startSync: async (providerConfigKey, syncName, connectionId) => {
    if (get().syncActionLoading[syncName]) return;
    set((state) => ({
      syncActionLoading: { ...state.syncActionLoading, [syncName]: true },
    }));
    const previousStatus = optimisticUpdate(set, syncName, "RUNNING");
    try {
      const res = await window.nango.startSync({
        providerConfigKey,
        syncs: [syncName],
        connectionId,
      });
      if (res.status === "error") {
        rollback(set, syncName, previousStatus);
        throw new Error(res.error);
      }
    } catch (err) {
      rollback(set, syncName, previousStatus);
      throw err;
    } finally {
      set((state) => {
        const next = { ...state.syncActionLoading };
        delete next[syncName];
        return { syncActionLoading: next };
      });
    }
  },

  reset: () =>
    set({
      syncs: [],
      isLoading: false,
      error: null,
      syncActionLoading: {},
      selectedConnectionId: null,
      selectedProviderConfigKey: null,
      fetchErrorCount: 0,
    }),
}));
