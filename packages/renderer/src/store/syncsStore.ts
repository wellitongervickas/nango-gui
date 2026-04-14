import { create } from "zustand";
import type { NangoSyncRecord } from "@nango-gui/shared";

interface SyncsState {
  syncs: NangoSyncRecord[];
  isLoading: boolean;
  error: string | null;
  selectedConnectionId: string | null;
  selectedProviderConfigKey: string | null;
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

export const useSyncsStore = create<SyncsState>((set, get) => ({
  syncs: [],
  isLoading: false,
  error: null,
  selectedConnectionId: null,
  selectedProviderConfigKey: null,

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
        set({ error: res.error, isLoading: false });
        return;
      }
      set({ syncs: res.data, isLoading: false });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load syncs";
      set({ error: message, isLoading: false });
    }
  },

  triggerSync: async (providerConfigKey, syncName, connectionId, fullResync) => {
    const res = await window.nango.triggerSync({
      providerConfigKey,
      syncs: [syncName],
      connectionId,
      fullResync,
    });
    if (res.status === "error") throw new Error(res.error);
    // Optimistic: mark as RUNNING
    set((state) => ({
      syncs: state.syncs.map((s) =>
        s.name === syncName ? { ...s, status: "RUNNING" as const } : s
      ),
    }));
  },

  pauseSync: async (providerConfigKey, syncName, connectionId) => {
    // Optimistic: mark as PAUSED immediately
    set((state) => ({
      syncs: state.syncs.map((s) =>
        s.name === syncName ? { ...s, status: "PAUSED" as const } : s
      ),
    }));
    const res = await window.nango.pauseSync({
      providerConfigKey,
      syncs: [syncName],
      connectionId,
    });
    if (res.status === "error") {
      // Rollback on failure — refetch to get true state
      const { selectedConnectionId, selectedProviderConfigKey } = get();
      if (selectedConnectionId && selectedProviderConfigKey) {
        await get().fetchSyncs(selectedConnectionId, selectedProviderConfigKey);
      }
      throw new Error(res.error);
    }
  },

  startSync: async (providerConfigKey, syncName, connectionId) => {
    // Optimistic: mark as RUNNING immediately
    set((state) => ({
      syncs: state.syncs.map((s) =>
        s.name === syncName ? { ...s, status: "RUNNING" as const } : s
      ),
    }));
    const res = await window.nango.startSync({
      providerConfigKey,
      syncs: [syncName],
      connectionId,
    });
    if (res.status === "error") {
      // Rollback on failure — refetch to get true state
      const { selectedConnectionId, selectedProviderConfigKey } = get();
      if (selectedConnectionId && selectedProviderConfigKey) {
        await get().fetchSyncs(selectedConnectionId, selectedProviderConfigKey);
      }
      throw new Error(res.error);
    }
  },

  reset: () =>
    set({
      syncs: [],
      isLoading: false,
      error: null,
      selectedConnectionId: null,
      selectedProviderConfigKey: null,
    }),
}));
