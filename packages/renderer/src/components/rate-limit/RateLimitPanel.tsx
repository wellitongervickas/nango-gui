import { useEffect, useRef } from "react";
import { useRateLimitStore } from "@/store/rateLimitStore";
import type { RateLimitProviderState } from "@nango-gui/shared";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function usedPercent(p: RateLimitProviderState): number {
  if (p.limit <= 0) return 0;
  return Math.min(100, ((p.limit - p.remaining) / p.limit) * 100);
}

function formatResetCountdown(resetUnixSec: number): string {
  const diffSec = Math.max(0, Math.floor(resetUnixSec - Date.now() / 1000));
  if (diffSec === 0) return "now";
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

type BarLevel = "ok" | "warning" | "critical";

function barLevel(pct: number): BarLevel {
  if (pct >= 90) return "critical";
  if (pct >= 75) return "warning";
  return "ok";
}

const BAR_COLORS: Record<BarLevel, string> = {
  ok:       "bg-[var(--color-success)]",
  warning:  "bg-[var(--color-warning)]",
  critical: "bg-[var(--color-error)]",
};

const TEXT_COLORS: Record<BarLevel, string> = {
  ok:       "text-[var(--color-success)]",
  warning:  "text-[var(--color-warning)]",
  critical: "text-[var(--color-error)]",
};

// ── Provider row ──────────────────────────────────────────────────────────────

function ProviderRow({ provider }: { provider: RateLimitProviderState }) {
  const pct = usedPercent(provider);
  const level = barLevel(pct);
  const resetIn = formatResetCountdown(provider.reset);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text-primary)] capitalize">
          {provider.provider}
        </span>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
          <span className={cn("font-medium tabular-nums", TEXT_COLORS[level])}>
            {provider.remaining}/{provider.limit}
          </span>
          <span>resets in {resetIn}</span>
        </div>
      </div>
      {/* Progress bar (used portion) */}
      <div className="h-2 rounded-full bg-[var(--color-bg-overlay)] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", BAR_COLORS[level])}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${provider.provider} rate limit: ${Math.round(pct)}% used`}
        />
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface RateLimitPanelProps {
  onClose: () => void;
}

export function RateLimitPanel({ onClose }: RateLimitPanelProps) {
  const providers = useRateLimitStore((s) => s.providers);
  const alerts = useRateLimitStore((s) => s.alerts);
  const clearAlerts = useRateLimitStore((s) => s.clearAlerts);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const sortedProviders = [...providers.values()].sort((a, b) =>
    usedPercent(b) - usedPercent(a)
  );

  const recentAlerts = alerts.slice(0, 5);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 z-50 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-lg overflow-hidden"
      role="dialog"
      aria-label="API rate limits"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          API Rate Limits
        </h2>
        <button
          onClick={onClose}
          aria-label="Close rate limits panel"
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Provider gauges */}
      <div className="p-4 space-y-4">
        {sortedProviders.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-2">
            No rate-limit data yet.
          </p>
        ) : (
          sortedProviders.map((p) => (
            <ProviderRow key={p.provider} provider={p} />
          ))
        )}
      </div>

      {/* Recent alerts */}
      {recentAlerts.length > 0 && (
        <>
          <div className="border-t border-[var(--color-border)] px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
              Recent Alerts
            </span>
            <button
              onClick={clearAlerts}
              className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div className="px-4 pb-4 space-y-1.5">
            {recentAlerts.map((alert, i) => (
              <div
                key={`${alert.provider}-${alert.timestamp}-${i}`}
                className={cn(
                  "flex items-center gap-2 text-xs rounded-md px-2 py-1.5",
                  alert.level === "critical"
                    ? "bg-[var(--color-error)]/10 text-[var(--color-error)]"
                    : "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                )}
              >
                <span className="font-medium capitalize">{alert.provider}</span>
                <span className="opacity-75">—</span>
                <span className="capitalize">{alert.level}</span>
                <span className="ml-auto opacity-60 tabular-nums">
                  {alert.remaining}/{alert.limit}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-base)]">
        <p className="text-xs text-[var(--color-text-secondary)]">
          Warning at 75% · Critical at 90% consumed
        </p>
      </div>
    </div>
  );
}
