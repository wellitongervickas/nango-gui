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
    recordCount: { Issue: 120 },
    checkpoint: { lastPage: 5, lastCursor: "abc123" },
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
    recordCount: null,
    checkpoint: null,
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
    syncActionLoading: {},
    selectedConnectionId: null,
    selectedProviderConfigKey: null,
    fetchErrorCount: 0,
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

    it("sets error and increments fetchErrorCount on API failure", async () => {
      mockListSyncs.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Unauthorized",
        errorCode: "UNKNOWN",
      });
      await useSyncsStore.getState().fetchSyncs("user-1", "github");
      expect(useSyncsStore.getState().error).toBe("Unauthorized");
      expect(useSyncsStore.getState().syncs).toEqual([]);
      expect(useSyncsStore.getState().fetchErrorCount).toBe(1);
    });

    it("resets fetchErrorCount on success", async () => {
      useSyncsStore.setState({ fetchErrorCount: 3 });
      await useSyncsStore.getState().fetchSyncs("user-1", "github");
      expect(useSyncsStore.getState().fetchErrorCount).toBe(0);
    });

    it("increments fetchErrorCount on thrown exception", async () => {
      mockListSyncs.mockRejectedValueOnce(new Error("Network error"));
      await useSyncsStore.getState().fetchSyncs("user-1", "github");
      expect(useSyncsStore.getState().error).toBe("Network error");
      expect(useSyncsStore.getState().fetchErrorCount).toBe(1);
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

    it("rolls back to previous status on API error", async () => {
      mockTriggerSync.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Sync failed",
        errorCode: "UNKNOWN",
      });
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await expect(
        useSyncsStore.getState().triggerSync("github", "github-issues", "user-1")
      ).rejects.toThrow("Sync failed");
      // Should roll back to original status
      const sync = useSyncsStore.getState().syncs.find((s) => s.name === "github-issues");
      expect(sync?.status).toBe("SUCCESS");
    });

    it("clears syncActionLoading after completion", async () => {
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await useSyncsStore.getState().triggerSync("github", "github-issues", "user-1");
      expect(useSyncsStore.getState().syncActionLoading["github-issues"]).toBeUndefined();
    });

    it("skips if sync already has action loading", async () => {
      useSyncsStore.setState({
        syncs: [...mockSyncs],
        syncActionLoading: { "github-issues": true },
      });
      await useSyncsStore.getState().triggerSync("github", "github-issues", "user-1");
      expect(mockTriggerSync).not.toHaveBeenCalled();
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

    it("rolls back to previous status on API error", async () => {
      mockPauseSync.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Pause failed",
        errorCode: "UNKNOWN",
      });
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await expect(
        useSyncsStore.getState().pauseSync("github", "github-issues", "user-1")
      ).rejects.toThrow("Pause failed");
      const sync = useSyncsStore.getState().syncs.find((s) => s.name === "github-issues");
      expect(sync?.status).toBe("SUCCESS");
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

    it("rolls back to previous status on API error", async () => {
      mockStartSync.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Start failed",
        errorCode: "UNKNOWN",
      });
      useSyncsStore.setState({ syncs: [...mockSyncs] });
      await expect(
        useSyncsStore.getState().startSync("github", "github-pull-requests", "user-1")
      ).rejects.toThrow("Start failed");
      const sync = useSyncsStore.getState().syncs.find((s) => s.name === "github-pull-requests");
      expect(sync?.status).toBe("PAUSED");
    });
  });

  describe("reset", () => {
    it("clears all state", () => {
      useSyncsStore.setState({
        syncs: [...mockSyncs],
        isLoading: true,
        error: "some error",
        syncActionLoading: { "github-issues": true },
        selectedConnectionId: "user-1",
        selectedProviderConfigKey: "github",
        fetchErrorCount: 3,
      });
      useSyncsStore.getState().reset();
      const state = useSyncsStore.getState();
      expect(state.syncs).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.syncActionLoading).toEqual({});
      expect(state.selectedConnectionId).toBeNull();
      expect(state.selectedProviderConfigKey).toBeNull();
      expect(state.fetchErrorCount).toBe(0);
    });
  });
});
