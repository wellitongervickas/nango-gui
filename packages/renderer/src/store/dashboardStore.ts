import { create } from "zustand";
import type { NangoDashboardData } from "@nango-gui/shared";
import { asyncFetch } from "./asyncFetch";

interface DashboardState {
  dashboard: NangoDashboardData | null;
  isLoading: boolean;
  error: string | null;
  lastRefreshedAt: Date | null;
  fetchDashboard: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  dashboard: null,
  isLoading: false,
  error: null,
  lastRefreshedAt: null,

  fetchDashboard: async () => {
    await asyncFetch(
      set,
      () => window.nango.getDashboard(),
      (data) => ({ dashboard: data, lastRefreshedAt: new Date() }),
      "Failed to load dashboard",
    );
  },

  refresh: async () => {
    await get().fetchDashboard();
  },
}));
