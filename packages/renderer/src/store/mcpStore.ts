import { create } from "zustand";
import type { McpServerState, McpStatusChangedEvent } from "@nango-gui/shared";

interface McpState {
  configs: McpServerState[];
  configFiles: string[];
  selectedServer: string | null;
  isLoading: boolean;
  error: string | null;

  fetchConfigs: () => Promise<void>;
  addConfig: (
    name: string,
    command: string,
    args: string[],
    env?: Record<string, string>
  ) => Promise<void>;
  removeConfig: (name: string) => Promise<void>;
  startServer: (name: string) => Promise<void>;
  stopServer: (name: string) => Promise<void>;
  selectServer: (name: string | null) => void;
  handleStatusChange: (event: McpStatusChangedEvent) => void;
}

export const useMcpStore = create<McpState>((set, get) => ({
  configs: [],
  configFiles: [],
  selectedServer: null,
  isLoading: false,
  error: null,

  fetchConfigs: async () => {
    if (!window.mcp) return;
    set({ isLoading: true, error: null });
    try {
      const res = await window.mcp.listConfigs();
      if (res.status === "error") {
        set({ error: res.error, isLoading: false });
        return;
      }
      set({ configs: res.data.servers, configFiles: res.data.configFiles, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load MCP servers", isLoading: false });
    }
  },

  addConfig: async (name, command, args, env) => {
    if (!window.mcp) return;
    const res = await window.mcp.addConfig({ name, command, args, env });
    if (res.status === "error") throw new Error(res.error);
    await get().fetchConfigs();
  },

  removeConfig: async (name) => {
    if (!window.mcp) return;
    const res = await window.mcp.removeConfig({ name });
    if (res.status === "error") throw new Error(res.error);
    set((s) => ({
      configs: s.configs.filter((c) => c.config.name !== name),
      selectedServer: s.selectedServer === name ? null : s.selectedServer,
    }));
  },

  startServer: async (name) => {
    if (!window.mcp) return;
    const res = await window.mcp.start({ name });
    if (res.status === "error") throw new Error(res.error);
  },

  stopServer: async (name) => {
    if (!window.mcp) return;
    const res = await window.mcp.stop({ name });
    if (res.status === "error") throw new Error(res.error);
  },

  selectServer: (name) => set({ selectedServer: name }),

  handleStatusChange: (event) => {
    set((s) => ({
      configs: s.configs.map((c) =>
        c.config.name === event.name
          ? { ...c, status: event.status, pid: event.pid, error: event.error, updatedAt: new Date().toISOString() }
          : c
      ),
    }));
  },
}));
