import { useEffect, useMemo, useState } from "react";
import type { NangoConnectionDetail, NangoConnectionSummary } from "@nango-gui/shared";
import { useConnectionsStore } from "@/store/connectionsStore";
import { ConnectModal } from "@/components/connections/ConnectModal";
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

function ChevronIcon({ direction }: { direction: "up" | "down" | "right" | "left" }) {
  const deg = { up: 0, right: 90, down: 180, left: 270 }[direction];
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: `rotate(${deg}deg)` }}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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

function PlugIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

type SortKey = "provider" | "connection_id" | "created";
type SortDir = "asc" | "desc";

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
            {isDeleting && (
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
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
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)] font-medium">
                active
              </span>
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
            </dl>
          </section>

          {/* Raw metadata */}
          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 w-16 rounded bg-[var(--color-bg-overlay)]" />
              <div className="h-32 rounded-lg bg-[var(--color-bg-overlay)]" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
              {error}
            </div>
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
                {connectLoading && (
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
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
  const creds = detail.credentials as Record<string, unknown>;
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
  const { connections, isLoading, error, fetchConnections, deleteConnection } =
    useConnectionsStore();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<NangoConnectionSummary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NangoConnectionSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return connections
      .filter((c) =>
        !q ||
        c.connection_id.toLowerCase().includes(q) ||
        c.provider_config_key.toLowerCase().includes(q) ||
        (c.provider ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let av = "", bv = "";
        if (sortKey === "provider") { av = a.provider_config_key; bv = b.provider_config_key; }
        else if (sortKey === "connection_id") { av = a.connection_id; bv = b.connection_id; }
        else { av = a.created; bv = b.created; }
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [connections, search, sortKey, sortDir]);

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
        {/* Search */}
        <div className="relative w-64">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connections…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
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
        {/* Connect new */}
        <ConnectModal onConnected={() => fetchConnections()}>
          {({ open, isLoading: connectLoading }) => (
            <button
              onClick={open}
              disabled={connectLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {connectLoading ? (
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <span className="text-base leading-none">+</span>
              )}
              Connect
            </button>
          )}
        </ConnectModal>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)] shrink-0">
          {error}
        </div>
      )}

      {deleteError && (
        <div className="mx-6 mt-4 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)] shrink-0">
          {deleteError}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {/* Column headers */}
        {!isLoading && connections.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] sticky top-0 z-10">
            <div className="w-8 shrink-0" />
            <SortHeader label="Provider" sortKey="provider" current={sortKey} dir={sortDir} onToggle={toggleSort} className="flex-1" />
            <SortHeader label="Connection ID" sortKey="connection_id" current={sortKey} dir={sortDir} onToggle={toggleSort} className="w-48" />
            <div className="w-16 text-xs text-[var(--color-text-secondary)]">Status</div>
            <SortHeader label="Created" sortKey="created" current={sortKey} dir={sortDir} onToggle={toggleSort} className="w-36" />
          </div>
        )}

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
            <ConnectModal onConnected={() => fetchConnections()}>
              {({ open, isLoading: connectLoading }) => (
                <button
                  onClick={open}
                  disabled={connectLoading}
                  className="px-4 py-2 text-sm rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Connect your first integration
                </button>
              )}
            </ConnectModal>
          </div>
        )}

        {/* No search results */}
        {!isLoading && connections.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <p className="text-sm text-[var(--color-text-secondary)]">No connections match "{search}"</p>
            <button onClick={() => setSearch("")} className="text-xs text-[var(--color-brand-400)] hover:underline cursor-pointer">
              Clear search
            </button>
          </div>
        )}

        {/* Rows */}
        {filtered.map((conn) => (
          <ConnectionRow
            key={`${conn.provider_config_key}:${conn.connection_id}`}
            connection={conn}
            isSelected={selected?.connection_id === conn.connection_id && selected?.provider_config_key === conn.provider_config_key}
            onClick={() => setSelected((s) =>
              s?.connection_id === conn.connection_id && s?.provider_config_key === conn.provider_config_key ? null : conn
            )}
            onDelete={() => setPendingDelete(conn)}
          />
        ))}
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

function ConnectionRow({
  connection,
  isSelected,
  onClick,
  onDelete,
}: {
  connection: NangoConnectionSummary;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] cursor-pointer transition-colors group",
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
      <div className="w-16">
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
          active
        </span>
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
