import { create } from "zustand";
import type { RateLimitProviderState, RateLimitAlert } from "@nango-gui/shared";

interface RateLimitState {
  /** Latest per-provider rate-limit data, keyed by provider name. */
  providers: Map<string, RateLimitProviderState>;
  /** Recent threshold-crossing alerts (newest first, capped at 50). */
  alerts: RateLimitAlert[];
  isLoading: boolean;

  fetchState(): Promise<void>;
  applyAlert(alert: RateLimitAlert): void;
  clearAlerts(): void;
}

const MAX_ALERTS = 50;

export const useRateLimitStore = create<RateLimitState>((set) => ({
  providers: new Map(),
  alerts: [],
  isLoading: false,

  fetchState: async () => {
    if (!window.rateLimit) return;
    set({ isLoading: true });
    try {
      const res = await window.rateLimit.getState();
      if (res.status === "ok") {
        const map = new Map<string, RateLimitProviderState>();
        for (const p of res.data.providers) {
          map.set(p.provider, p);
        }
        set({ providers: map, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  applyAlert: (alert: RateLimitAlert) => {
    set((state) => {
      const alerts = [alert, ...state.alerts].slice(0, MAX_ALERTS);
      return { alerts };
    });
  },

  clearAlerts: () => set({ alerts: [] }),
}));

/** Derive the worst-case status across all tracked providers. */
export type RateLimitStatus = "ok" | "warning" | "critical" | "empty";

export function selectOverallStatus(providers: Map<string, RateLimitProviderState>): RateLimitStatus {
  if (providers.size === 0) return "empty";
  let hasCritical = false;
  let hasWarning = false;
  for (const p of providers.values()) {
    const pct = p.limit > 0 ? (p.limit - p.remaining) / p.limit : 0;
    if (pct >= 0.9) hasCritical = true;
    else if (pct >= 0.75) hasWarning = true;
  }
  if (hasCritical) return "critical";
  if (hasWarning) return "warning";
  return "ok";
}
