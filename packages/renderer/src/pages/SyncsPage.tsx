import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NangoConnectionSummary, NangoSyncRecord, NangoSyncStatus } from "@nango-gui/shared";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useSyncsStore } from "@/store/syncsStore";
import { cn } from "@/lib/utils";

// ── Icons ──────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: direction === "down" ? "rotate(180deg)" : undefined }}>
      <path d="m18 15-6-6-6 6" />
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

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<NangoSyncStatus, { bg: string; text: string; dot: string }> = {
  RUNNING: { bg: "bg-[var(--color-success)]/15", text: "text-[var(--color-success)]", dot: "bg-[var(--color-success)]" },
  SUCCESS: { bg: "bg-[var(--color-success)]/15", text: "text-[var(--color-success)]", dot: "bg-[var(--color-success)]" },
  PAUSED:  { bg: "bg-[var(--color-warning)]/15", text: "text-[var(--color-warning)]", dot: "bg-[var(--color-warning)]" },
  ERROR:   { bg: "bg-[var(--color-error)]/15",   text: "text-[var(--color-error)]",   dot: "bg-[var(--color-error)]" },
  STOPPED: { bg: "bg-[var(--color-text-secondary)]/15", text: "text-[var(--color-text-secondary)]", dot: "bg-[var(--color-text-secondary)]" },
};

function StatusBadge({ status }: { status: NangoSyncStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.STOPPED;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", style.bg, style.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
      {status.toLowerCase()}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] animate-pulse">
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-36 rounded bg-[var(--color-bg-overlay)]" />
      </div>
      <div className="h-5 w-16 rounded-full bg-[var(--color-bg-overlay)]" />
      <div className="h-3 w-20 rounded bg-[var(--color-bg-overlay)]" />
      <div className="h-3 w-20 rounded bg-[var(--color-bg-overlay)]" />
      <div className="h-3 w-20 rounded bg-[var(--color-bg-overlay)]" />
      <div className="h-3 w-12 rounded bg-[var(--color-bg-overlay)]" />
      <div className="w-16" />
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

type SortKey = "name" | "status" | "frequency" | "finishedAt" | "nextScheduledSyncAt";
type SortDir = "asc" | "desc";

// ── Connection selector ────────────────────────────────────────────────────

function ConnectionSelector({
  connections,
  selectedId,
  onSelect,
}: {
  connections: NangoConnectionSummary[];
  selectedId: string | null;
  onSelect: (conn: NangoConnectionSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = connections.find(
    (c) => `${c.provider_config_key}:${c.connection_id}` === selectedId
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-base)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer min-w-[220px]"
      >
        <span className="truncate flex-1 text-left">
          {selected
            ? `${selected.provider_config_key} / ${selected.connection_id}`
            : "Select connection…"}
        </span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 max-h-64 overflow-y-auto bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-50">
          {connections.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
              No connections available
            </div>
          ) : (
            connections.map((conn) => {
              const key = `${conn.provider_config_key}:${conn.connection_id}`;
              return (
                <button
                  key={key}
                  onClick={() => { onSelect(conn); setOpen(false); }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer flex items-center gap-3 border-b border-[var(--color-border)] last:border-0",
                    key === selectedId && "bg-[var(--color-brand-500)]/10"
                  )}
                >
                  <div className="w-7 h-7 rounded-md bg-[var(--color-bg-overlay)] flex items-center justify-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase shrink-0">
                    {(conn.provider_config_key[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {conn.provider_config_key}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] font-mono truncate">
                      {conn.connection_id}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Sort header ────────────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey: key,
  current,
  dir,
  onToggle,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onToggle: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === key;
  return (
    <button
      onClick={() => onToggle(key)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors",
        active
          ? "text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
        className
      )}
    >
      {label}
      {active && <ChevronIcon direction={dir === "asc" ? "up" : "down"} />}
    </button>
  );
}

// ── Sync row ───────────────────────────────────────────────────────────────

function SyncRow({
  sync,
  providerConfigKey,
  connectionId,
}: {
  sync: NangoSyncRecord;
  providerConfigKey: string;
  connectionId: string;
}) {
  const { triggerSync, pauseSync, startSync } = useSyncsStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleTrigger() {
    setActionLoading("trigger");
    setActionError(null);
    try {
      await triggerSync(providerConfigKey, sync.name, connectionId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Trigger failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleTogglePause() {
    const action = sync.status === "PAUSED" ? "start" : "pause";
    setActionLoading(action);
    setActionError(null);
    try {
      if (sync.status === "PAUSED") {
        await startSync(providerConfigKey, sync.name, connectionId);
      } else {
        await pauseSync(providerConfigKey, sync.name, connectionId);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setActionLoading(null);
    }
  }

  const recordCount = sync.latestResult
    ? sync.latestResult.added + sync.latestResult.updated + sync.latestResult.deleted
    : null;

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-surface)] transition-colors group">
      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] font-mono truncate">
          {sync.name}
        </p>
        {actionError && (
          <p className="text-xs text-[var(--color-error)] mt-0.5 truncate">{actionError}</p>
        )}
      </div>

      {/* Status */}
      <div className="w-24">
        <StatusBadge status={sync.status} />
      </div>

      {/* Frequency */}
      <div className="w-28 text-xs text-[var(--color-text-secondary)] truncate">
        {sync.frequency ?? "—"}
      </div>

      {/* Last Run */}
      <div className="w-40 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {formatDate(sync.finishedAt)}
      </div>

      {/* Next Run */}
      <div className="w-40 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {formatDate(sync.nextScheduledSyncAt)}
      </div>

      {/* Record Count */}
      <div className="w-20 text-xs text-[var(--color-text-secondary)] text-right tabular-nums">
        {recordCount != null ? recordCount.toLocaleString() : "—"}
      </div>

      {/* Actions */}
      <div className="w-20 flex items-center gap-1 justify-end">
        {/* Trigger button */}
        <button
          onClick={handleTrigger}
          disabled={actionLoading !== null}
          title="Trigger sync"
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-brand-500)] hover:bg-[var(--color-brand-500)]/10 transition-all cursor-pointer disabled:opacity-50 opacity-0 group-hover:opacity-100"
          aria-label="Trigger sync"
        >
          {actionLoading === "trigger" ? <SpinnerIcon /> : <PlayIcon />}
        </button>

        {/* Pause / Resume toggle */}
        <button
          onClick={handleTogglePause}
          disabled={actionLoading !== null || sync.status === "STOPPED"}
          title={sync.status === "PAUSED" ? "Resume sync" : "Pause sync"}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md transition-all cursor-pointer disabled:opacity-50 opacity-0 group-hover:opacity-100",
            sync.status === "PAUSED"
              ? "text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
              : "text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10"
          )}
          aria-label={sync.status === "PAUSED" ? "Resume sync" : "Pause sync"}
        >
          {actionLoading === "start" || actionLoading === "pause" ? (
            <SpinnerIcon />
          ) : sync.status === "PAUSED" ? (
            <PlayIcon />
          ) : (
            <PauseIcon />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

const AUTO_REFRESH_INTERVAL_MS = 30_000;

export function SyncsPage() {
  const { connections, fetchConnections, isLoading: connectionsLoading } =
    useConnectionsStore();
  const { syncs, isLoading, error, fetchSyncs } = useSyncsStore();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load connections on mount
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Extract selected connection from the key
  const selectedConnection = useMemo(() => {
    if (!selectedKey) return null;
    return connections.find(
      (c) => `${c.provider_config_key}:${c.connection_id}` === selectedKey
    ) ?? null;
  }, [connections, selectedKey]);

  // Fetch syncs when connection changes
  const fetchSyncsForConnection = useCallback(() => {
    if (selectedConnection) {
      fetchSyncs(selectedConnection.connection_id, selectedConnection.provider_config_key);
    }
  }, [selectedConnection, fetchSyncs]);

  useEffect(() => {
    fetchSyncsForConnection();
  }, [fetchSyncsForConnection]);

  // Auto-refresh on 30s interval
  useEffect(() => {
    if (!selectedConnection) return;
    intervalRef.current = setInterval(fetchSyncsForConnection, AUTO_REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedConnection, fetchSyncsForConnection]);

  function handleSelectConnection(conn: NangoConnectionSummary) {
    setSelectedKey(`${conn.provider_config_key}:${conn.connection_id}`);
    setSearch("");
  }

  // Filter and sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return syncs
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.status.toLowerCase().includes(q))
      .sort((a, b) => {
        let av = "", bv = "";
        if (sortKey === "name") { av = a.name; bv = b.name; }
        else if (sortKey === "status") { av = a.status; bv = b.status; }
        else if (sortKey === "frequency") { av = a.frequency ?? ""; bv = b.frequency ?? ""; }
        else if (sortKey === "finishedAt") { av = a.finishedAt ?? ""; bv = b.finishedAt ?? ""; }
        else { av = a.nextScheduledSyncAt ?? ""; bv = b.nextScheduledSyncAt ?? ""; }
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [syncs, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)] relative">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center gap-4 shrink-0">
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Syncs
        </h1>
        <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          {!isLoading && selectedConnection && `${filtered.length} of ${syncs.length}`}
        </span>
        <div className="flex-1" />

        {/* Connection selector */}
        <ConnectionSelector
          connections={connections}
          selectedId={selectedKey}
          onSelect={handleSelectConnection}
        />

        {/* Search */}
        {selectedConnection && (
          <div className="relative w-52">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search syncs…"
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
            />
          </div>
        )}

        {/* Refresh */}
        {selectedConnection && (
          <button
            onClick={fetchSyncsForConnection}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshIcon />
            Refresh
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)] shrink-0">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* No connection selected */}
        {!selectedConnection && !connectionsLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-20">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
              <SyncIcon />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Select a connection
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Choose a connection above to view its syncs.
              </p>
            </div>
          </div>
        )}

        {/* Column headers */}
        {selectedConnection && !isLoading && syncs.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] sticky top-0 z-10">
            <SortHeader label="Sync Name" sortKey="name" current={sortKey} dir={sortDir} onToggle={toggleSort} className="flex-1" />
            <SortHeader label="Status" sortKey="status" current={sortKey} dir={sortDir} onToggle={toggleSort} className="w-24" />
            <SortHeader label="Frequency" sortKey="frequency" current={sortKey} dir={sortDir} onToggle={toggleSort} className="w-28" />
            <SortHeader label="Last Run" sortKey="finishedAt" current={sortKey} dir={sortDir} onToggle={toggleSort} className="w-40" />
            <SortHeader label="Next Run" sortKey="nextScheduledSyncAt" current={sortKey} dir={sortDir} onToggle={toggleSort} className="w-40" />
            <div className="w-20 text-xs text-[var(--color-text-secondary)] text-right">Records</div>
            <div className="w-20" />
          </div>
        )}

        {/* Loading */}
        {(isLoading || connectionsLoading) && (
          <>
            {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
          </>
        )}

        {/* Empty state */}
        {selectedConnection && !isLoading && syncs.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-20">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
              <SyncIcon />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                No syncs found
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                This connection has no syncs configured.
              </p>
            </div>
          </div>
        )}

        {/* No search results */}
        {selectedConnection && !isLoading && syncs.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-sm text-[var(--color-text-secondary)]">No syncs match &ldquo;{search}&rdquo;</p>
            <button onClick={() => setSearch("")} className="text-xs text-[var(--color-brand-400)] hover:underline cursor-pointer">
              Clear search
            </button>
          </div>
        )}

        {/* Rows */}
        {selectedConnection &&
          filtered.map((sync) => (
            <SyncRow
              key={sync.id}
              sync={sync}
              providerConfigKey={selectedConnection.provider_config_key}
              connectionId={selectedConnection.connection_id}
            />
          ))}
      </div>
    </div>
  );
}
