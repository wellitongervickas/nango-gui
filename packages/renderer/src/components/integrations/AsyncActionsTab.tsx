import { useCallback, useEffect, useMemo, useState } from "react";
import type { AsyncActionStatus, NangoConnectionSummary } from "@nango-gui/shared";
import { useConnectionsStore } from "@/store/connectionsStore";
import {
  useActionsStore,
  type ActionHistoryEntry,
} from "@/store/actionsStore";
import { cn } from "@/lib/utils";
import {
  PlayIcon,
  SpinnerIcon,
  ChevronIcon,
  CopyIcon,
  XIcon,
} from "@/components/icons";

// ── Inline icons ──────────────────────────────────────────────────────────

function RetryIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ZapSmallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m ${remainSecs}s`;
}

function isValidJson(str: string): boolean {
  if (!str.trim()) return true;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

function parseJsonSafe(str: string): Record<string, unknown> {
  if (!str.trim()) return {};
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

// ── Status config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AsyncActionStatus, {
  label: string;
  badgeClass: string;
  dotClass: string;
}> = {
  pending: {
    label: "Pending",
    badgeClass: "bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]",
    dotClass: "bg-[var(--color-text-secondary)] animate-pulse",
  },
  running: {
    label: "Running",
    badgeClass: "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)]",
    dotClass: "bg-[var(--color-brand-500)] animate-pulse",
  },
  success: {
    label: "Success",
    badgeClass: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
    dotClass: "bg-[var(--color-success)]",
  },
  failed: {
    label: "Failed",
    badgeClass: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
    dotClass: "bg-[var(--color-error)]",
  },
  timed_out: {
    label: "Timed Out",
    badgeClass: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    dotClass: "bg-[var(--color-warning)]",
  },
};

// ── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AsyncActionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
        config.badgeClass
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dotClass)} />
      {config.label}
    </span>
  );
}

function SyncStatusBadge({ hasError }: { hasError: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
        hasError
          ? "bg-[var(--color-error)]/15 text-[var(--color-error)]"
          : "bg-[var(--color-success)]/15 text-[var(--color-success)]"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          hasError ? "bg-[var(--color-error)]" : "bg-[var(--color-success)]"
        )}
      />
      {hasError ? "Error" : "OK"}
    </span>
  );
}

// ── Compact JSON Viewer ──────────────────────────────────────────────────

function CompactJsonViewer({ data, label }: { data: unknown; label?: string }) {
  const text = JSON.stringify(data, null, 2);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            {label}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <CopyIcon />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <pre
        className="text-[10px] bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md p-2.5 overflow-auto text-[var(--color-text-secondary)] font-mono whitespace-pre-wrap break-all"
        style={{ maxHeight: "200px" }}
      >
        {text}
      </pre>
    </div>
  );
}

// ── Action Execution Row ─────────────────────────────────────────────────

function ActionRow({
  entry,
  onRetry,
}: {
  entry: ActionHistoryEntry;
  onRetry: (entry: ActionHistoryEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasError = entry.error !== null;
  const asyncStatus = entry.asyncStatus;
  const isRetryable = asyncStatus === "failed" || asyncStatus === "timed_out";

  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0">
      {/* Summary row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer text-left"
      >
        {/* Status */}
        <div className="shrink-0">
          {asyncStatus ? (
            <StatusBadge status={asyncStatus} />
          ) : (
            <SyncStatusBadge hasError={hasError} />
          )}
        </div>

        {/* Action name */}
        <span className="text-[11px] font-mono text-[var(--color-text-primary)] truncate flex-1 min-w-0">
          {entry.actionName}
        </span>

        {/* Duration */}
        <span className="text-[10px] text-[var(--color-text-secondary)] tabular-nums shrink-0">
          {formatDuration(entry.durationMs)}
        </span>

        <ChevronIcon direction={expanded ? "down" : "right"} />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2.5 space-y-2 bg-[var(--color-bg-base)]">
          {/* Timestamp */}
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-secondary)]">
            <ClockIcon />
            {formatTimestamp(entry.timestamp)}
          </div>

          {/* Input summary */}
          {entry.input && Object.keys(entry.input).length > 0 && (
            <CompactJsonViewer data={entry.input} label="Input" />
          )}

          {/* Error message */}
          {entry.error && (
            <div className="text-[11px] text-[var(--color-error)] bg-[var(--color-error)]/5 rounded-md p-2 font-mono break-words">
              {entry.error}
            </div>
          )}

          {/* Result payload */}
          {entry.result !== null && (
            <CompactJsonViewer data={entry.result} label="Result" />
          )}

          {/* Retry button for failed async actions */}
          {isRetryable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry(entry);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer"
            >
              <RetryIcon /> Retry
            </button>
          )}

          {/* No output placeholder */}
          {!entry.error && entry.result === null && (
            <p className="text-[10px] text-[var(--color-text-secondary)] italic">
              No output data
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Compact Action Runner ─────────────────────────────────────────────────

function CompactActionRunner({
  providerKey,
  connections,
}: {
  providerKey: string;
  connections: NangoConnectionSummary[];
}) {
  const [actionName, setActionName] = useState("");
  const [inputJson, setInputJson] = useState("{}");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  const {
    isExecutingAction,
    isPollingAsync,
    triggerActionAsync,
  } = useActionsStore();

  const jsonValid = isValidJson(inputJson);
  const isBusy = isExecutingAction || isPollingAsync;

  // Filter connections for this provider
  const providerConnections = useMemo(
    () => connections.filter((c) => c.provider_config_key === providerKey || c.provider === providerKey),
    [connections, providerKey]
  );

  const handleRun = useCallback(() => {
    if (!selectedConnectionId || !actionName.trim() || !jsonValid || isBusy) return;
    triggerActionAsync(providerKey, selectedConnectionId, actionName.trim(), parseJsonSafe(inputJson));
  }, [providerKey, selectedConnectionId, actionName, inputJson, jsonValid, isBusy, triggerActionAsync]);

  return (
    <div className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Trigger Action
      </h3>

      {/* Connection select */}
      {providerConnections.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-secondary)] italic">
          No connections for this integration. Connect first.
        </p>
      ) : (
        <select
          value={selectedConnectionId ?? ""}
          onChange={(e) => setSelectedConnectionId(e.target.value || null)}
          className="w-full px-2 py-1.5 text-[11px] bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors cursor-pointer"
        >
          <option value="">Select connection</option>
          {providerConnections.map((c) => (
            <option key={c.connection_id} value={c.connection_id}>
              {c.connection_id}
            </option>
          ))}
        </select>
      )}

      {/* Action name */}
      <input
        type="text"
        value={actionName}
        onChange={(e) => setActionName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleRun()}
        placeholder="Action name (e.g. create-contact)"
        className="w-full px-2 py-1.5 text-[11px] bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors font-mono"
      />

      {/* JSON input */}
      <textarea
        value={inputJson}
        onChange={(e) => setInputJson(e.target.value)}
        rows={4}
        spellCheck={false}
        className={cn(
          "w-full px-2 py-1.5 text-[11px] bg-[var(--color-bg-base)] border rounded-md text-[var(--color-text-primary)] focus:outline-none transition-colors font-mono resize-y",
          jsonValid
            ? "border-[var(--color-border)] focus:border-[var(--color-border-focus)]"
            : "border-[var(--color-error)]"
        )}
      />
      {!jsonValid && (
        <p className="text-[10px] text-[var(--color-error)]">Invalid JSON</p>
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={!selectedConnectionId || !actionName.trim() || !jsonValid || isBusy}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
      >
        {isBusy ? <SpinnerIcon /> : <PlayIcon />}
        Run Async
      </button>
    </div>
  );
}

// ── Live polling indicator ────────────────────────────────────────────────

function PollingIndicator({
  status,
  pollCount,
  onCancel,
}: {
  status: AsyncActionStatus;
  pollCount: number;
  onCancel: () => void;
}) {
  const maxPolls = Math.ceil((10 * 60) / 5);

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-[10px] text-[var(--color-text-secondary)] tabular-nums">
            Poll {pollCount}/{maxPolls}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
        >
          <XIcon /> Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main AsyncActionsTab ──────────────────────────────────────────────────

export function AsyncActionsTab({ providerKey }: { providerKey: string }) {
  const { connections, fetchConnections } = useConnectionsStore();
  const {
    getHistoryForIntegration,
    asyncStatus,
    asyncPollCount,
    isPollingAsync,
    cancelAsyncPolling,
    triggerActionAsync,
  } = useActionsStore();

  const entries = getHistoryForIntegration(providerKey);

  // Fetch connections on mount
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Subscribe to the history array to trigger re-renders on store updates
  useActionsStore((s) => s.history);

  const handleRetry = useCallback(
    (entry: ActionHistoryEntry) => {
      triggerActionAsync(
        entry.integrationId,
        entry.connectionId,
        entry.actionName,
        entry.input
      );
    },
    [triggerActionAsync]
  );

  return (
    <div className="space-y-5">
      {/* Action runner */}
      <CompactActionRunner
        providerKey={providerKey}
        connections={connections}
      />

      {/* Active polling indicator */}
      {isPollingAsync && asyncStatus && (
        <PollingIndicator
          status={asyncStatus}
          pollCount={asyncPollCount}
          onCancel={cancelAsyncPolling}
        />
      )}

      {/* Execution history */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
          Execution History
        </h3>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-overlay)] flex items-center justify-center text-[var(--color-text-secondary)]">
              <ZapSmallIcon />
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              No actions fired yet. Trigger an action above to see execution status.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden max-h-[400px] overflow-y-auto">
            {entries.map((entry) => (
              <ActionRow
                key={entry.id}
                entry={entry}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
