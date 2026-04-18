import { create } from "zustand";
import type { NangoProvider } from "@nango-gui/shared";
import { asyncFetch } from "./asyncFetch";

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
    await asyncFetch(
      set,
      () => window.nango?.listProviders(),
      (data) => ({ providers: data }),
      "Failed to load providers",
    );
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
