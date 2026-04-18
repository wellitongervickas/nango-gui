import { create } from "zustand";
import type { NangoEnvironment } from "@nango-gui/shared";

const ENV_STORAGE_KEY = "nango-gui-environment";
const ENV_URL_PARAM = "env";

export interface EnvironmentEntry {
  name: NangoEnvironment;
  label: string;
  shortLabel: string;
  color: string;
}

const ENVIRONMENTS: EnvironmentEntry[] = [
  { name: "production", label: "Production", shortLabel: "Prod", color: "var(--color-env-production)" },
  { name: "staging", label: "Staging", shortLabel: "Stag", color: "var(--color-env-staging)" },
  { name: "development", label: "Development", shortLabel: "Dev", color: "var(--color-env-development)" },
];

interface EnvironmentState {
  current: NangoEnvironment;
  environments: EnvironmentEntry[];
  isSwitching: boolean;
  error: string | null;

  initialize: () => void;
  switchEnvironment: (env: NangoEnvironment) => Promise<void>;
  getCurrentEntry: () => EnvironmentEntry;
}

function readFromUrl(): NangoEnvironment | null {
  const params = new URLSearchParams(window.location.search);
  const env = params.get(ENV_URL_PARAM);
  if (env && ENVIRONMENTS.some((e) => e.name === env)) {
    return env as NangoEnvironment;
  }
  return null;
}

function readFromStorage(): NangoEnvironment | null {
  try {
    const stored = localStorage.getItem(ENV_STORAGE_KEY);
    if (stored && ENVIRONMENTS.some((e) => e.name === stored)) {
      return stored as NangoEnvironment;
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

function persistToStorage(env: NangoEnvironment): void {
  try {
    localStorage.setItem(ENV_STORAGE_KEY, env);
  } catch {
    // localStorage unavailable
  }
}

function syncUrlParam(env: NangoEnvironment): void {
  const url = new URL(window.location.href);
  url.searchParams.set(ENV_URL_PARAM, env);
  window.history.replaceState(null, "", url.toString());
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  current: "development",
  environments: ENVIRONMENTS,
  isSwitching: false,
  error: null,

  initialize: () => {
    // Priority: URL param > localStorage > default
    const fromUrl = readFromUrl();
    const fromStorage = readFromStorage();
    const resolved = fromUrl ?? fromStorage ?? "development";

    set({ current: resolved });
    persistToStorage(resolved);
    syncUrlParam(resolved);
  },

  switchEnvironment: async (env) => {
    const prev = get().current;
    if (env === prev) return;

    set({ isSwitching: true, error: null, current: env });
    persistToStorage(env);
    syncUrlParam(env);

    try {
      if (!window.electronApp) { set({ isSwitching: false }); return; }
      const res = await window.electronApp.updateSettings({ environment: env });
      if (res.status === "error") {
        set({ current: prev, isSwitching: false, error: res.error });
        persistToStorage(prev);
        syncUrlParam(prev);
        return;
      }
      set({ isSwitching: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to switch environment";
      set({ current: prev, isSwitching: false, error: message });
      persistToStorage(prev);
      syncUrlParam(prev);
    }
  },

  getCurrentEntry: () => {
    const { current, environments } = get();
    return environments.find((e) => e.name === current) ?? environments[0];
  },
}));
