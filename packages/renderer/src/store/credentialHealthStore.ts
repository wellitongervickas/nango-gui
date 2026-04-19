import { create } from "zustand";
import type { ConnectionHealthStatus } from "@nango-gui/shared";

interface HealthEntry {
  status: ConnectionHealthStatus;
  lastChecked: string;
  output: string | null;
}

interface CredentialHealthState {
  /** Keyed by `${providerConfigKey}:${connectionId}` */
  entries: Record<string, HealthEntry>;
  /** Currently validating keys */
  validating: Set<string>;

  validate: (providerConfigKey: string, connectionId: string) => Promise<void>;
  getEntry: (providerConfigKey: string, connectionId: string) => HealthEntry | null;
}

function key(providerConfigKey: string, connectionId: string) {
  return `${providerConfigKey}:${connectionId}`;
}

export const useCredentialHealthStore = create<CredentialHealthState>((set, get) => ({
  entries: {},
  validating: new Set(),

  validate: async (providerConfigKey, connectionId) => {
    const k = key(providerConfigKey, connectionId);
    if (get().validating.has(k)) return;

    set((s) => ({ validating: new Set(s.validating).add(k) }));

    try {
      const res = await window.nango.validateConnection({ providerConfigKey, connectionId });
      if (res.status === "ok") {
        set((s) => ({
          entries: {
            ...s.entries,
            [k]: {
              status: res.data.status,
              lastChecked: res.data.lastChecked,
              output: res.data.output,
            },
          },
        }));
      } else {
        set((s) => ({
          entries: {
            ...s.entries,
            [k]: {
              status: "invalid",
              lastChecked: new Date().toISOString(),
              output: res.error,
            },
          },
        }));
      }
    } catch (err) {
      set((s) => ({
        entries: {
          ...s.entries,
          [k]: {
            status: "invalid",
            lastChecked: new Date().toISOString(),
            output: err instanceof Error ? err.message : "Validation failed",
          },
        },
      }));
    } finally {
      set((s) => {
        const next = new Set(s.validating);
        next.delete(k);
        return { validating: next };
      });
    }
  },

  getEntry: (providerConfigKey, connectionId) =>
    get().entries[key(providerConfigKey, connectionId)] ?? null,
}));
