import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NangoConnectionSummary, NangoSyncRecord } from "@nango-gui/shared";
import { useConnectionsStore } from "@/store/connectionsStore";
import { useActionsStore } from "@/store/actionsStore";
import { useSyncsStore } from "@/store/syncsStore";
import { useEnvironmentStore } from "@/store/environmentStore";
import { cn } from "@/lib/utils";
import {
  SearchIcon,
  SpinnerIcon,
  PlayIcon,
  RefreshIcon,
  ChevronIcon,
  AlertTriangleIcon,
} from "@/components/icons";

// ── Types ──────────────────────────────────────────────────────────────────

type PlaygroundTab = "actions" | "syncs";

interface JsonValidation {
  valid: boolean;
  error: string | null;
  parsed: Record<string, unknown> | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function validateJson(text: string): JsonValidation {
  if (!text.trim()) {
    return { valid: true, error: null, parsed: {} };
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { valid: false, error: "Input must be a JSON object", parsed: null };
    }
    return { valid: true, error: null, parsed: parsed as Record<string, unknown> };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Invalid JSON",
      parsed: null,
    };
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Connection Selector ───────────────────────────────────────────────────

function ConnectionSelector({
  connections,
  selected,
  onSelect,
}: {
  connections: NangoConnectionSummary[];
  selected: { connectionId: string; integrationId: string } | null;
  onSelect: (connectionId: string, integrationId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return connections;
    return connections.filter(
      (c) =>
        c.connection_id.toLowerCase().includes(q) ||
        c.provider_config_key.toLowerCase().includes(q) ||
        (c.provider ?? "").toLowerCase().includes(q)
    );
  }, [connections, search]);

  useEffect(() => {
    if (!isOpen) return;
    function close() { setIsOpen(false); }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [isOpen]);

  const selectedConn = selected
    ? connections.find(
        (c) =>
          c.connection_id === selected.connectionId &&
          c.provider_config_key === selected.integrationId
      )
    : null;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors cursor-pointer w-full text-left",
          selectedConn
            ? "border-[var(--color-border)] text-[var(--color-text-primary)] bg-[var(--color-bg-base)]"
            : "border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-bg-base)]"
        )}
      >
        {selectedConn ? (
          <>
            <div className="w-6 h-6 rounded bg-[var(--color-bg-overlay)] flex items-center justify-center text-[10px] font-bold uppercase text-[var(--color-text-secondary)]">
              {selectedConn.provider_config_key[0]}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium">{selectedConn.provider_config_key}</span>
              <span className="text-[var(--color-text-secondary)] ml-1.5 font-mono text-xs">
                {selectedConn.connection_id}
              </span>
            </div>
          </>
        ) : (
          <span>Select a connection…</span>
        )}
        <ChevronIcon direction={isOpen ? "up" : "down"} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-30 overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border)]">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter connections…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)]"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-[var(--color-text-secondary)] text-center">
                No connections found
              </p>
            )}
            {filtered.map((c) => (
              <button
                key={`${c.provider_config_key}:${c.connection_id}`}
                onClick={() => {
                  onSelect(c.connection_id, c.provider_config_key);
                  setIsOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer",
                  selected?.connectionId === c.connection_id &&
                    selected?.integrationId === c.provider_config_key
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                    : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]"
                )}
              >
                <div className="w-5 h-5 rounded bg-[var(--color-bg-overlay)] flex items-center justify-center text-[9px] font-bold uppercase text-[var(--color-text-secondary)]">
                  {c.provider_config_key[0]}
                </div>
                <span className="font-medium">{c.provider_config_key}</span>
                <span className="text-[var(--color-text-secondary)] font-mono">
                  {c.connection_id}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── JSON Viewer ───────────────────────────────────────────────────────────

function JsonViewer({ data, maxHeight }: { data: unknown; maxHeight?: string }) {
  const text =
    data === undefined || data === null
      ? "null"
      : JSON.stringify(data, null, 2);

  return (
    <pre
      className="text-xs font-mono bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg p-4 overflow-auto text-[var(--color-text-secondary)] whitespace-pre-wrap"
      style={{ maxHeight: maxHeight ?? "320px" }}
    >
      {text}
    </pre>
  );
}

// ── Production gate banner ────────────────────────────────────────────────

function ProdGateBanner() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 text-sm text-[var(--color-warning)]">
      <AlertTriangleIcon />
      <span>
        Production environment — triggering actions and syncs may affect live data. Proceed with
        caution.
      </span>
    </div>
  );
}

// ── Actions Tab ───────────────────────────────────────────────────────────

function ActionsTab({
  connectionId,
  integrationId,
}: {
  connectionId: string;
  integrationId: string;
}) {
  const [actionName, setActionName] = useState("");
  const [inputText, setInputText] = useState("{}");
  const { actionResult, isExecutingAction, actionError, triggerAction, clearActionResult } =
    useActionsStore();

  const validation = useMemo(() => validateJson(inputText), [inputText]);
  const startTime = useRef<number>(0);
  const [duration, setDuration] = useState<number | null>(null);

  const handleTrigger = useCallback(async () => {
    if (!actionName.trim() || !validation.valid || !validation.parsed) return;
    startTime.current = Date.now();
    setDuration(null);
    clearActionResult();
    await triggerAction(integrationId, connectionId, actionName.trim(), validation.parsed);
    setDuration(Date.now() - startTime.current);
  }, [actionName, validation, integrationId, connectionId, triggerAction, clearActionResult]);

  const canTrigger = actionName.trim() !== "" && validation.valid && !isExecutingAction;

  return (
    <div className="flex flex-col gap-4">
      {/* Action name */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
          Action name
        </label>
        <input
          type="text"
          value={actionName}
          onChange={(e) => setActionName(e.target.value)}
          placeholder="e.g. create-issue, fetch-user"
          className="w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
          onKeyDown={(e) => {
            if (e.key === "Enter" && canTrigger) handleTrigger();
          }}
        />
      </div>

      {/* JSON input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">
            Input (JSON)
          </label>
          {!validation.valid && validation.error && (
            <span className="text-[10px] text-[var(--color-error)]">{validation.error}</span>
          )}
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={6}
          spellCheck={false}
          className={cn(
            "w-full px-3 py-2 text-xs font-mono bg-[var(--color-bg-base)] border rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none transition-colors resize-y",
            validation.valid
              ? "border-[var(--color-border)] focus:border-[var(--color-border-focus)]"
              : "border-[var(--color-error)]/50 focus:border-[var(--color-error)]"
          )}
        />
      </div>

      {/* Trigger button */}
      <button
        onClick={handleTrigger}
        disabled={!canTrigger}
        className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isExecutingAction ? (
          <>
            <SpinnerIcon />
            Executing…
          </>
        ) : (
          <>
            <PlayIcon />
            Trigger Action
          </>
        )}
      </button>

      {/* Result */}
      {(actionResult !== null || actionError) && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {actionError ? "Error" : "Result"}
            </label>
            {duration !== null && (
              <span className="text-[10px] text-[var(--color-text-secondary)] tabular-nums">
                {formatDuration(duration)}
              </span>
            )}
          </div>
          {actionError ? (
            <div className="px-3 py-2 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 text-sm text-[var(--color-error)]">
              {actionError}
            </div>
          ) : (
            <JsonViewer data={actionResult} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Syncs Tab ─────────────────────────────────────────────────────────────

function SyncsTab({
  connectionId,
  integrationId,
}: {
  connectionId: string;
  integrationId: string;
}) {
  const { syncs, isLoading, error, syncActionLoading, fetchSyncs, triggerSync } =
    useSyncsStore();

  const [selectedSync, setSelectedSync] = useState<string | null>(null);
  const [fullResync, setFullResync] = useState(false);

  useEffect(() => {
    fetchSyncs(connectionId, integrationId);
  }, [connectionId, integrationId, fetchSyncs]);

  // Auto-select first sync
  useEffect(() => {
    if (syncs.length > 0 && !selectedSync) {
      setSelectedSync(syncs[0].name);
    }
  }, [syncs, selectedSync]);

  const selectedSyncRecord = syncs.find((s) => s.name === selectedSync);

  const handleTrigger = useCallback(async () => {
    if (!selectedSync) return;
    await triggerSync(integrationId, selectedSync, connectionId, fullResync);
    // Refresh after trigger
    await fetchSyncs(connectionId, integrationId);
  }, [selectedSync, fullResync, integrationId, connectionId, triggerSync, fetchSyncs]);

  const isBusy = selectedSync ? syncActionLoading[selectedSync] : false;

  return (
    <div className="flex flex-col gap-4">
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <SpinnerIcon /> Loading syncs…
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 text-sm text-[var(--color-error)]">
          {error}
        </div>
      )}

      {!isLoading && syncs.length === 0 && !error && (
        <p className="text-sm text-[var(--color-text-secondary)] py-4 text-center">
          No syncs configured for this connection.
        </p>
      )}

      {syncs.length > 0 && (
        <>
          {/* Sync selector */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Select sync
            </label>
            <div className="grid gap-1.5">
              {syncs.map((sync) => (
                <button
                  key={sync.name}
                  onClick={() => setSelectedSync(sync.name)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg border text-left text-sm transition-colors cursor-pointer",
                    selectedSync === sync.name
                      ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/5 text-[var(--color-text-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-focus)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  <span className="font-medium flex-1">{sync.name}</span>
                  <SyncStatusBadge status={sync.status} />
                  {sync.frequency && (
                    <span className="text-[10px] text-[var(--color-text-secondary)] font-mono">
                      {sync.frequency}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={fullResync}
              onChange={(e) => setFullResync(e.target.checked)}
              className="rounded border-[var(--color-border)]"
            />
            Full resync (clear existing data)
          </label>

          {/* Trigger */}
          <button
            onClick={handleTrigger}
            disabled={!selectedSync || isBusy}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isBusy ? (
              <>
                <SpinnerIcon />
                Triggering…
              </>
            ) : (
              <>
                <PlayIcon />
                Trigger Sync
              </>
            )}
          </button>

          {/* Sync detail */}
          {selectedSyncRecord && (
            <SyncDetail sync={selectedSyncRecord} />
          )}
        </>
      )}
    </div>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    RUNNING: { bg: "bg-[var(--color-brand-400)]/15", text: "text-[var(--color-brand-400)]" },
    SUCCESS: { bg: "bg-[var(--color-success)]/15", text: "text-[var(--color-success)]" },
    PAUSED: { bg: "bg-[var(--color-warning)]/15", text: "text-[var(--color-warning)]" },
    ERROR: { bg: "bg-[var(--color-error)]/15", text: "text-[var(--color-error)]" },
    STOPPED: { bg: "bg-[var(--color-bg-overlay)]", text: "text-[var(--color-text-secondary)]" },
  };
  const c = config[status] ?? config.STOPPED;
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", c.bg, c.text)}>
      {status}
    </span>
  );
}

function SyncDetail({ sync }: { sync: NangoSyncRecord }) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-bg-base)]">
      <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
        Sync Details
      </h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-[var(--color-text-secondary)]">Status</dt>
        <dd className="text-[var(--color-text-primary)]">{sync.status}</dd>
        <dt className="text-[var(--color-text-secondary)]">Type</dt>
        <dd className="text-[var(--color-text-primary)]">{sync.type}</dd>
        {sync.frequency && (
          <>
            <dt className="text-[var(--color-text-secondary)]">Frequency</dt>
            <dd className="text-[var(--color-text-primary)] font-mono">{sync.frequency}</dd>
          </>
        )}
        {sync.finishedAt && (
          <>
            <dt className="text-[var(--color-text-secondary)]">Last run</dt>
            <dd className="text-[var(--color-text-primary)]">
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(sync.finishedAt))}
            </dd>
          </>
        )}
        {sync.nextScheduledSyncAt && (
          <>
            <dt className="text-[var(--color-text-secondary)]">Next run</dt>
            <dd className="text-[var(--color-text-primary)]">
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(sync.nextScheduledSyncAt))}
            </dd>
          </>
        )}
        {sync.latestResult && (
          <>
            <dt className="text-[var(--color-text-secondary)]">Last result</dt>
            <dd className="text-[var(--color-text-primary)] font-mono">
              +{sync.latestResult.added} ~{sync.latestResult.updated} -{sync.latestResult.deleted}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export function PlaygroundPage() {
  const [tab, setTab] = useState<PlaygroundTab>("actions");
  const [selected, setSelected] = useState<{
    connectionId: string;
    integrationId: string;
  } | null>(null);

  const connections = useConnectionsStore((s) => s.connections);
  const isLoadingConnections = useConnectionsStore((s) => s.isLoading);
  const fetchConnections = useConnectionsStore((s) => s.fetchConnections);
  const currentEnv = useEnvironmentStore((s) => s.current);

  const isProduction = currentEnv === "production";

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] flex items-center gap-4 shrink-0">
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Playground
        </h1>
        <span className="text-xs text-[var(--color-text-secondary)]">
          Test actions and syncs with live results
        </span>
        <div className="flex-1" />
        <button
          onClick={() => fetchConnections()}
          disabled={isLoadingConnections}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshIcon />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
          {/* Production gate */}
          {isProduction && <ProdGateBanner />}

          {/* Connection selector */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Connection
            </label>
            <ConnectionSelector
              connections={connections}
              selected={selected}
              onSelect={(connectionId, integrationId) =>
                setSelected({ connectionId, integrationId })
              }
            />
          </div>

          {/* Tab selector */}
          <div className="flex gap-1 p-1 bg-[var(--color-bg-overlay)] rounded-lg">
            {(["actions", "syncs"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer capitalize",
                  tab === t
                    ? "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab content — requires a selected connection */}
          {!selected ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-overlay)] flex items-center justify-center text-[var(--color-text-secondary)]">
                <PlayIcon />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Select a connection above to start testing
              </p>
            </div>
          ) : tab === "actions" ? (
            <ActionsTab
              connectionId={selected.connectionId}
              integrationId={selected.integrationId}
            />
          ) : (
            <SyncsTab
              connectionId={selected.connectionId}
              integrationId={selected.integrationId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
