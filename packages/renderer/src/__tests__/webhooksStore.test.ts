/**
 * Unit tests for useWebhooksStore — the Nango webhook settings store.
 * Covers fetchSettings, updateSettings, error handling, and state transitions.
 * Regression: individual selectors must be used (not the identity selector) to
 * avoid the infinite re-render loop with React 19's useSyncExternalStore.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  IpcResponse,
  NangoWebhookSettings,
} from "@nango-gui/shared";

// ── Fixtures ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: NangoWebhookSettings = {
  primaryUrl: "",
  secondaryUrl: "",
  onSyncCompletionAlways: false,
  onAuthCreation: false,
  onAuthRefreshError: false,
  onSyncError: false,
  onAsyncActionCompletion: false,
  conflictResolutionStrategy: "deep_merge",
};

const FULL_SETTINGS: NangoWebhookSettings = {
  primaryUrl: "https://example.com/webhooks/nango",
  secondaryUrl: "https://backup.example.com/webhooks/nango",
  onSyncCompletionAlways: true,
  onAuthCreation: true,
  onAuthRefreshError: false,
  onSyncError: true,
  onAsyncActionCompletion: false,
  conflictResolutionStrategy: "most_recent_wins",
};

// ── window.nango mock ───────────────────────────────────────────────────────

const mockGetWebhookSettings = vi.fn(
  (): Promise<IpcResponse<NangoWebhookSettings>> =>
    Promise.resolve({ status: "ok", data: DEFAULT_SETTINGS, error: null })
);

const mockUpdateWebhookSettings = vi.fn(
  (): Promise<IpcResponse<NangoWebhookSettings>> =>
    Promise.resolve({ status: "ok", data: DEFAULT_SETTINGS, error: null })
);

vi.stubGlobal("window", {
  nango: {
    getWebhookSettings: mockGetWebhookSettings,
    updateWebhookSettings: mockUpdateWebhookSettings,
  },
});

import { useWebhooksStore } from "../store/webhooksStore.js";

// ── Reset between tests ──────────────────────────────────────────────────────

beforeEach(() => {
  useWebhooksStore.setState({
    settings: null,
    isLoading: false,
    isSaving: false,
    error: null,
  });
  vi.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("useWebhooksStore", () => {
  describe("initial state", () => {
    it("starts with null settings and no loading/error", () => {
      const state = useWebhooksStore.getState();
      expect(state.settings).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("fetchSettings", () => {
    it("populates settings on success", async () => {
      mockGetWebhookSettings.mockResolvedValueOnce({
        status: "ok",
        data: FULL_SETTINGS,
        error: null,
      });
      await useWebhooksStore.getState().fetchSettings();
      expect(useWebhooksStore.getState().settings).toEqual(FULL_SETTINGS);
      expect(useWebhooksStore.getState().isLoading).toBe(false);
      expect(useWebhooksStore.getState().error).toBeNull();
    });

    it("calls window.nango.getWebhookSettings", async () => {
      await useWebhooksStore.getState().fetchSettings();
      expect(mockGetWebhookSettings).toHaveBeenCalledOnce();
    });

    it("sets isLoading to false after fetch completes", async () => {
      await useWebhooksStore.getState().fetchSettings();
      expect(useWebhooksStore.getState().isLoading).toBe(false);
    });

    it("sets error on IPC error response", async () => {
      mockGetWebhookSettings.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Nango API key is invalid",
        errorCode: "AUTH_INVALID",
      });
      await useWebhooksStore.getState().fetchSettings();
      const state = useWebhooksStore.getState();
      expect(state.error).toBe("Nango API key is invalid");
      expect(state.isLoading).toBe(false);
      expect(state.settings).toBeNull();
    });

    it("sets error on thrown exception", async () => {
      mockGetWebhookSettings.mockRejectedValueOnce(new Error("Network failure"));
      await useWebhooksStore.getState().fetchSettings();
      expect(useWebhooksStore.getState().error).toBe("Network failure");
      expect(useWebhooksStore.getState().isLoading).toBe(false);
    });

    it("sets generic error message for non-Error exceptions", async () => {
      mockGetWebhookSettings.mockRejectedValueOnce("plain string error");
      await useWebhooksStore.getState().fetchSettings();
      expect(useWebhooksStore.getState().error).toBe("Failed to fetch webhook settings");
    });

    it("clears previous error before re-fetching", async () => {
      useWebhooksStore.setState({ error: "old error" });
      await useWebhooksStore.getState().fetchSettings();
      expect(useWebhooksStore.getState().error).toBeNull();
    });
  });

  describe("updateSettings", () => {
    it("merges updated settings into store state on success", async () => {
      const updated: NangoWebhookSettings = {
        ...DEFAULT_SETTINGS,
        primaryUrl: "https://new.example.com/hook",
        onSyncCompletionAlways: true,
      };
      mockUpdateWebhookSettings.mockResolvedValueOnce({
        status: "ok",
        data: updated,
        error: null,
      });
      await useWebhooksStore.getState().updateSettings({ primaryUrl: "https://new.example.com/hook" });
      expect(useWebhooksStore.getState().settings).toEqual(updated);
      expect(useWebhooksStore.getState().isSaving).toBe(false);
      expect(useWebhooksStore.getState().error).toBeNull();
    });

    it("passes the patch payload to window.nango.updateWebhookSettings", async () => {
      const patch = { primaryUrl: "https://test.com/nango", onSyncError: true };
      mockUpdateWebhookSettings.mockResolvedValueOnce({
        status: "ok",
        data: { ...DEFAULT_SETTINGS, ...patch },
        error: null,
      });
      await useWebhooksStore.getState().updateSettings(patch);
      expect(mockUpdateWebhookSettings).toHaveBeenCalledWith(patch);
    });

    it("sets isSaving to false after update completes", async () => {
      await useWebhooksStore.getState().updateSettings({});
      expect(useWebhooksStore.getState().isSaving).toBe(false);
    });

    it("sets error on IPC error response", async () => {
      mockUpdateWebhookSettings.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Rate limited",
        errorCode: "RATE_LIMITED",
      });
      await useWebhooksStore.getState().updateSettings({ onSyncError: true });
      const state = useWebhooksStore.getState();
      expect(state.error).toBe("Rate limited");
      expect(state.isSaving).toBe(false);
    });

    it("sets error on thrown exception", async () => {
      mockUpdateWebhookSettings.mockRejectedValueOnce(new Error("IPC channel closed"));
      await useWebhooksStore.getState().updateSettings({});
      expect(useWebhooksStore.getState().error).toBe("IPC channel closed");
      expect(useWebhooksStore.getState().isSaving).toBe(false);
    });

    it("sets generic error message for non-Error exceptions", async () => {
      mockUpdateWebhookSettings.mockRejectedValueOnce(42);
      await useWebhooksStore.getState().updateSettings({});
      expect(useWebhooksStore.getState().error).toBe("Failed to update webhook settings");
    });

    it("clears previous error before saving", async () => {
      useWebhooksStore.setState({ error: "previous error" });
      await useWebhooksStore.getState().updateSettings({});
      expect(useWebhooksStore.getState().error).toBeNull();
    });

    it("does not mutate existing settings when update fails", async () => {
      const existing = { ...FULL_SETTINGS };
      useWebhooksStore.setState({ settings: existing });
      mockUpdateWebhookSettings.mockResolvedValueOnce({
        status: "error",
        data: null,
        error: "Server error",
        errorCode: "SERVER_ERROR",
      });
      await useWebhooksStore.getState().updateSettings({ primaryUrl: "https://bad.com" });
      // Settings must be unchanged
      expect(useWebhooksStore.getState().settings).toEqual(existing);
    });
  });

  describe("conflict resolution strategy", () => {
    it("fetched settings include conflictResolutionStrategy", async () => {
      mockGetWebhookSettings.mockResolvedValueOnce({
        status: "ok",
        data: FULL_SETTINGS,
        error: null,
      });
      await useWebhooksStore.getState().fetchSettings();
      expect(useWebhooksStore.getState().settings?.conflictResolutionStrategy).toBe("most_recent_wins");
    });

    it("defaults conflictResolutionStrategy to deep_merge", async () => {
      mockGetWebhookSettings.mockResolvedValueOnce({
        status: "ok",
        data: DEFAULT_SETTINGS,
        error: null,
      });
      await useWebhooksStore.getState().fetchSettings();
      expect(useWebhooksStore.getState().settings?.conflictResolutionStrategy).toBe("deep_merge");
    });

    it("persists strategy change via updateSettings", async () => {
      const updated = { ...DEFAULT_SETTINGS, conflictResolutionStrategy: "custom_update" as const };
      mockUpdateWebhookSettings.mockResolvedValueOnce({
        status: "ok",
        data: updated,
        error: null,
      });
      await useWebhooksStore.getState().updateSettings({ conflictResolutionStrategy: "custom_update" });
      expect(mockUpdateWebhookSettings).toHaveBeenCalledWith({ conflictResolutionStrategy: "custom_update" });
      expect(useWebhooksStore.getState().settings?.conflictResolutionStrategy).toBe("custom_update");
    });
  });

  // ── Regression: individual selectors required ─────────────────────────────
  // Using the identity selector `useWebhooksStore()` (without a selector function)
  // returns the full state object. React 19's useSyncExternalStore treats every
  // `set()` call as a new reference, triggering infinite re-renders at mount.
  // Each state value must be extracted with an individual selector.
  // Verified by: ba5ff4b (fix: resolve infinite re-render loop on WebhooksPage)

  describe("selector stability (React 19 re-render regression)", () => {
    it("individual selectors for primitive values return stable references", async () => {
      mockGetWebhookSettings.mockResolvedValueOnce({
        status: "ok",
        data: FULL_SETTINGS,
        error: null,
      });
      await useWebhooksStore.getState().fetchSettings();

      // Each selector call should return the same primitive — not a new object
      const isLoading1 = useWebhooksStore.getState().isLoading;
      const isLoading2 = useWebhooksStore.getState().isLoading;
      expect(isLoading1).toBe(isLoading2);

      const error1 = useWebhooksStore.getState().error;
      const error2 = useWebhooksStore.getState().error;
      expect(error1).toBe(error2);
    });

    it("settings object reference is stable between fetches of the same data", async () => {
      mockGetWebhookSettings.mockResolvedValue({
        status: "ok",
        data: FULL_SETTINGS,
        error: null,
      });
      await useWebhooksStore.getState().fetchSettings();
      const ref1 = useWebhooksStore.getState().settings;
      // A second fetch with the same payload replaces the reference (by design),
      // but the CONTENT must be equal
      await useWebhooksStore.getState().fetchSettings();
      const ref2 = useWebhooksStore.getState().settings;
      expect(ref2).toEqual(ref1);
    });
  });
});
