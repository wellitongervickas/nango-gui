import { useEffect, useRef, useState } from "react";
import { useRateLimitStore, selectOverallStatus } from "@/store/rateLimitStore";
import { RateLimitPanel } from "./RateLimitPanel";
import { cn } from "@/lib/utils";
import { GaugeIcon } from "@/components/icons";
import type { RateLimitAlert } from "@nango-gui/shared";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  empty:    { dot: "bg-[var(--color-text-disabled)]",  badge: "text-[var(--color-text-secondary)]", pulse: false },
  ok:       { dot: "bg-[var(--color-success)]",        badge: "text-[var(--color-success)]",        pulse: false },
  warning:  { dot: "bg-[var(--color-warning)]",        badge: "text-[var(--color-warning)]",        pulse: true  },
  critical: { dot: "bg-[var(--color-error)]",          badge: "text-[var(--color-error)]",          pulse: true  },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function RateLimitBadge() {
  const providers = useRateLimitStore((s) => s.providers);
  const fetchState = useRateLimitStore((s) => s.fetchState);
  const applyAlert = useRateLimitStore((s) => s.applyAlert);
  const [panelOpen, setPanelOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 30_000);
    return () => clearInterval(id);
  }, [fetchState]);

  // Subscribe to push alerts from main process
  useEffect(() => {
    if (!window.rateLimit) return;
    const handler = (alert: RateLimitAlert) => {
      applyAlert(alert);
      fetchState();
    };
    window.rateLimit.onAlert(handler);
    return () => window.rateLimit.removeAllAlertListeners();
  }, [applyAlert, fetchState]);

  const status = selectOverallStatus(providers);
  const styles = STATUS_STYLES[status];

  if (status === "empty") return null;

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        onClick={() => setPanelOpen((v) => !v)}
        title="API rate limits"
        aria-label="API rate limits"
        aria-expanded={panelOpen}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors cursor-pointer",
          "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]",
          panelOpen && "bg-[var(--color-bg)]",
          styles.badge
        )}
      >
        <GaugeIcon />
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75",
              styles.dot,
              styles.pulse && "animate-ping"
            )}
          />
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", styles.dot)} />
        </span>
      </button>

      {panelOpen && (
        <RateLimitPanel onClose={() => setPanelOpen(false)} />
      )}
    </div>
  );
}
