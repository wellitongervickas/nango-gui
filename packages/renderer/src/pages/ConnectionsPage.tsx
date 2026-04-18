import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type {
  NangoConnectionDetail,
  NangoConnectionSummary,
  ConnectionStatus,
} from "@nango-gui/shared";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useConnectFlowStore } from "@/store/connectFlowStore";
import { ConnectModal } from "@/components/connections/ConnectModal";
import { cn, searchInputClass } from "@/lib/utils";
import { SearchIcon, ChevronIcon, XIcon, TrashIcon, RefreshIcon, PlugIcon, SpinnerIcon } from "@/components/icons";
import { ErrorBanner } from "@/components/common/ErrorBanner";

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

type SortKey = "provider" | "connection_id" | "created";
type SortDir = "asc" | "desc";

const ROW_HEIGHT = 52;

const STATUS_OPTIONS: { value: ConnectionStatus | null; label: string }[] = [
  { value: null, label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "syncing", label: "Syncing" },
  { value: "broken", label: "Broken" },
  { value: "expired", label: "Expired" },
];

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConnectionStatus | undefined }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-secondary)] animate-pulse" />
        ...
      </span>
    );
  }

  const config: Record<ConnectionStatus, { color: string; bgClass: string; label: string; pulse?: boolean }> = {
    active: { color: "var(--color-success)", bgClass: "bg-[var(--color-success)]/15 text-[var(--color-success)]", label: "active" },
    syncing: { color: "var(--color-brand-400)", bgClass: "bg-[var(--color-brand-400)]/15 text-[var(--color-brand-400)]", label: "syncing", pulse: true },
    broken: { color: "var(--color-warning, #f59e0b)", bgClass: "bg-[#f59e0b]/15 text-[#f59e0b]", label: "broken" },
    expired: { color: "var(--color-error)", bgClass: "bg-[var(--color-error)]/15 text-[var(--color-error)]", label: "expired" },
  };

  const c = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", c.bgClass)}>
      <span
        className={cn("w-1.5 h-1.5 rounded-full", c.pulse && "animate-pulse")}
        style={{ backgroundColor: c.color }}
      />
      {c.label}
    </span>
  );
}

// ── Health score bar ──────────────────────────────────────────────────────

function HealthBar({ score }: { score: number | undefined }) {
  if (score == null) {
    return <div className="w-full h-1 rounded-full bg-[var(--color-bg-overlay)]" />;
  }

  let color: string;
  if (score >= 80) color = "var(--color-success)";
  else if (score >= 60) color = "#22c55e"; // green-500
  else if (score >= 40) color = "#f59e0b"; // amber-500
  else color = "var(--color-error)";

  return (
    <div className="relative w-full h-1 rounded-full bg-[var(--color-bg-overlay)] overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
        style={{ width: `${score}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] animate-pulse">
      <div className="w-8 h-8 rounded-md bg-[var(--color-bg-overlay)] shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-32 rounded bg-[var(--color-bg-overlay)]" />
        <div className="h-3 w-24 rounded bg-[var(--color-bg-overlay)]" />
      </div>
      <div className="h-5 w-16 rounded-full bg-[var(--color-bg-overlay)]" />
      <div className="h-3 w-20 rounded bg-[var(--color-bg-overlay)]" />
    </div>
  );
}

// ── Delete confirmation ────────────────────────────────────────────────────

interface DeleteDialogProps {
  connection: NangoConnectionSummary;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteDialog({ connection, onConfirm, onCancel, isDeleting }: DeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-md p-6 mx-4">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
          Delete connection?
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          This will permanently delete the connection{" "}
          <span className="font-mono text-[var(--color-text-primary)]">
            {connection.connection_id}
          </span>{" "}
          for <span className="font-medium text-[var(--color-text-primary)]">{connection.provider_config_key}</span>.
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting && <SpinnerIcon />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────

interface DetailPanelProps {
  connection: NangoConnectionSummary;
  onClose: () => void;
  onDelete: (connection: NangoConnectionSummary) => void;
}

function DetailPanel({ connection, onClose, onDelete }: DetailPanelProps) {
  const [detail, setDetail] = useState<NangoConnectionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const healthData = useConnectionsStore((s) =>
    s.healthData[`${connection.provider_config_key}:${connection.connection_id}`]
  );

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    window.nango
      .getConnection({ providerConfigKey: connection.provider_config_key, connectionId: connection.connection_id })
      .then((res) => {
        if (res.status === "error") {
          setError(res.error);
        } else {
          setDetail(res.data);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, [connection.provider_config_key, connection.connection_id]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {/* Panel */}
      <aside className="fixed right-0 top-12 bottom-6 z-40 w-[420px] bg-[var(--color-bg-surface)] border-l border-[var(--color-border)] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={healthData?.status} />
              {healthData && (
                <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
                  {healthData.healthScore}/100
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] font-mono">
              {connection.connection_id}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
              {connection.provider_config_key}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        {/* Health bar */}
        {healthData && (
          <div className="px-5 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Health</span>
              <span className={cn(
                "text-xs font-semibold tabular-nums",
                healthData.healthScore >= 60 ? "text-[var(--color-success)]" : "text-[#f59e0b]"
              )}>
                {healthData.healthScore}%
              </span>
            </div>
            <HealthBar score={healthData.healthScore} />
            {healthData.healthScore < 60 && (
              <p className="text-xs text-[#f59e0b] mt-1.5">
                Health score below threshold — check sync errors and token status.
              </p>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
              Details
            </h3>
            <dl className="space-y-2.5">
              <Row label="Provider" value={connection.provider || connection.provider_config_key} />
              <Row label="Auth type" value={detail ? guessAuthType(detail) : "—"} />
              <Row label="Created" value={formatDate(connection.created)} />
              {detail?.updated_at && (
                <Row label="Last updated" value={formatDate(detail.updated_at)} />
              )}
              {healthData && (
                <>
                  <Row label="Syncs" value={String(healthData.syncCount)} />
                  <Row label="Errors" value={String(healthData.errorCount)} />
                  {healthData.lastSeen && (
                    <Row label="Last seen" value={formatDate(healthData.lastSeen)} />
                  )}
                </>
              )}
            </dl>
          </section>

          {/* Raw metadata */}
          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-16 rounded bg-[var(--color-bg-overlay)]" />
              <div className="h-32 rounded-lg bg-[var(--color-bg-overlay)]" />
            </div>
          ) : error ? (
            <ErrorBanner message={error} />
          ) : detail ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
                Metadata
              </h3>
              <pre className="text-xs bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg p-4 overflow-auto max-h-60 text-[var(--color-text-secondary)] font-mono">
                {JSON.stringify(detail.credentials ?? {}, null, 2)}
              </pre>
            </section>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-[var(--color-border)] flex gap-2 shrink-0">
          <ConnectModal>
            {({ open, isLoading: connectLoading }) => (
              <button
                onClick={open}
                disabled={connectLoading}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {connectLoading && <SpinnerIcon />}
                Re-authorize
              </button>
            )}
          </ConnectModal>
          <button
            onClick={() => onDelete(connection)}
            className="px-3 py-2 text-sm rounded-lg border border-[var(--color-error)]/40 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors cursor-pointer flex items-center gap-2"
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      </aside>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-[var(--color-text-secondary)] shrink-0">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)] text-right truncate">{value}</dd>
    </div>
  );
}

function guessAuthType(detail: NangoConnectionDetail): string {
  const creds = detail.credentials as Record<string, unknown> | undefined;
  if (!creds) return "Unknown";
  if (creds.access_token) return "OAuth 2.0";
  if (creds.api_key) return "API Key";
  if (creds.username) return "Basic Auth";
  return "OAuth";
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Main page ──────────────────────────────────────────────────────────────

export function ConnectionsPage() {
  const {
    connections,
    isLoading,
    error,
    healthData,
    statusFilter,
    fetchConnections,
    deleteConnection,
    fetchConnectionHealth,
    setStatusFilter,
  } = useConnectionsStore();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<NangoConnectionSummary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NangoConnectionSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Close status dropdown on outside click
  useEffect(() => {
    if (!showStatusDropdown) return;
    function handleClick() {
      setShowStatusDropdown(false);
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [showStatusDropdown]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return connections
      .filter((c) => {
        // Text search
        if (
          q &&
          !c.connection_id.toLowerCase().includes(q) &&
          !c.provider_config_key.toLowerCase().includes(q) &&
          !(c.provider ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
        // Status filter
        if (statusFilter) {
          const key = `${c.provider_config_key}:${c.connection_id}`;
          const health = healthData[key];
          if (!health) return true; // Show while loading
          return health.status === statusFilter;
        }
        return true;
      })
      .sort((a, b) => {
        let av = "", bv = "";
        if (sortKey === "provider") { av = a.provider_config_key; bv = b.provider_config_key; }
        else if (sortKey === "connection_id") { av = a.connection_id; bv = b.connection_id; }
        else { av = a.created; bv = b.created; }
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [connections, search, sortKey, sortDir, statusFilter, healthData]);

  // TanStack Virtual
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Lazily fetch health data for visible connections
  const visibleItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    for (const item of visibleItems) {
      const conn = filtered[item.index];
      if (conn) {
        fetchConnectionHealth(conn.provider_config_key, conn.connection_id);
      }
    }
  }, [visibleItems, filtered, fetchConnectionHealth]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteConnection(pendingDelete.provider_config_key, pendingDelete.connection_id);
      setPendingDelete(null);
      if (selected?.connection_id === pendingDelete.connection_id) setSelected(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  const handleRowClick = useCallback((conn: NangoConnectionSummary) => {
    setSelected((s) =>
      s?.connection_id === conn.connection_id && s?.provider_config_key === conn.provider_config_key ? null : conn
    );
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)] relative">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center gap-4 shrink-0">
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Connections
        </h1>
        <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          {!isLoading && `${filtered.length} of ${connections.length}`}
        </span>
        <div className="flex-1" />

        {/* Status filter dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowStatusDropdown((v) => !v);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer",
              statusFilter
                ? "border-[var(--color-brand-500)] text-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]"
            )}
          >
            <FilterIcon />
            {statusFilter ? STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label : "Status"}
          </button>
          {showStatusDropdown && (
            <div
              className="absolute top-full right-0 mt-1 w-40 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-20 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value ?? "all"}
                  onClick={() => {
                    setStatusFilter(opt.value);
                    setShowStatusDropdown(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer",
                    statusFilter === opt.value
                      ? "text-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10"
                      : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-64">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
            <SearchIcon />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connections…"
            className={searchInputClass}
          />
        </div>

        {/* Refresh */}
        <button
          onClick={() => fetchConnections()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshIcon />
          Refresh
        </button>

        {/* Connect new — opens the ⌘K search modal */}
        <button
          onClick={() => useConnectFlowStore.getState().openSearch()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          <span className="text-base leading-none">+</span>
          Add
        </button>
      </div>

      {/* Error banner */}
      {error && <ErrorBanner message={error} className="mx-6 mt-4 shrink-0" />}
      {deleteError && <ErrorBanner message={deleteError} className="mx-6 mt-4 shrink-0" />}

      {/* Table */}
      {/* Column headers */}
      {!isLoading && connections.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0">
          <div className="w-8 shrink-0" />
          <SortHeader label="Provider" sortKey="provider" current={sortKey} dir={sortDir} onToggle={toggleSort} className="flex-1" />
          <SortHeader label="Connection ID" sortKey="connection_id" current={sortKey} dir={sortDir} onToggle={toggleSort} className="w-48" />
          <div className="w-20 text-xs text-[var(--color-text-secondary)]">Status</div>
          <div className="w-16 text-xs text-[var(--color-text-secondary)]">Health</div>
          <SortHeader label="Created" sortKey="created" current={sortKey} dir={sortDir} onToggle={toggleSort} className="w-36" />
          <div className="w-7" />
        </div>
      )}

      {/* Virtual list area */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {/* Loading */}
        {isLoading && (
          <>
            {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
          </>
        )}

        {/* Empty state */}
        {!isLoading && connections.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-20">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
              <PlugIcon />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                No connections yet
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Connect your first integration to get started.
              </p>
            </div>
            <button
              onClick={() => useConnectFlowStore.getState().openSearch()}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer"
            >
              Connect your first integration
            </button>
          </div>
        )}

        {/* No search/filter results */}
        {!isLoading && connections.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-sm text-[var(--color-text-secondary)]">
              No connections match {search ? `"${search}"` : "this filter"}
            </p>
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter(null);
              }}
              className="text-xs text-[var(--color-brand-400)] hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Virtual rows */}
        {filtered.length > 0 && (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const conn = filtered[virtualRow.index];
              if (!conn) return null;
              const key = `${conn.provider_config_key}:${conn.connection_id}`;
              const health = healthData[key];
              return (
                <div
                  key={key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ConnectionRow
                    connection={conn}
                    health={health}
                    isSelected={
                      selected?.connection_id === conn.connection_id &&
                      selected?.provider_config_key === conn.provider_config_key
                    }
                    onClick={() => handleRowClick(conn)}
                    onDelete={() => setPendingDelete(conn)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          connection={selected}
          onClose={() => setSelected(null)}
          onDelete={(c) => { setSelected(null); setPendingDelete(c); }}
        />
      )}

      {/* Delete dialog */}
      {pendingDelete && (
        <DeleteDialog
          connection={pendingDelete}
          onConfirm={handleDelete}
          onCancel={() => { setPendingDelete(null); setDeleteError(null); }}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}

// ── SortHeader ─────────────────────────────────────────────────────────────

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

// ── ConnectionRow ──────────────────────────────────────────────────────────

interface ConnectionRowProps {
  connection: NangoConnectionSummary;
  health: import("@nango-gui/shared").NangoConnectionHealthData | undefined;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function ConnectionRow({ connection, health, isSelected, onClick, onDelete }: ConnectionRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "flex items-center gap-4 px-4 h-full border-b border-[var(--color-border)] cursor-pointer transition-colors group",
        isSelected
          ? "bg-[var(--color-brand-500)]/10"
          : "hover:bg-[var(--color-bg-surface)]"
      )}
    >
      {/* Provider avatar */}
      <div className="w-8 h-8 rounded-md bg-[var(--color-bg-overlay)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-secondary)] uppercase shrink-0">
        {(connection.provider_config_key[0] ?? "?").toUpperCase()}
      </div>

      {/* Provider name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          {connection.provider_config_key}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] truncate">
          {connection.provider || "—"}
        </p>
      </div>

      {/* Connection ID */}
      <div className="w-48 min-w-0">
        <p className="text-sm font-mono text-[var(--color-text-secondary)] truncate">
          {connection.connection_id}
        </p>
      </div>

      {/* Status */}
      <div className="w-20">
        <StatusBadge status={health?.status} />
      </div>

      {/* Health bar */}
      <div className="w-16 flex flex-col gap-0.5">
        <HealthBar score={health?.healthScore} />
        {health && health.healthScore < 60 && (
          <span className="text-[9px] text-[#f59e0b] leading-none">low</span>
        )}
      </div>

      {/* Created */}
      <div className="w-36 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {formatDate(connection.created)}
      </div>

      {/* Row actions */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-all cursor-pointer"
        aria-label="Delete connection"
      >
        <TrashIcon />
      </button>
    </div>
  );
}
