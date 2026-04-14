import { create } from "zustand";
import type { NangoDashboardData } from "@nango-gui/shared";
import { notifyIpcError } from "./notifyError";

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
    set({ isLoading: true, error: null });
    try {
      const res = await window.nango.getDashboard();
      if (res.status === "error") {
        notifyIpcError(res);
        set({ error: res.error, isLoading: false });
        return;
      }
      set({
        dashboard: res.data,
        isLoading: false,
        lastRefreshedAt: new Date(),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard";
      set({ error: message, isLoading: false });
    }
  },

  refresh: async () => {
    await get().fetchDashboard();
  },
}));
