import { useEffect, useState } from "react";
import type { DeploySnapshot } from "@nango-gui/shared";
import { useDeploySnapshotStore } from "../store/deploySnapshotStore";
import { cn } from "../lib/utils";

// ── Icons ────────────────────────────────────────────────────────────────────

function DeployIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5Z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function RollbackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

// ── Environment badge ────────────────────────────────────────────────────────

function EnvironmentBadge({ env }: { env: string }) {
  const isProd = env === "production";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0",
        isProd
          ? "bg-[var(--color-error)]/10 text-[var(--color-error)]"
          : "bg-[var(--color-sync)]/10 text-[var(--color-sync)]"
      )}
    >
      {env}
    </span>
  );
}

// ── Format helpers ───────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatConfigSummary(snapshot: DeploySnapshot): string {
  const { command, args } = snapshot.cliConfig;
  return [command, ...args].join(" ");
}

// ── Snapshot row ─────────────────────────────────────────────────────────────

function SnapshotRow({
  snapshot,
  onDelete,
  onRollback,
  isDeleting,
  isRollingBack,
}: {
  snapshot: DeploySnapshot;
  onDelete: (id: string) => void;
  onRollback: (id: string) => void;
  isDeleting: boolean;
  isRollingBack: boolean;
}) {
  const isBusy = isDeleting || isRollingBack;

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-surface)] transition-colors group">
      {/* Timestamp */}
      <div className="w-44 text-xs text-[var(--color-text-primary)] tabular-nums shrink-0">
        {formatTimestamp(snapshot.timestamp)}
      </div>

      {/* Environment */}
      <div className="w-28 shrink-0">
        <EnvironmentBadge env={snapshot.environment} />
      </div>

      {/* Label */}
      <div className="w-36 text-xs text-[var(--color-text-secondary)] truncate shrink-0">
        {snapshot.label ?? "\u2014"}
      </div>

      {/* Config summary */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-[var(--color-text-secondary)] truncate">
          {formatConfigSummary(snapshot)}
        </p>
        {snapshot.cliConfig.cwd && (
          <p className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">
            cwd: {snapshot.cliConfig.cwd}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="w-20 flex items-center gap-1 justify-end">
        <button
          onClick={() => onRollback(snapshot.id)}
          disabled={isBusy}
          title="Rollback to this deploy"
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-all cursor-pointer disabled:opacity-50 opacity-0 group-hover:opacity-100"
          aria-label="Rollback"
        >
          <RollbackIcon />
        </button>
        <button
          onClick={() => onDelete(snapshot.id)}
          disabled={isBusy}
          title="Delete snapshot"
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-all cursor-pointer disabled:opacity-50 opacity-0 group-hover:opacity-100"
          aria-label="Delete snapshot"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function DeployHistoryPage() {
  const snapshots = useDeploySnapshotStore((s) => s.snapshots);
  const isLoading = useDeploySnapshotStore((s) => s.isLoading);
  const error = useDeploySnapshotStore((s) => s.error);
  const fetchSnapshots = useDeploySnapshotStore((s) => s.fetchSnapshots);
  const deleteSnapshot = useDeploySnapshotStore((s) => s.deleteSnapshot);
  const rollback = useDeploySnapshotStore((s) => s.rollback);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void fetchSnapshots();
  }, [fetchSnapshots]);

  async function handleDelete(id: string) {
    setActionError(null);
    setDeletingId(id);
    try {
      await deleteSnapshot(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRollback(id: string) {
    setActionError(null);
    setRollingBackId(id);
    try {
      await rollback(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setRollingBackId(null);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-[var(--color-text)]">Deploy History</h1>
          <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
            {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
          </span>
        </div>
        {actionError && (
          <p className="text-xs text-[var(--color-error)] mt-2">{actionError}</p>
        )}
      </div>

      {/* Column headers */}
      {snapshots.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide shrink-0">
          <span className="w-44 shrink-0">Timestamp</span>
          <span className="w-28 shrink-0">Environment</span>
          <span className="w-36 shrink-0">Label</span>
          <span className="flex-1">Config</span>
          <span className="w-20" />
        </div>
      )}

      {/* Snapshot list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && snapshots.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
            <button
              onClick={() => void fetchSnapshots()}
              className="text-xs text-[var(--color-primary)] hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && snapshots.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)]">
              <DeployIcon />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--color-text)] mb-1">No deploys yet</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Deploy snapshots will appear here after you deploy from the Canvas.
              </p>
            </div>
          </div>
        )}

        {snapshots.map((snapshot) => (
          <SnapshotRow
            key={snapshot.id}
            snapshot={snapshot}
            onDelete={handleDelete}
            onRollback={handleRollback}
            isDeleting={deletingId === snapshot.id}
            isRollingBack={rollingBackId === snapshot.id}
          />
        ))}
      </div>
    </div>
  );
}
