import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NangoDashboardData, IpcResponse } from "@nango-gui/shared";

// ── Mock data ──────────────────────────────────────────────────────────────

const mockDashboard: NangoDashboardData = {
  totalConnections: 3,
  activeConnections: 2,
  totalSyncs: 8,
  runningSyncs: 3,
  pausedSyncs: 2,
  errorSyncs: 1,
  recentErrors: [
    {
      syncName: "github-issues",
      connectionId: "user-1",
      providerConfigKey: "github",
      timestamp: "2026-04-14T12:00:00Z",
    },
  ],
  topConnections: [
    {
      id: 1,
      connectionId: "user-1",
      provider: "github",
      providerConfigKey: "github",
      syncCount: 4,
      lastActivity: "2026-04-14T12:00:00Z",
    },
    {
      id: 2,
      connectionId: "user-2",
      provider: "slack",
      providerConfigKey: "slack",
      syncCount: 3,
      lastActivity: "2026-04-14T11:00:00Z",
    },
  ],
};

// ── window.nango mock ───────────────────────────────────────────────────────

const mockGetDashboard = vi.fn(
  (): Promise<IpcResponse<NangoDashboardData>> =>
    Promise.resolve({ status: "ok", data: mockDashboard, error: null })
);

vi.stubGlobal("window", {
  nango: {
    getDashboard: mockGetDashboard,
  },
});

import { useDashboardStore } from "../store/dashboardStore.js";

beforeEach(() => {
  useDashboardStore.setState({
    dashboard: null,
    isLoading: false,
    error: null,
    lastRefreshedAt: null,
  });
  vi.clearAllMocks();
});

describe("useDashboardStore", () => {
  describe("fetchDashboard", () => {
    it("populates dashboard on success", async () => {
      await useDashboardStore.getState().fetchDashboard();
      const state = useDashboardStore.getState();
      expect(state.dashboard).toEqual(mockDashboard);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastRefreshedAt).toBeInstanceOf(Date);
    });

    it("calls window.nango.getDashboard", async () => {
      await useDashboardStore.getState().fetchDashboard();
      expect(mockGetDashboard).toHaveBeenCalledOnce();
    });

    it("sets isLoading to true during fetch", async () => {
      let loadingDuringFetch = false;
      mockGetDashboard.mockImplementationOnce(() => {
        loadingDuringFetch = useDashboardStore.getState().isLoading;
        return Promise.resolve({
          status: "ok" as const,
          data: mockDashboard,
          error: null,
        });
      });
      await useDashboardStore.getState().fetchDashboard();
      expect(loadingDuringFetch).toBe(true);
      expect(useDashboardStore.getState().isLoading).toBe(false);
    });

    it("sets error on IPC error response", async () => {
      mockGetDashboard.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "No credentials configured",
      });
      await useDashboardStore.getState().fetchDashboard();
      const state = useDashboardStore.getState();
      expect(state.error).toBe("No credentials configured");
      expect(state.dashboard).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it("sets error on thrown exception", async () => {
      mockGetDashboard.mockRejectedValueOnce(new Error("Network error"));
      await useDashboardStore.getState().fetchDashboard();
      const state = useDashboardStore.getState();
      expect(state.error).toBe("Network error");
      expect(state.dashboard).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it("sets generic error for non-Error exceptions", async () => {
      mockGetDashboard.mockRejectedValueOnce("string error");
      await useDashboardStore.getState().fetchDashboard();
      expect(useDashboardStore.getState().error).toBe(
        "Failed to load dashboard"
      );
    });

    it("updates lastRefreshedAt on success", async () => {
      const before = Date.now();
      await useDashboardStore.getState().fetchDashboard();
      const after = Date.now();
      const refreshedAt = useDashboardStore.getState().lastRefreshedAt!;
      expect(refreshedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(refreshedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it("does not update lastRefreshedAt on error", async () => {
      mockGetDashboard.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Unauthorized",
      });
      await useDashboardStore.getState().fetchDashboard();
      expect(useDashboardStore.getState().lastRefreshedAt).toBeNull();
    });
  });

  describe("refresh", () => {
    it("delegates to fetchDashboard", async () => {
      await useDashboardStore.getState().refresh();
      expect(mockGetDashboard).toHaveBeenCalledOnce();
      expect(useDashboardStore.getState().dashboard).toEqual(mockDashboard);
    });
  });
});
