import { create } from "zustand";
import type { NangoConnectionSummary } from "@nango-gui/shared";

interface ConnectionsState {
  connections: NangoConnectionSummary[];
  isLoading: boolean;
  error: string | null;
  fetchConnections: (integrationId?: string) => Promise<void>;
  addConnection: (connection: NangoConnectionSummary) => void;
  deleteConnection: (providerConfigKey: string, connectionId: string) => Promise<void>;
  reset: () => void;
}

export const useConnectionsStore = create<ConnectionsState>((set) => ({
  connections: [],
  isLoading: false,
  error: null,

  fetchConnections: async (integrationId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await window.nango.listConnections(
        integrationId ? { integrationId } : undefined
      );
      if (res.status === "error") {
        set({ error: res.error, isLoading: false });
        return;
      }
      set({ connections: res.data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load connections";
      set({ error: message, isLoading: false });
    }
  },

  addConnection: (connection) =>
    set((state) => ({
      connections: [
        ...state.connections.filter(
          (c) => c.connection_id !== connection.connection_id
        ),
        connection,
      ],
    })),

  deleteConnection: async (providerConfigKey, connectionId) => {
    const res = await window.nango.deleteConnection({ providerConfigKey, connectionId });
    if (res.status === "error") throw new Error(res.error);
    set((state) => ({
      connections: state.connections.filter(
        (c) => !(c.provider_config_key === providerConfigKey && c.connection_id === connectionId)
      ),
    }));
  },

  reset: () => set({ connections: [], isLoading: false, error: null }),
}));
