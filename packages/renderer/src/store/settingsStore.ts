import { create } from "zustand";
import type { AppTheme, NangoEnvironment } from "@nango-gui/shared";

interface SettingsState {
  theme: AppTheme;
  environment: NangoEnvironment;
  maskedKey: string | null;
  appVersion: string;
  electronVersion: string;
  nangoSdkVersion: string;
  connectUiTheme: AppTheme;
  connectUiPrimaryColor: string | null;
  /**
   * True when the connected Nango server has RBAC enabled (e.g. enterprise tier).
   * When false, all permission gates are no-ops and the role badge is hidden.
   */
  hasRbac: boolean;
  /** Whether the currently selected Nango environment is flagged as production. */
  isProduction: boolean;
  /** Subscription tier of the connected Nango account. */
  tier: string | null;
  isLoading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateTheme: (theme: AppTheme) => Promise<void>;
  updateEnvironment: (env: NangoEnvironment) => Promise<void>;
  updateConnectUiTheme: (theme: AppTheme) => Promise<void>;
  updateConnectUiPrimaryColor: (color: string | null) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: "system",
  environment: "development",
  maskedKey: null,
  appVersion: "",
  electronVersion: "",
  nangoSdkVersion: "",
  connectUiTheme: "system",
  connectUiPrimaryColor: null,
  hasRbac: false,
  isProduction: false,
  tier: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    if (!window.electronApp) return;
    set({ isLoading: true, error: null });
    try {
      const res = await window.electronApp.getSettings();
      if (res.status === "error") {
        set({ error: res.error, isLoading: false });
        return;
      }
      const {
        theme,
        environment,
        maskedKey,
        appVersion,
        electronVersion,
        nangoSdkVersion,
        connectUiTheme,
        connectUiPrimaryColor,
        hasRbac,
        isProduction,
        tier,
      } = res.data;
      set({
        theme,
        environment,
        maskedKey,
        appVersion,
        electronVersion,
        nangoSdkVersion,
        connectUiTheme,
        connectUiPrimaryColor,
        hasRbac,
        isProduction,
        tier,
        isLoading: false,
      });
      applyTheme(theme);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load settings";
      set({ error: message, isLoading: false });
    }
  },

  updateTheme: async (theme) => {
    const prev = get().theme;
    set({ theme });
    applyTheme(theme);
    if (!window.electronApp) return;
    try {
      const res = await window.electronApp.updateSettings({ theme });
      if (res.status === "error") {
        set({ theme: prev });
        applyTheme(prev);
        throw new Error(res.error);
      }
    } catch (err) {
      set({ theme: prev });
      applyTheme(prev);
      throw err;
    }
  },

  updateEnvironment: async (environment) => {
    const prev = get().environment;
    set({ environment });
    if (!window.electronApp) return;
    try {
      const res = await window.electronApp.updateSettings({ environment });
      if (res.status === "error") {
        set({ environment: prev });
        throw new Error(res.error);
      }
      // Per F6 spec: re-fetch tier/is_production/role when the environment switches.
      // Re-pulling settings refreshes hasRbac/isProduction/tier; the rbac store is
      // notified separately via the environment subscription wired in App.tsx.
      await get().fetchSettings();
    } catch (err) {
      set({ environment: prev });
      throw err;
    }
  },

  updateConnectUiTheme: async (connectUiTheme) => {
    const prev = get().connectUiTheme;
    set({ connectUiTheme });
    if (!window.electronApp) return;
    try {
      const res = await window.electronApp.updateSettings({ connectUiTheme });
      if (res.status === "error") {
        set({ connectUiTheme: prev });
        throw new Error(res.error);
      }
    } catch (err) {
      set({ connectUiTheme: prev });
      throw err;
    }
  },

  updateConnectUiPrimaryColor: async (connectUiPrimaryColor) => {
    const prev = get().connectUiPrimaryColor;
    set({ connectUiPrimaryColor });
    if (!window.electronApp) return;
    try {
      const res = await window.electronApp.updateSettings({ connectUiPrimaryColor });
      if (res.status === "error") {
        set({ connectUiPrimaryColor: prev });
        throw new Error(res.error);
      }
    } catch (err) {
      set({ connectUiPrimaryColor: prev });
      throw err;
    }
  },
}));

/**
 * Apply the theme preference to the document root.
 * Uses the `.dark` class for Tailwind dark-mode variant.
 */
export function applyTheme(theme: AppTheme): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // system: follow prefers-color-scheme
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  }
}
