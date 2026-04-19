import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSettings, IpcResponse } from "@nango-gui/shared";

// ── DOM stubs ───────────────────────────────────────────────────────────────
// Vitest runs without jsdom — provide minimal document/window stubs.

const classList = {
  add: vi.fn(),
  remove: vi.fn(),
  toggle: vi.fn(),
};

vi.stubGlobal("document", {
  documentElement: { classList },
});

const matchMediaMock = vi.fn(() => ({ matches: false }) as MediaQueryList);

// ── window.electronApp mock ─────────────────────────────────────────────────

const mockSettings: AppSettings = {
  theme: "dark",
  environment: "development",
  maskedKey: "••••••••abcd",
  appVersion: "0.1.0",
  electronVersion: "35.0.0",
  nangoSdkVersion: "0.70.1",
  connectUiTheme: "system",
  connectUiPrimaryColor: null,
};

const mockGetSettings = vi.fn((): Promise<IpcResponse<AppSettings>> =>
  Promise.resolve({ status: "ok", data: mockSettings, error: null })
);
const mockUpdateSettings = vi.fn((): Promise<IpcResponse<void>> =>
  Promise.resolve({ status: "ok", data: undefined, error: null })
);

vi.stubGlobal("window", {
  matchMedia: matchMediaMock,
  electronApp: {
    getSettings: mockGetSettings,
    updateSettings: mockUpdateSettings,
  },
});

import { applyTheme, useSettingsStore } from "../store/settingsStore.js";

// Reset store and mocks between tests.
beforeEach(() => {
  useSettingsStore.setState({
    theme: "system",
    environment: "development",
    maskedKey: null,
    appVersion: "",
    electronVersion: "",
    nangoSdkVersion: "",
    isLoading: false,
    error: null,
  });
  vi.clearAllMocks();
  mockGetSettings.mockResolvedValue({ status: "ok", data: mockSettings, error: null } as IpcResponse<AppSettings>);
  mockUpdateSettings.mockResolvedValue({ status: "ok", data: undefined, error: null } as IpcResponse<void>);
});

// ── applyTheme ──────────────────────────────────────────────────────────────

describe("applyTheme", () => {
  it("adds 'dark' class for dark theme", () => {
    applyTheme("dark");
    expect(classList.add).toHaveBeenCalledWith("dark");
  });

  it("removes 'dark' class for light theme", () => {
    applyTheme("light");
    expect(classList.remove).toHaveBeenCalledWith("dark");
  });

  it("toggles 'dark' based on prefers-color-scheme for system theme (dark)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    matchMediaMock.mockReturnValueOnce({ matches: true } as any);
    applyTheme("system");
    expect(classList.toggle).toHaveBeenCalledWith("dark", true);
  });

  it("toggles 'dark' based on prefers-color-scheme for system theme (light)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    matchMediaMock.mockReturnValueOnce({ matches: false } as any);
    applyTheme("system");
    expect(classList.toggle).toHaveBeenCalledWith("dark", false);
  });
});

// ── fetchSettings ───────────────────────────────────────────────────────────

describe("fetchSettings", () => {
  it("populates store from successful IPC response", async () => {
    await useSettingsStore.getState().fetchSettings();
    const state = useSettingsStore.getState();
    expect(state.theme).toBe("dark");
    expect(state.environment).toBe("development");
    expect(state.maskedKey).toBe("••••••••abcd");
    expect(state.appVersion).toBe("0.1.0");
    expect(state.electronVersion).toBe("35.0.0");
    expect(state.nangoSdkVersion).toBe("0.70.1");
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("sets error on IPC error response", async () => {
    mockGetSettings.mockResolvedValueOnce({ status: "error", data: null, error: "IPC failed", errorCode: "UNKNOWN" } as IpcResponse<AppSettings>);
    await useSettingsStore.getState().fetchSettings();
    const state = useSettingsStore.getState();
    expect(state.error).toBe("IPC failed");
    expect(state.isLoading).toBe(false);
  });

  it("sets error on thrown exception", async () => {
    mockGetSettings.mockRejectedValueOnce(new Error("Network error"));
    await useSettingsStore.getState().fetchSettings();
    const state = useSettingsStore.getState();
    expect(state.error).toBe("Network error");
    expect(state.isLoading).toBe(false);
  });
});

// ── updateTheme ─────────────────────────────────────────────────────────────

describe("updateTheme", () => {
  it("optimistically sets theme and calls IPC", async () => {
    useSettingsStore.setState({ theme: "system" });
    await useSettingsStore.getState().updateTheme("dark");
    expect(mockUpdateSettings).toHaveBeenCalledWith({ theme: "dark" });
    expect(useSettingsStore.getState().theme).toBe("dark");
  });

  it("rolls back to previous theme on IPC error", async () => {
    useSettingsStore.setState({ theme: "system" });
    mockUpdateSettings.mockResolvedValueOnce({ status: "error", data: null, error: "Save failed", errorCode: "UNKNOWN" } as IpcResponse<void>);
    await expect(useSettingsStore.getState().updateTheme("dark")).rejects.toThrow(
      "Save failed"
    );
    expect(useSettingsStore.getState().theme).toBe("system");
  });

  it("rolls back theme on thrown exception", async () => {
    useSettingsStore.setState({ theme: "light" });
    mockUpdateSettings.mockRejectedValueOnce(new Error("Crash"));
    await expect(useSettingsStore.getState().updateTheme("dark")).rejects.toThrow("Crash");
    expect(useSettingsStore.getState().theme).toBe("light");
  });
});

// ── updateEnvironment ───────────────────────────────────────────────────────

describe("updateEnvironment", () => {
  it("optimistically sets environment and calls IPC", async () => {
    useSettingsStore.setState({ environment: "development" });
    await useSettingsStore.getState().updateEnvironment("production");
    expect(mockUpdateSettings).toHaveBeenCalledWith({ environment: "production" });
    expect(useSettingsStore.getState().environment).toBe("production");
  });

  it("rolls back to previous environment on IPC error", async () => {
    useSettingsStore.setState({ environment: "development" });
    mockUpdateSettings.mockResolvedValueOnce({ status: "error", data: null, error: "Save failed", errorCode: "UNKNOWN" } as IpcResponse<void>);
    await expect(
      useSettingsStore.getState().updateEnvironment("production")
    ).rejects.toThrow("Save failed");
    expect(useSettingsStore.getState().environment).toBe("development");
  });
});
