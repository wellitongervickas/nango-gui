import type {
  RateLimitProviderState,
  RateLimitAlert,
  RateLimitAlertLevel,
} from "@nango-gui/shared";
import log from "./logger.js";

const WARNING_THRESHOLD = 0.75;
const CRITICAL_THRESHOLD = 0.9;

type AlertCallback = (alert: RateLimitAlert) => void;

/**
 * In-memory tracker for per-provider rate-limit state extracted from
 * X-RateLimit-* response headers. Pushes alerts when thresholds are crossed.
 */
class RateLimitTracker {
  private state = new Map<string, RateLimitProviderState>();
  private listeners = new Set<AlertCallback>();

  /** Record rate-limit headers observed from an API response. */
  observe(provider: string, headers: Record<string, string>): void {
    const remaining = parseHeaderInt(headers, "x-ratelimit-remaining");
    const limit = parseHeaderInt(headers, "x-ratelimit-limit");
    const reset = parseHeaderInt(headers, "x-ratelimit-reset");

    // If no rate-limit headers, nothing to track
    if (remaining === null && limit === null) return;

    const entry: RateLimitProviderState = {
      provider,
      remaining: remaining ?? 0,
      limit: limit ?? 0,
      reset: reset ?? 0,
      updatedAt: new Date().toISOString(),
    };

    this.state.set(provider, entry);

    // Check thresholds and emit alerts
    if (entry.limit > 0) {
      const used = (entry.limit - entry.remaining) / entry.limit;
      if (used >= CRITICAL_THRESHOLD) {
        this.emit(entry, "critical");
      } else if (used >= WARNING_THRESHOLD) {
        this.emit(entry, "warning");
      }
    }
  }

  /** Get the current state for all tracked providers. */
  getState(): RateLimitProviderState[] {
    // Prune expired entries (reset time in the past and window fully restored)
    const now = Math.floor(Date.now() / 1000);
    for (const [key, entry] of this.state) {
      if (entry.reset > 0 && entry.reset < now) {
        this.state.delete(key);
      }
    }
    return Array.from(this.state.values());
  }

  /** Register a callback for threshold-crossing alerts. */
  onAlert(cb: AlertCallback): void {
    this.listeners.add(cb);
  }

  /** Remove an alert callback. */
  offAlert(cb: AlertCallback): void {
    this.listeners.delete(cb);
  }

  private emit(entry: RateLimitProviderState, level: RateLimitAlertLevel): void {
    const alert: RateLimitAlert = {
      provider: entry.provider,
      level,
      remaining: entry.remaining,
      limit: entry.limit,
      reset: entry.reset,
      timestamp: new Date().toISOString(),
    };
    log.warn(
      `[RateLimit] ${level} alert for ${entry.provider}: ${entry.remaining}/${entry.limit} remaining`
    );
    for (const cb of this.listeners) {
      try {
        cb(alert);
      } catch {
        // Listener errors must not break the tracker
      }
    }
  }
}

/** Parse a rate-limit header value as an integer, case-insensitively. */
function parseHeaderInt(
  headers: Record<string, string>,
  name: string
): number | null {
  // Headers may arrive in any casing
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  if (!key) return null;
  const val = parseInt(headers[key], 10);
  return Number.isNaN(val) ? null : val;
}

/** Singleton tracker instance. */
export const rateLimitTracker = new RateLimitTracker();
