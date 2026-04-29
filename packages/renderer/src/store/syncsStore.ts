import { create } from "zustand";
import type {
  NangoBulkUpdateSyncScheduleEntry,
  NangoBulkUpdateSyncScheduleResult,
  NangoSyncRecord,
  NangoSyncStatus,
} from "@nango-gui/shared";
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
  updateSyncFrequency: (
    providerConfigKey: string,
    syncName: string,
    connectionId: string,
    frequency: string | null
  ) => Promise<void>;
  /**
   * Apply schedule (frequency) updates to several syncs in one round-trip.
   * Returns the per-entry result so callers can surface partial failures.
   * On error entries the local state is rolled back to the prior frequency.
   */
  bulkUpdateSyncSchedule: (
    providerConfigKey: string,
    connectionId: string,
    entries: NangoBulkUpdateSyncScheduleEntry[]
  ) => Promise<NangoBulkUpdateSyncScheduleResult>;
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
    if (!window.nango) return;
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
    if (!window.nango || get().syncActionLoading[syncName]) return;
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
    if (!window.nango || get().syncActionLoading[syncName]) return;
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
    if (!window.nango || get().syncActionLoading[syncName]) return;
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

  updateSyncFrequency: async (providerConfigKey, syncName, connectionId, frequency) => {
    if (!window.nango || get().syncActionLoading[syncName]) return;
    set((state) => ({
      syncActionLoading: { ...state.syncActionLoading, [syncName]: true },
    }));
    const previousFrequency = get().syncs.find((s) => s.name === syncName)?.frequency ?? null;
    set((state) => ({
      syncs: state.syncs.map((s) =>
        s.name === syncName ? { ...s, frequency } : s
      ),
    }));
    try {
      const res = await window.nango.updateSyncFrequency({
        providerConfigKey,
        syncName,
        connectionId,
        frequency,
      });
      if (res.status === "error") {
        set((state) => ({
          syncs: state.syncs.map((s) =>
            s.name === syncName ? { ...s, frequency: previousFrequency } : s
          ),
        }));
        notifyIpcError(res);
        throw new Error(res.error);
      }
      set((state) => ({
        syncs: state.syncs.map((s) =>
          s.name === syncName ? { ...s, frequency: res.data.frequency } : s
        ),
      }));
    } catch (err) {
      set((state) => ({
        syncs: state.syncs.map((s) =>
          s.name === syncName ? { ...s, frequency: previousFrequency } : s
        ),
      }));
      throw err;
    } finally {
      set((state) => {
        const next = { ...state.syncActionLoading };
        delete next[syncName];
        return { syncActionLoading: next };
      });
    }
  },

  bulkUpdateSyncSchedule: async (providerConfigKey, connectionId, entries) => {
    if (!window.nango) {
      return { results: [], allSucceeded: false };
    }
    if (entries.length === 0) {
      return { results: [], allSucceeded: true };
    }

    // Snapshot prior frequencies so we can roll back individual entries
    // whose underlying call fails. We also mark each touched sync as loading
    // to keep per-row UI affordances consistent with the single-sync path.
    const snapshot = new Map<string, string | null>();
    for (const entry of entries) {
      const current = get().syncs.find((s) => s.name === entry.syncName);
      snapshot.set(entry.syncName, current?.frequency ?? null);
    }

    set((state) => {
      const nextLoading = { ...state.syncActionLoading };
      for (const entry of entries) nextLoading[entry.syncName] = true;
      return {
        syncActionLoading: nextLoading,
        syncs: state.syncs.map((s) => {
          const match = entries.find((e) => e.syncName === s.name);
          return match ? { ...s, frequency: match.frequency } : s;
        }),
      };
    });

    try {
      const res = await window.nango.bulkUpdateSyncSchedule({
        providerConfigKey,
        connectionId,
        entries,
      });

      if (res.status === "error") {
        // Whole-batch failure: roll every touched sync back to its snapshot.
        set((state) => ({
          syncs: state.syncs.map((s) =>
            snapshot.has(s.name)
              ? { ...s, frequency: snapshot.get(s.name) ?? null }
              : s
          ),
        }));
        notifyIpcError(res);
        throw new Error(res.error);
      }

      // Reconcile per-entry: apply server-confirmed frequency on success,
      // roll back to snapshot on per-entry failure. Surfaces partial failures
      // through the returned result without throwing.
      set((state) => ({
        syncs: state.syncs.map((s) => {
          const entryResult = res.data.results.find((r) => r.syncName === s.name);
          if (!entryResult) return s;
          if (entryResult.status === "ok") {
            return { ...s, frequency: entryResult.frequency };
          }
          return { ...s, frequency: snapshot.get(s.name) ?? null };
        }),
      }));

      return res.data;
    } finally {
      set((state) => {
        const nextLoading = { ...state.syncActionLoading };
        for (const entry of entries) delete nextLoading[entry.syncName];
        return { syncActionLoading: nextLoading };
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
