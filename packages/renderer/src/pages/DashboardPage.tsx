import { useCallback, useEffect, useRef } from "react";
import type { NangoDashboardData } from "@nango-gui/shared";
import { useDashboardStore } from "@/store/dashboardStore";
import { cn } from "@/lib/utils";
import { navigate } from "@/lib/router";

// ── Icons ──────────────────────────────────────────────────────────────────

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function PlayCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}

function PauseCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="10" y1="15" x2="10" y2="9" />
      <line x1="14" y1="15" x2="14" y2="9" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

// ── Status badge (reused from SyncsPage pattern) ──────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  RUNNING: { bg: "bg-[var(--color-success)]/15", text: "text-[var(--color-success)]", dot: "bg-[var(--color-success)]" },
  SUCCESS: { bg: "bg-[var(--color-success)]/15", text: "text-[var(--color-success)]", dot: "bg-[var(--color-success)]" },
  PAUSED:  { bg: "bg-[var(--color-warning)]/15", text: "text-[var(--color-warning)]", dot: "bg-[var(--color-warning)]" },
  ERROR:   { bg: "bg-[var(--color-error)]/15",   text: "text-[var(--color-error)]",   dot: "bg-[var(--color-error)]" },
  STOPPED: { bg: "bg-[var(--color-text-secondary)]/15", text: "text-[var(--color-text-secondary)]", dot: "bg-[var(--color-text-secondary)]" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 animate-pulse">
      <div className="h-3 w-20 rounded bg-[var(--color-bg-overlay)] mb-3" />
      <div className="h-7 w-16 rounded bg-[var(--color-bg-overlay)]" />
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] animate-pulse">
          <div className="w-8 h-8 rounded-md bg-[var(--color-bg-overlay)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-[var(--color-bg-overlay)]" />
            <div className="h-2.5 w-20 rounded bg-[var(--color-bg-overlay)]" />
          </div>
          <div className="h-3 w-12 rounded bg-[var(--color-bg-overlay)]" />
          <div className="h-3 w-24 rounded bg-[var(--color-bg-overlay)]" />
        </div>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 flex items-start gap-4">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-[var(--color-text-secondary)] mb-1">{label}</p>
        <p className="text-2xl font-semibold text-[var(--color-text-primary)] tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ── Sync status bar ───────────────────────────────────────────────────────

function SyncStatusBar({ dashboard }: { dashboard: NangoDashboardData }) {
  const { totalSyncs, runningSyncs, pausedSyncs, errorSyncs } = dashboard;
  const stoppedSyncs = totalSyncs - runningSyncs - pausedSyncs - errorSyncs;

  if (totalSyncs === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        <h2 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
          Sync Status Distribution
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">No syncs configured yet.</p>
      </div>
    );
  }

  const segments: { label: string; count: number; status: string }[] = [
    { label: "Running", count: runningSyncs, status: "RUNNING" },
    { label: "Paused", count: pausedSyncs, status: "PAUSED" },
    { label: "Error", count: errorSyncs, status: "ERROR" },
    { label: "Stopped", count: stoppedSyncs, status: "STOPPED" },
  ].filter((s) => s.count > 0);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
      <h2 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
        Sync Status Distribution
      </h2>
      {/* Bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-[var(--color-bg-overlay)] mb-3">
        {segments.map((seg) => {
          const pct = (seg.count / totalSyncs) * 100;
          const style = STATUS_COLORS[seg.status] ?? STATUS_COLORS.STOPPED;
          return (
            <div
              key={seg.status}
              className={cn("h-full transition-all", style.dot)}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${seg.count}`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {segments.map((seg) => {
          const style = STATUS_COLORS[seg.status] ?? STATUS_COLORS.STOPPED;
          return (
            <div key={seg.status} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", style.dot)} />
              <span className="text-xs text-[var(--color-text-secondary)]">
                {seg.label}{" "}
                <span className="font-medium text-[var(--color-text-primary)] tabular-nums">{seg.count}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Top connections table ──────────────────────────────────────────────────

function TopConnectionsTable({ dashboard }: { dashboard: NangoDashboardData }) {
  const { topConnections } = dashboard;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <h2 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Top Connections
        </h2>
      </div>
      {topConnections.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No connections yet.</p>
        </div>
      ) : (
        <div>
          {/* Header */}
          <div className="flex items-center gap-4 px-5 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-base)]">
            <div className="flex-1 text-xs font-medium text-[var(--color-text-secondary)]">Connection</div>
            <div className="w-20 text-xs font-medium text-[var(--color-text-secondary)] text-right">Syncs</div>
            <div className="w-36 text-xs font-medium text-[var(--color-text-secondary)]">Last Activity</div>
          </div>
          {topConnections.map((conn) => (
            <div
              key={`${conn.providerConfigKey}:${conn.connectionId}`}
              className="flex items-center gap-4 px-5 py-3 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-base)] transition-colors"
            >
              <div className="w-8 h-8 rounded-md bg-[var(--color-bg-overlay)] flex items-center justify-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase shrink-0">
                {(conn.provider[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {conn.providerConfigKey}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] font-mono truncate">
                  {conn.connectionId}
                </p>
              </div>
              <div className="w-20 text-sm text-[var(--color-text-primary)] text-right tabular-nums">
                {conn.syncCount}
              </div>
              <div className="w-36 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                {formatDate(conn.lastActivity)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Recent errors panel ───────────────────────────────────────────────────

function RecentErrorsPanel({ dashboard }: { dashboard: NangoDashboardData }) {
  const { recentErrors } = dashboard;

  function navigateToSyncs() {
    navigate("syncs");
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Recent Errors
        </h2>
        {recentErrors.length > 0 && (
          <button
            onClick={navigateToSyncs}
            className="text-xs text-[var(--color-brand-400)] hover:underline cursor-pointer"
          >
            View all syncs
          </button>
        )}
      </div>
      {recentErrors.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[var(--color-success)]">No errors — all clear!</p>
        </div>
      ) : (
        <div>
          {recentErrors.map((err, i) => (
            <div
              key={`${err.connectionId}-${err.syncName}-${i}`}
              className="flex items-start gap-3 px-5 py-3 border-b border-[var(--color-border)] last:border-0"
            >
              <span className="mt-0.5 text-[var(--color-error)]">
                <AlertTriangleIcon />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {err.syncName}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] font-mono truncate">
                  {err.providerConfigKey} / {err.connectionId}
                </p>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap shrink-0">
                {formatDate(err.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────

function QuickActions() {
  const actions = [
    { label: "View Connections", route: "connections" },
    { label: "Browse Integrations", route: "integrations" },
    { label: "Open Syncs", route: "syncs" },
    { label: "View Records", route: "records" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.route}
          onClick={() => { navigate(action.route); }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
        >
          {action.label}
          <ArrowRightIcon />
        </button>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 py-20">
      <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
        <RocketIcon />
      </div>
      <div className="text-center max-w-sm">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          Welcome to Nango Builder
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Get started by connecting your first integration. Once you have connections and syncs configured, this dashboard will show your integration health at a glance.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => { navigate("connections"); }}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            Add Connection
          </button>
          <button
            onClick={() => { navigate("integrations"); }}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
          >
            Browse Integrations
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

const AUTO_REFRESH_INTERVAL_MS = 60_000;

export function DashboardPage() {
  const { dashboard, isLoading, error, lastRefreshedAt, fetchDashboard } =
    useDashboardStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Fetch on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh every 60s
  useEffect(() => {
    intervalRef.current = setInterval(refresh, AUTO_REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  // Loading state
  if (isLoading && !dashboard) {
    return (
      <div className="flex flex-col h-full bg-[var(--color-bg-base)] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center gap-4 shrink-0">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Dashboard</h1>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 animate-pulse">
            <div className="h-3 w-40 rounded bg-[var(--color-bg-overlay)] mb-3" />
            <div className="h-3 w-full rounded-full bg-[var(--color-bg-overlay)]" />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <TableSkeleton rows={5} />
            <TableSkeleton rows={5} />
          </div>
        </div>
      </div>
    );
  }

  // Empty state — no connections at all
  if (!isLoading && dashboard && dashboard.totalConnections === 0) {
    return (
      <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center gap-4 shrink-0">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Dashboard</h1>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center gap-4 shrink-0">
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Dashboard</h1>
        {lastRefreshedAt && (
          <span className="text-xs text-[var(--color-text-secondary)]">
            Updated {formatRelativeTime(lastRefreshedAt)}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshIcon />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)] shrink-0">
          {error}
        </div>
      )}

      {/* Dashboard content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {dashboard && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                label="Total Connections"
                value={dashboard.totalConnections}
                icon={<LinkIcon />}
                color="bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)]"
              />
              <StatCard
                label="Active Syncs"
                value={dashboard.runningSyncs}
                icon={<PlayCircleIcon />}
                color="bg-[var(--color-success)]/15 text-[var(--color-success)]"
              />
              <StatCard
                label="Paused Syncs"
                value={dashboard.pausedSyncs}
                icon={<PauseCircleIcon />}
                color="bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
              />
              <StatCard
                label="Sync Errors"
                value={dashboard.errorSyncs}
                icon={<AlertTriangleIcon />}
                color={
                  dashboard.errorSyncs > 0
                    ? "bg-[var(--color-error)]/15 text-[var(--color-error)]"
                    : "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                }
              />
            </div>

            {/* Sync status bar */}
            <SyncStatusBar dashboard={dashboard} />

            {/* Two-column: top connections + recent errors */}
            <div className="grid grid-cols-2 gap-6">
              <TopConnectionsTable dashboard={dashboard} />
              <RecentErrorsPanel dashboard={dashboard} />
            </div>

            {/* Quick actions */}
            <div>
              <h2 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                Quick Actions
              </h2>
              <QuickActions />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
