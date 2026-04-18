import { create } from "zustand";
import type { NangoConnectionSummary } from "@nango-gui/shared";
import { asyncFetch } from "./asyncFetch";

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
    await asyncFetch(
      set,
      () => window.nango?.listConnections(integrationId ? { integrationId } : undefined),
      (data) => ({ connections: data }),
      "Failed to load connections",
    );
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
    if (!window.nango) return;
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
