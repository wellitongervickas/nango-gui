import { create } from "zustand";
import type { NangoProvider } from "@nango-gui/shared";

interface IntegrationsState {
  providers: NangoProvider[];
  isLoading: boolean;
  error: string | null;
  search: string;
  activeCategory: string | null;
  fetchProviders: () => Promise<void>;
  setSearch: (search: string) => void;
  setActiveCategory: (category: string | null) => void;
  filteredProviders: () => NangoProvider[];
}

export const useIntegrationsStore = create<IntegrationsState>((set, get) => ({
  providers: [],
  isLoading: false,
  error: null,
  search: "",
  activeCategory: null,

  fetchProviders: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await window.nango.listProviders();
      if (res.status === "error") {
        set({ error: res.error, isLoading: false });
        return;
      }
      set({ providers: res.data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load providers";
      set({ error: message, isLoading: false });
    }
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
}));
