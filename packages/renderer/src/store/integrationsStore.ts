import { create } from "zustand";
import type {
  NangoCreateIntegrationRequest,
  NangoIntegration,
  NangoIntegrationSummary,
  NangoProvider,
  NangoUpdateIntegrationRequest,
} from "@nango-gui/shared";
import { asyncFetch } from "./asyncFetch";
import { notifyIpcError } from "./notifyError";

interface IntegrationsState {
  /** Catalog of all available providers (used by Connect / AI Builder flows). */
  providers: NangoProvider[];
  /** Configured integrations on the user's Nango account. */
  integrations: NangoIntegrationSummary[];
  isLoading: boolean;
  error: string | null;
  search: string;
  activeCategory: string | null;

  fetchProviders: () => Promise<void>;
  fetchIntegrations: () => Promise<void>;
  /** Fetch a single integration with credentials + webhook included for the detail view. */
  getIntegration: (uniqueKey: string) => Promise<NangoIntegration | null>;
  createIntegration: (
    args: NangoCreateIntegrationRequest
  ) => Promise<NangoIntegration | null>;
  updateIntegration: (
    args: NangoUpdateIntegrationRequest
  ) => Promise<NangoIntegration | null>;
  deleteIntegration: (uniqueKey: string) => Promise<boolean>;

  setSearch: (search: string) => void;
  setActiveCategory: (category: string | null) => void;
  filteredProviders: () => NangoProvider[];
  /** Filtered configured integrations using the same search input. */
  filteredIntegrations: () => NangoIntegrationSummary[];
}

export const useIntegrationsStore = create<IntegrationsState>((set, get) => ({
  providers: [],
  integrations: [],
  isLoading: false,
  error: null,
  search: "",
  activeCategory: null,

  fetchProviders: async () => {
    await asyncFetch(
      set,
      () => window.nango?.listProviders(),
      (data) => ({ providers: data }),
      "Failed to load providers",
    );
  },

  fetchIntegrations: async () => {
    await asyncFetch(
      set,
      () => window.nango?.listIntegrations(),
      (data) => ({ integrations: data }),
      "Failed to load integrations",
    );
  },

  getIntegration: async (uniqueKey) => {
    const res = await window.nango?.getIntegration({
      uniqueKey,
      include: ["credentials", "webhook"],
    });
    if (!res) return null;
    if (res.status === "error") {
      notifyIpcError(res);
      set({ error: res.error });
      return null;
    }
    return res.data;
  },

  createIntegration: async (args) => {
    const res = await window.nango?.createIntegration(args);
    if (!res) return null;
    if (res.status === "error") {
      notifyIpcError(res);
      set({ error: res.error });
      return null;
    }
    // Refresh list so the new row appears immediately.
    await get().fetchIntegrations();
    return res.data;
  },

  updateIntegration: async (args) => {
    const res = await window.nango?.updateIntegration(args);
    if (!res) return null;
    if (res.status === "error") {
      notifyIpcError(res);
      set({ error: res.error });
      return null;
    }
    // Patch the cached row in place so the list view reflects the change without
    // a round-trip; full refresh follows for connection-count sync.
    const updated = res.data;
    set((state) => ({
      integrations: state.integrations.map((i) =>
        i.unique_key === args.uniqueKey
          ? {
              ...i,
              unique_key: updated.unique_key,
              display_name: updated.display_name,
              forward_webhooks: updated.forward_webhooks,
              updated_at: updated.updated_at,
            }
          : i,
      ),
    }));
    return updated;
  },

  deleteIntegration: async (uniqueKey) => {
    const res = await window.nango?.deleteIntegration({ uniqueKey });
    if (!res) return false;
    if (res.status === "error") {
      notifyIpcError(res);
      set({ error: res.error });
      return false;
    }
    set((state) => ({
      integrations: state.integrations.filter(
        (i) => i.unique_key !== uniqueKey,
      ),
    }));
    return true;
  },

  setSearch: (search) => set({ search }),
  setActiveCategory: (activeCategory) => set({ activeCategory }),

  filteredProviders: () => {
    const { providers, search, activeCategory } = get();
    const q = search.toLowerCase().trim();
    return providers.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.display_name.toLowerCase().includes(q) ||
        p.categories?.some((c) => c.toLowerCase().includes(q));
      const matchesCategory =
        !activeCategory || p.categories?.includes(activeCategory);
      return matchesSearch && matchesCategory;
    });
  },

  filteredIntegrations: () => {
    const { integrations, search } = get();
    const q = search.toLowerCase().trim();
    if (!q) return integrations;
    return integrations.filter(
      (i) =>
        i.unique_key.toLowerCase().includes(q) ||
        i.display_name.toLowerCase().includes(q) ||
        i.provider.toLowerCase().includes(q),
    );
  },
}));
