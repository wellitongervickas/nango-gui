import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NangoRecord, NangoRecordFilterAction } from "@nango-gui/shared";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useRecordsStore } from "@/store/recordsStore";
import { cn } from "@/lib/utils";
import { SearchIcon, ChevronIcon, XIcon, RefreshIcon, DatabaseIcon, DownloadIcon, SpinnerIcon } from "@/components/icons";
import { ErrorBanner } from "@/components/common/ErrorBanner";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getDataColumns(records: NangoRecord[]): string[] {
  const keys = new Set<string>();
  for (const record of records.slice(0, 50)) {
    for (const key of Object.keys(record)) {
      if (key !== "_nango_metadata") keys.add(key);
    }
  }
  // Ensure "id" is always first
  const sorted = Array.from(keys).filter((k) => k !== "id");
  sorted.sort();
  return ["id", ...sorted];
}

function cellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCell(s: string): string {
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function exportCsv(records: NangoRecord[], columns: string[]) {
  const allCols = [...columns, "first_seen_at", "last_modified_at", "last_action"];
  const header = allCols.map(escapeCell).join(",");
  const rows = records.map((r) =>
    allCols
      .map((col) => {
        if (col === "first_seen_at") return escapeCell(String(r._nango_metadata.first_seen_at));
        if (col === "last_modified_at") return escapeCell(String(r._nango_metadata.last_modified_at));
        if (col === "last_action") return escapeCell(String(r._nango_metadata.last_action));
        const v = r[col];
        const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
        return escapeCell(s);
      })
      .join(",")
  );
  downloadFile("records.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8");
}

function exportJson(records: NangoRecord[]) {
  downloadFile("records.json", JSON.stringify(records, null, 2), "application/json;charset=utf-8");
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function RowSkeleton({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-[var(--color-border)] animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2.5">
          <div className="h-3.5 rounded bg-[var(--color-bg-overlay)]" style={{ width: `${50 + Math.random() * 50}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Action badge ───────────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; text: string }> = {
  ADDED:   { bg: "bg-[var(--color-success)]/15", text: "text-[var(--color-success)]" },
  added:   { bg: "bg-[var(--color-success)]/15", text: "text-[var(--color-success)]" },
  UPDATED: { bg: "bg-[var(--color-warning)]/15", text: "text-[var(--color-warning)]" },
  updated: { bg: "bg-[var(--color-warning)]/15", text: "text-[var(--color-warning)]" },
  DELETED: { bg: "bg-[var(--color-error)]/15",   text: "text-[var(--color-error)]" },
  deleted: { bg: "bg-[var(--color-error)]/15",   text: "text-[var(--color-error)]" },
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action] ?? { bg: "bg-[var(--color-bg-overlay)]", text: "text-[var(--color-text-secondary)]" };
  return (
    <span className={cn("inline-flex items-center text-xs px-1.5 py-0.5 rounded-md font-mono", style.bg, style.text)}>
      {action.toLowerCase()}
    </span>
  );
}

// ── Detail panel (slide-over) ──────────────────────────────────────────────

function RecordDetailPanel({ record, onClose }: { record: NangoRecord; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <aside className="fixed right-0 top-12 bottom-6 z-40 w-[480px] bg-[var(--color-bg-surface)] border-l border-[var(--color-border)] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)] shrink-0">
          <div>
            <ActionBadge action={record._nango_metadata.last_action} />
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] font-mono mt-1">
              {String(record.id)}
            </h2>
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
          {/* Metadata */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
              Nango Metadata
            </h3>
            <dl className="space-y-2">
              <MetaRow label="First seen" value={formatDate(record._nango_metadata.first_seen_at)} />
              <MetaRow label="Last modified" value={formatDate(record._nango_metadata.last_modified_at)} />
              <MetaRow label="Last action" value={record._nango_metadata.last_action} />
              <MetaRow label="Deleted at" value={record._nango_metadata.deleted_at ? formatDate(record._nango_metadata.deleted_at) : "—"} />
              <MetaRow label="Cursor" value={record._nango_metadata.cursor} />
            </dl>
          </section>

          {/* Full record JSON */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
              Record Data
            </h3>
            <pre className="text-xs bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg p-4 overflow-auto max-h-[60vh] text-[var(--color-text-secondary)] font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(record, null, 2)}
            </pre>
          </section>
        </div>
      </aside>
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-[var(--color-text-secondary)] shrink-0">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)] text-right truncate font-mono">{value}</dd>
    </div>
  );
}

// ── Dropdown ───────────────────────────────────────────────────────────────

function Dropdown<T extends string>({
  value,
  options,
  placeholder,
  onChange,
  className,
}: {
  value: T | null;
  options: { label: string; value: T }[];
  placeholder: string;
  onChange: (v: T | null) => void;
  className?: string;
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

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] hover:border-[var(--color-border-focus)] transition-colors cursor-pointer"
      >
        <span className={value ? "" : "text-[var(--color-text-secondary)]"}>{selectedLabel}</span>
        <ChevronIcon direction={open ? "up" : "down"} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
          {value && (
            <button
              onClick={() => { onChange(null); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] cursor-pointer"
            >
              Clear
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-overlay)] cursor-pointer",
                opt.value === value ? "text-[var(--color-brand-400)] font-medium" : "text-[var(--color-text-primary)]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function RecordsPage() {
  const { connections, isLoading: connectionsLoading, fetchConnections } = useConnectionsStore();
  const {
    records,
    nextCursor,
    isLoading,
    isLoadingMore,
    error,
    connectionId,
    providerConfigKey,
    filter,
    fetchRecords,
    loadMore,
    setFilter,
    reset,
  } = useRecordsStore();

  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [modelInput, setModelInput] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<NangoRecord | null>(null);
  const [search, setSearch] = useState("");
  const [modifiedAfterInput, setModifiedAfterInput] = useState("");

  // Load connections on mount
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Connection options for dropdown
  const connectionOptions = useMemo(
    () =>
      connections.map((c) => ({
        label: `${c.provider_config_key} / ${c.connection_id}`,
        value: `${c.provider_config_key}::${c.connection_id}`,
      })),
    [connections]
  );

  const handleFetch = useCallback(() => {
    if (!selectedConnection || !modelInput.trim()) return;
    const [pck, cid] = selectedConnection.split("::");
    if (!pck || !cid) return;
    fetchRecords(pck, cid, modelInput.trim(), {
      modifiedAfter: modifiedAfterInput || null,
    });
  }, [selectedConnection, modelInput, modifiedAfterInput, fetchRecords]);

  // Derive data columns from loaded records
  const columns = useMemo(() => getDataColumns(records), [records]);

  // Client-side search filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return records;
    return records.filter((r) => {
      for (const col of columns) {
        const v = r[col];
        if (v !== null && v !== undefined && String(v).toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [records, search, columns]);

  const hasData = providerConfigKey && connectionId && records.length > 0;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)] relative">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0 space-y-3">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">Records</h1>
          {hasData && (
            <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
              {filtered.length} of {records.length} loaded
            </span>
          )}
          <div className="flex-1" />

          {/* Export buttons */}
          {hasData && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => exportCsv(filtered, columns)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
              >
                <DownloadIcon /> CSV
              </button>
              <button
                onClick={() => exportJson(filtered)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
              >
                <DownloadIcon /> JSON
              </button>
            </div>
          )}
        </div>

        {/* Controls row */}
        <div className="flex items-end gap-3">
          {/* Connection selector */}
          <div className="w-64">
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Connection</label>
            <Dropdown
              value={selectedConnection}
              options={connectionOptions}
              placeholder={connectionsLoading ? "Loading…" : "Select connection"}
              onChange={(v) => { setSelectedConnection(v); reset(); }}
            />
          </div>

          {/* Model input */}
          <div className="w-48">
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Model</label>
            <input
              type="text"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              placeholder="e.g. Contact"
              className="w-full px-3 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
            />
          </div>

          {/* Filter dropdown */}
          <div className="w-36">
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Filter</label>
            <Dropdown
              value={filter}
              options={[
                { label: "Added", value: "added" as NangoRecordFilterAction },
                { label: "Updated", value: "updated" as NangoRecordFilterAction },
                { label: "Deleted", value: "deleted" as NangoRecordFilterAction },
              ]}
              placeholder="All"
              onChange={setFilter}
            />
          </div>

          {/* Modified after */}
          <div className="w-44">
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Modified after</label>
            <input
              type="datetime-local"
              value={modifiedAfterInput}
              onChange={(e) => setModifiedAfterInput(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
            />
          </div>

          {/* Fetch / Refresh */}
          <button
            onClick={handleFetch}
            disabled={!selectedConnection || !modelInput.trim() || isLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            <RefreshIcon />
            {records.length > 0 ? "Refresh" : "Fetch"}
          </button>
        </div>

        {/* Search (only shown when data loaded) */}
        {hasData && (
          <div className="relative w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search loaded records…"
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
            />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && <ErrorBanner message={error} className="mx-6 mt-4 shrink-0" />}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Empty state: no connection selected */}
        {!isLoading && records.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-20">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
              <DatabaseIcon />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                {selectedConnection ? "Enter a model name and fetch records" : "Select a connection to browse records"}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Records are synced data from your Nango integrations.
              </p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <table className="w-full">
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <RowSkeleton key={i} cols={5} />
              ))}
            </tbody>
          </table>
        )}

        {/* Data table */}
        {!isLoading && records.length > 0 && (
          <>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--color-bg-surface)]">
                <tr className="border-b border-[var(--color-border)]">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">
                    action
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">
                    last_modified
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record, idx) => (
                  <tr
                    key={`${record.id}-${idx}`}
                    onClick={() => setSelectedRecord(record)}
                    className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-surface)] cursor-pointer transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2 text-[var(--color-text-primary)] max-w-[200px] truncate font-mono text-xs">
                        {cellValue(record[col])}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <ActionBadge action={record._nango_metadata.last_action} />
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                      {formatDate(record._nango_metadata.last_modified_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Load more */}
            {nextCursor && (
              <div className="flex justify-center py-4">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isLoadingMore ? <SpinnerIcon /> : null}
                  Load more
                </button>
              </div>
            )}

            {/* No search results */}
            {filtered.length === 0 && search && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <p className="text-sm text-[var(--color-text-secondary)]">No records match &ldquo;{search}&rdquo;</p>
                <button onClick={() => setSearch("")} className="text-xs text-[var(--color-brand-400)] hover:underline cursor-pointer">
                  Clear search
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail panel */}
      {selectedRecord && (
        <RecordDetailPanel record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
    </div>
  );
}
