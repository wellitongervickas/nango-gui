import { create } from "zustand";
import type { NangoProvider, NangoConnectionSummary } from "@nango-gui/shared";

const ENABLED_KEY = "nango-mcp-enabled-tools";

function loadEnabledFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed as string[]);
  } catch {
    // ignore
  }
  return new Set();
}

function saveEnabledToStorage(enabled: Set<string>): void {
  try {
    localStorage.setItem(ENABLED_KEY, JSON.stringify([...enabled]));
  } catch {
    // ignore
  }
}

export interface NangoMcpToolState {
  provider: NangoProvider;
  /** Whether this provider is enabled as an MCP tool. */
  enabled: boolean;
  /** Connection IDs using this provider (populated from connections list). */
  connections: NangoConnectionSummary[];
}

interface NangoMcpState {
  tools: NangoMcpToolState[];
  isLoading: boolean;
  error: string | null;
  search: string;
  filterConnected: boolean;

  fetchTools: () => Promise<void>;
  toggleTool: (providerName: string) => void;
  enableAll: () => void;
  disableAll: () => void;
  setSearch: (q: string) => void;
  setFilterConnected: (v: boolean) => void;
  filteredTools: () => NangoMcpToolState[];
}

export const useNangoMcpStore = create<NangoMcpState>((set, get) => ({
  tools: [],
  isLoading: false,
  error: null,
  search: "",
  filterConnected: false,

  fetchTools: async () => {
    if (!window.nango) return;
    set({ isLoading: true, error: null });
    try {
      const [providersRes, connectionsRes] = await Promise.all([
        window.nango.listProviders(),
        window.nango.listConnections(),
      ]);

      if (providersRes.status === "error") {
        set({ error: providersRes.error, isLoading: false });
        return;
      }

      const connections: NangoConnectionSummary[] =
        connectionsRes.status === "ok" ? connectionsRes.data : [];

      const enabled = loadEnabledFromStorage();

      const tools: NangoMcpToolState[] = providersRes.data.map((provider) => ({
        provider,
        enabled: enabled.has(provider.name),
        connections: connections.filter((c) => c.provider === provider.name),
      }));

      set({ tools, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load MCP tools",
        isLoading: false,
      });
    }
  },

  toggleTool: (providerName) => {
    const enabled = loadEnabledFromStorage();
    if (enabled.has(providerName)) {
      enabled.delete(providerName);
    } else {
      enabled.add(providerName);
    }
    saveEnabledToStorage(enabled);
    set((s) => ({
      tools: s.tools.map((t) =>
        t.provider.name === providerName ? { ...t, enabled: enabled.has(providerName) } : t
      ),
    }));
  },

  enableAll: () => {
    const { tools } = get();
    const enabled = new Set(tools.map((t) => t.provider.name));
    saveEnabledToStorage(enabled);
    set({ tools: tools.map((t) => ({ ...t, enabled: true })) });
  },

  disableAll: () => {
    saveEnabledToStorage(new Set());
    set((s) => ({ tools: s.tools.map((t) => ({ ...t, enabled: false })) }));
  },

  setSearch: (search) => set({ search }),
  setFilterConnected: (filterConnected) => set({ filterConnected }),

  filteredTools: () => {
    const { tools, search, filterConnected } = get();
    const q = search.toLowerCase().trim();
    return tools.filter((t) => {
      if (filterConnected && t.connections.length === 0) return false;
      if (!q) return true;
      return (
        t.provider.name.toLowerCase().includes(q) ||
        t.provider.display_name.toLowerCase().includes(q) ||
        t.provider.categories?.some((c) => c.toLowerCase().includes(q))
      );
    });
  },
}));
