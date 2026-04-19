import { create } from "zustand";
import type { AppTheme, NangoEnvironment } from "@nango-gui/shared";

interface SettingsState {
  theme: AppTheme;
  environment: NangoEnvironment;
  maskedKey: string | null;
  appVersion: string;
  electronVersion: string;
  nangoSdkVersion: string;
  /** Whether RBAC is enabled on the connected Nango server. */
  hasRbac: boolean;
  isLoading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateTheme: (theme: AppTheme) => Promise<void>;
  updateEnvironment: (env: NangoEnvironment) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: "system",
  environment: "development",
  maskedKey: null,
  appVersion: "",
  electronVersion: "",
  nangoSdkVersion: "",
  hasRbac: false,
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
      const { theme, environment, maskedKey, appVersion, electronVersion, nangoSdkVersion, hasRbac } = res.data;
      set({ theme, environment, maskedKey, appVersion, electronVersion, nangoSdkVersion, hasRbac, isLoading: false });
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
    } catch (err) {
      set({ environment: prev });
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
