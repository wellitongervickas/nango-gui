import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NangoSyncRecord, IpcResponse } from "@nango-gui/shared";

// ── Mock data ──────────────────────────────────────────────────────────────

const mockSyncs: NangoSyncRecord[] = [
  {
    id: "sync-1",
    name: "github-issues",
    status: "SUCCESS",
    type: "INCREMENTAL",
    frequency: "every 30min",
    finishedAt: "2026-04-14T10:00:00Z",
    nextScheduledSyncAt: "2026-04-14T10:30:00Z",
    latestResult: { added: 10, updated: 2, deleted: 0 },
  },
  {
    id: "sync-2",
    name: "github-pull-requests",
    status: "PAUSED",
    type: "FULL",
    frequency: "every 1h",
    finishedAt: "2026-04-14T09:00:00Z",
    nextScheduledSyncAt: null,
    latestResult: null,
  },
];

// ── window.nango mock ───────────────────────────────────────────────────────

const mockListSyncs = vi.fn(
  (): Promise<IpcResponse<NangoSyncRecord[]>> =>
    Promise.resolve({ status: "ok", data: mockSyncs, error: null })
);

const mockTriggerSync = vi.fn(
  (): Promise<IpcResponse<void>> =>
    Promise.resolve({ status: "ok", data: undefined, error: null })
);

const mockPauseSync = vi.fn(
  (): Promise<IpcResponse<void>> =>
    Promise.resolve({ status: "ok", data: undefined, error: null })
);

const mockStartSync = vi.fn(
  (): Promise<IpcResponse<void>> =>
    Promise.resolve({ status: "ok", data: undefined, error: null })
);

vi.stubGlobal("window", {
  nango: {
    listSyncs: mockListSyncs,
    triggerSync: mockTriggerSync,
    pauseSync: mockPauseSync,
    startSync: mockStartSync,
  },
});

import { useSyncsStore } from "../store/syncsStore.js";

beforeEach(() => {
  useSyncsStore.setState({
    syncs: [],
    isLoading: false,
    error: null,
    selectedConnectionId: null,
    selectedProviderConfigKey: null,
  });
  vi.clearAllMocks();
});

describe("useSyncsStore", () => {
  describe("fetchSyncs", () => {
    it("populates syncs on success", async () => {
      await useSyncsStore.getState().fetchSyncs("user-1", "github");
      expect(useSyncsStore.getState().syncs).toEqual(mockSyncs);
      expect(useSyncsStore.getState().isLoading).toBe(false);
      expect(useSyncsStore.getState().error).toBeNull();
    });

    it("sets selectedConnectionId and selectedProviderConfigKey", async () => {
      await useSyncsStore.getState().fetchSyncs("user-1", "github");
      expect(useSyncsStore.getState().selectedConnectionId).toBe("user-1");
      expect(useSyncsStore.getState().selectedProviderConfigKey).toBe("github");
    });

    it("calls window.nango.listSyncs with correct args", async () => {
      await useSyncsStore.getState().fetchSyncs("user-1", "github");
      expect(mockListSyncs).toHaveBeenCalledWith({
        connectionId: "user-1",
        providerConfigKey: "github",
      });
    });

    it("sets error on API failure", async () => {
      mockListSyncs.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Unauthorized",
      });
      await useSyncsStore.getState().fetchSyncs("user-1", "github");
      expect(useSyncsStore.getState().error).toBe("Unauthorized");
      expect(useSyncsStore.getState().syncs).toEqual([]);
    });

    it("sets error on thrown exception", async () => {
      mockListSyncs.mockRejectedValueOnce(new Error("Network error"));
      await useSyncsStore.getState().fetchSyncs("user-1", "github");
      expect(useSyncsStore.getState().error).toBe("Network error");
    });
  });

  describe("triggerSync", () => {
    it("calls window.nango.triggerSync with correct args", async () => {
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await useSyncsStore.getState().triggerSync("github", "github-issues", "user-1");
      expect(mockTriggerSync).toHaveBeenCalledWith({
        providerConfigKey: "github",
        syncs: ["github-issues"],
        connectionId: "user-1",
        fullResync: undefined,
      });
    });

    it("optimistically sets status to RUNNING", async () => {
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await useSyncsStore.getState().triggerSync("github", "github-issues", "user-1");
      const sync = useSyncsStore.getState().syncs.find((s) => s.name === "github-issues");
      expect(sync?.status).toBe("RUNNING");
    });

    it("passes fullResync flag", async () => {
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await useSyncsStore.getState().triggerSync("github", "github-issues", "user-1", true);
      expect(mockTriggerSync).toHaveBeenCalledWith({
        providerConfigKey: "github",
        syncs: ["github-issues"],
        connectionId: "user-1",
        fullResync: true,
      });
    });

    it("throws on API error", async () => {
      mockTriggerSync.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Sync failed",
      });
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await expect(
        useSyncsStore.getState().triggerSync("github", "github-issues", "user-1")
      ).rejects.toThrow("Sync failed");
    });
  });

  describe("pauseSync", () => {
    it("optimistically sets status to PAUSED", async () => {
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await useSyncsStore.getState().pauseSync("github", "github-issues", "user-1");
      const sync = useSyncsStore.getState().syncs.find((s) => s.name === "github-issues");
      expect(sync?.status).toBe("PAUSED");
    });

    it("calls window.nango.pauseSync with correct args", async () => {
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await useSyncsStore.getState().pauseSync("github", "github-issues", "user-1");
      expect(mockPauseSync).toHaveBeenCalledWith({
        providerConfigKey: "github",
        syncs: ["github-issues"],
        connectionId: "user-1",
      });
    });

    it("rolls back on API error by refetching", async () => {
      mockPauseSync.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Pause failed",
      });
      useSyncsStore.setState({
        syncs: [...mockSyncs],
        selectedConnectionId: "user-1",
        selectedProviderConfigKey: "github",
      });
      await expect(
        useSyncsStore.getState().pauseSync("github", "github-issues", "user-1")
      ).rejects.toThrow("Pause failed");
      // Should have called listSyncs to refetch
      expect(mockListSyncs).toHaveBeenCalled();
    });
  });

  describe("startSync", () => {
    it("optimistically sets status to RUNNING", async () => {
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await useSyncsStore.getState().startSync("github", "github-pull-requests", "user-1");
      const sync = useSyncsStore.getState().syncs.find((s) => s.name === "github-pull-requests");
      expect(sync?.status).toBe("RUNNING");
    });

    it("calls window.nango.startSync with correct args", async () => {
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await useSyncsStore.getState().startSync("github", "github-pull-requests", "user-1");
      expect(mockStartSync).toHaveBeenCalledWith({
        providerConfigKey: "github",
        syncs: ["github-pull-requests"],
        connectionId: "user-1",
      });
    });

    it("rolls back on API error by refetching", async () => {
      mockStartSync.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Start failed",
      });
      useSyncsStore.setState({
        syncs: [...mockSyncs],
        selectedConnectionId: "user-1",
        selectedProviderConfigKey: "github",
      });
      await expect(
        useSyncsStore.getState().startSync("github", "github-pull-requests", "user-1")
      ).rejects.toThrow("Start failed");
      expect(mockListSyncs).toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      useSyncsStore.setState({
        syncs: [...mockSyncs],
        isLoading: true,
        error: "some error",
        selectedConnectionId: "user-1",
        selectedProviderConfigKey: "github",
      });
      useSyncsStore.getState().reset();
      const state = useSyncsStore.getState();
      expect(state.syncs).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedConnectionId).toBeNull();
      expect(state.selectedProviderConfigKey).toBeNull();
    });
  });
});
