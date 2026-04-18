import { create } from "zustand";
import type {
  NangoConnectionSummary,
  NangoConnectionHealthData,
  ConnectionStatus,
} from "@nango-gui/shared";
import { asyncFetch } from "./asyncFetch";

interface ConnectionsState {
  connections: NangoConnectionSummary[];
  isLoading: boolean;
  error: string | null;
  /** Health data keyed by "providerConfigKey:connectionId". */
  healthData: Record<string, NangoConnectionHealthData>;
  /** Set of keys currently being fetched to prevent duplicate requests. */
  healthFetching: Set<string>;
  /** Active status filter. null = show all. */
  statusFilter: ConnectionStatus | null;

  fetchConnections: (integrationId?: string) => Promise<void>;
  addConnection: (connection: NangoConnectionSummary) => void;
  deleteConnection: (providerConfigKey: string, connectionId: string) => Promise<void>;
  fetchConnectionHealth: (providerConfigKey: string, connectionId: string) => Promise<void>;
  setStatusFilter: (status: ConnectionStatus | null) => void;
  reset: () => void;
}

function healthKey(providerConfigKey: string, connectionId: string): string {
  return `${providerConfigKey}:${connectionId}`;
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  connections: [],
  isLoading: false,
  error: null,
  healthData: {},
  healthFetching: new Set(),
  statusFilter: null,

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
    const key = healthKey(providerConfigKey, connectionId);
    set((state) => {
      const newHealthData = { ...state.healthData };
      delete newHealthData[key];
      return {
        connections: state.connections.filter(
          (c) => !(c.provider_config_key === providerConfigKey && c.connection_id === connectionId)
        ),
        healthData: newHealthData,
      };
    });
  },

  fetchConnectionHealth: async (providerConfigKey, connectionId) => {
    const key = healthKey(providerConfigKey, connectionId);
    const state = get();

    // Skip if already cached or currently fetching
    if (state.healthData[key] || state.healthFetching.has(key)) return;

    // Mark as fetching
    set((s) => {
      const next = new Set(s.healthFetching);
      next.add(key);
      return { healthFetching: next };
    });

    try {
      const res = await window.nango.getConnectionHealth({ providerConfigKey, connectionId });
      if (res.status === "ok") {
        set((s) => ({
          healthData: { ...s.healthData, [key]: res.data },
        }));
      }
    } catch {
      // Silently fail — health data is supplementary
    } finally {
      set((s) => {
        const next = new Set(s.healthFetching);
        next.delete(key);
        return { healthFetching: next };
      });
    }
  },

  setStatusFilter: (status) => set({ statusFilter: status }),

  reset: () =>
    set({
      connections: [],
      isLoading: false,
      error: null,
      healthData: {},
      healthFetching: new Set(),
      statusFilter: null,
    }),
}));
