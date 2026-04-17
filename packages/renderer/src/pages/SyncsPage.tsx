import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NangoConnectionSummary } from "@nango-gui/shared";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useSyncsStore } from "@/store/syncsStore";
import { SearchIcon, RefreshIcon, SyncIcon } from "@/components/icons";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { searchInputClass } from "@/lib/utils";
import { ConnectionSelector } from "@/components/syncs/ConnectionSelector";
import { SortHeader, type SyncSortKey, type SortDir } from "@/components/syncs/SortHeader";
import { SyncRow } from "@/components/syncs/SyncRow";
import { SyncRowSkeleton } from "@/components/syncs/SyncRowSkeleton";

const BASE_REFRESH_MS = 30_000;
const MAX_BACKOFF_MULTIPLIER = 4;

export function SyncsPage() {
  const { connections, fetchConnections, isLoading: connectionsLoading } =
    useConnectionsStore();
  const { syncs, isLoading, error, fetchSyncs, fetchErrorCount } = useSyncsStore();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SyncSortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const selectedConnection = useMemo(() => {
    if (!selectedKey) return null;
    return connections.find(
      (c) => `${c.provider_config_key}:${c.connection_id}` === selectedKey
    ) ?? null;
  }, [connections, selectedKey]);

  const fetchSyncsForConnection = useCallback(() => {
    if (selectedConnection) {
      fetchSyncs(selectedConnection.connection_id, selectedConnection.provider_config_key);
    }
  }, [selectedConnection, fetchSyncs]);

  useEffect(() => {
    fetchSyncsForConnection();
  }, [fetchSyncsForConnection]);

  // Auto-refresh with exponential backoff on repeated errors
  useEffect(() => {
    if (!selectedConnection) return;
    const multiplier = Math.min(
      Math.pow(2, fetchErrorCount),
      MAX_BACKOFF_MULTIPLIER
    );
    const interval = BASE_REFRESH_MS * multiplier;
    intervalRef.current = setInterval(fetchSyncsForConnection, interval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedConnection, fetchSyncsForConnection, fetchErrorCount]);

  function handleSelectConnection(conn: NangoConnectionSummary) {
    setSelectedKey(`${conn.provider_config_key}:${conn.connection_id}`);
    setSearch("");
  }

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

  function toggleSort(key: SyncSortKey) {
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

        <ConnectionSelector
          connections={connections}
          selectedId={selectedKey}
          onSelect={handleSelectConnection}
        />

        {selectedConnection && (
          <div className="relative w-52">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search syncs\u2026"
              className={searchInputClass}
            />
          </div>
        )}

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
      {error && <ErrorBanner message={error} className="mx-6 mt-4 shrink-0" />}

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
            {Array.from({ length: 6 }).map((_, i) => <SyncRowSkeleton key={i} />)}
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
