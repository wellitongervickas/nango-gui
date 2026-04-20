import { useCallback, useEffect, useMemo, useRef } from "react";
import type { NangoLogOperation, NangoLogMessage, NangoLogType, NangoLogStatus } from "@nango-gui/shared";
import { useLogsStore } from "../store/logsStore";
import { cn } from "../lib/utils";
import { RefreshIcon, XIcon, SearchIcon, SpinnerIcon, AlertTriangleIcon } from "@/components/icons";

// ── Constants ───────────────────────────────────────────────────────────────

const LOG_TYPES: { value: NangoLogType; label: string }[] = [
  { value: "webhook", label: "Webhook" },
  { value: "sync", label: "Sync" },
  { value: "action", label: "Action" },
  { value: "proxy", label: "Proxy" },
  { value: "auth", label: "Auth" },
  { value: "deploy", label: "Deploy" },
];

const STATUS_OPTIONS: { value: NangoLogStatus; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "timeout", label: "Timeout" },
  { value: "cancelled", label: "Cancelled" },
];

const PERIOD_OPTIONS = [
  { value: "1h", label: "Last 1 hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "x-api-key",
  "x-secret-key",
]);

function maskSensitiveHeader(name: string, value: string): string {
  if (SENSITIVE_HEADERS.has(name.toLowerCase())) {
    return value.length > 8 ? value.slice(0, 4) + "••••••••" : "••••••••";
  }
  return value;
}

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function periodToRange(period: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const ms: Record<string, number> = {
    "1h": 3600_000,
    "6h": 6 * 3600_000,
    "24h": 24 * 3600_000,
    "7d": 7 * 24 * 3600_000,
    "30d": 30 * 24 * 3600_000,
  };
  const from = new Date(now.getTime() - (ms[period] ?? 24 * 3600_000)).toISOString();
  return { from, to };
}

// ── Status badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  success: "bg-[var(--color-sync)]/15 text-[var(--color-sync)]",
  failed: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
  running: "bg-[var(--color-primary)]/15 text-[var(--color-primary)]",
  timeout: "bg-[var(--color-action)]/15 text-[var(--color-action)]",
  cancelled: "bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)]",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-[var(--color-border)] text-[var(--color-text-muted)]";
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0", cls)}>
      {status}
    </span>
  );
}

// ── Type badge ──────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, string> = {
  webhook: "bg-[var(--color-trigger)]/15 text-[var(--color-trigger)]",
  sync: "bg-[var(--color-sync)]/15 text-[var(--color-sync)]",
  action: "bg-[var(--color-action)]/15 text-[var(--color-action)]",
  proxy: "bg-[var(--color-primary)]/15 text-[var(--color-primary)]",
  auth: "bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)]",
  deploy: "bg-[var(--color-primary)]/15 text-[var(--color-primary)]",
};

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_STYLES[type] ?? "bg-[var(--color-border)] text-[var(--color-text-muted)]";
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide shrink-0", cls)}>
      {type}
    </span>
  );
}

// ── Retry info banner ───────────────────────────────────────────────────────

function RetryPolicyBanner({ operation }: { operation: NangoLogOperation }) {
  if (operation.type !== "webhook" || operation.status !== "failed") return null;
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-[var(--color-action)]/30 bg-[var(--color-action)]/5 text-xs">
      <AlertTriangleIcon />
      <div className="space-y-0.5">
        <p className="font-medium text-[var(--color-action)]">Retry Policy Active</p>
        <p className="text-[var(--color-text-muted)]">
          Nango retries failed webhook deliveries up to 7 times with exponential backoff starting at 100ms.
          Check the messages below for individual retry attempts.
        </p>
      </div>
    </div>
  );
}

// ── HTTP detail section ─────────────────────────────────────────────────────

function HttpMessageDetail({ message }: { message: NangoLogMessage }) {
  const hasRequest = !!message.request;
  const hasResponse = !!message.response;

  return (
    <div className="space-y-3 border border-[var(--color-border)] rounded-md p-3">
      <div className="flex items-center gap-2">
        <span className={cn(
          "px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase",
          message.request?.method === "POST"
            ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
            : "bg-[var(--color-sync)]/15 text-[var(--color-sync)]"
        )}>
          {message.request?.method ?? "HTTP"}
        </span>
        <span className="font-mono text-[var(--color-text)] text-xs truncate">{message.request?.url ?? ""}</span>
        {hasResponse && (
          <span className={cn(
            "ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0",
            (message.response!.code >= 200 && message.response!.code < 300)
              ? "bg-[var(--color-sync)]/15 text-[var(--color-sync)]"
              : "bg-[var(--color-error)]/15 text-[var(--color-error)]"
          )}>
            {message.response!.code}
          </span>
        )}
      </div>

      {/* Request headers */}
      {hasRequest && Object.keys(message.request!.headers).length > 0 && (
        <div className="space-y-1">
          <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Request Headers</p>
          <div className="rounded border border-[var(--color-border)] overflow-hidden max-h-36 overflow-y-auto">
            {Object.entries(message.request!.headers).map(([k, v]) => (
              <div key={k} className="flex px-2.5 py-1 border-b border-[var(--color-border)] last:border-0 gap-2 text-xs">
                <span className="font-mono text-[var(--color-text-muted)] shrink-0 w-36 truncate">{k}</span>
                <span className="font-mono text-[var(--color-text)] break-all">{maskSensitiveHeader(k, v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request body */}
      {hasRequest && message.request!.body && (
        <div className="space-y-1">
          <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Request Body</p>
          <pre className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-xs text-[var(--color-text)] whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {formatBody(message.request!.body)}
          </pre>
        </div>
      )}

      {/* Response headers */}
      {hasResponse && Object.keys(message.response!.headers).length > 0 && (
        <div className="space-y-1">
          <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Response Headers</p>
          <div className="rounded border border-[var(--color-border)] overflow-hidden max-h-36 overflow-y-auto">
            {Object.entries(message.response!.headers).map(([k, v]) => (
              <div key={k} className="flex px-2.5 py-1 border-b border-[var(--color-border)] last:border-0 gap-2 text-xs">
                <span className="font-mono text-[var(--color-text-muted)] shrink-0 w-36 truncate">{k}</span>
                <span className="font-mono text-[var(--color-text)] break-all">{maskSensitiveHeader(k, v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response body */}
      {hasResponse && message.response!.body && (
        <div className="space-y-1">
          <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Response Body</p>
          <pre className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-xs text-[var(--color-text)] whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {formatBody(message.response!.body)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Operation detail panel ──────────────────────────────────────────────────

function OperationDetail({ operation, onClose }: { operation: NangoLogOperation; onClose: () => void }) {
  const messages = useLogsStore((s) => s.messages);
  const messagesLoading = useLogsStore((s) => s.messagesLoading);
  const messagesError = useLogsStore((s) => s.messagesError);

  const httpMessages = useMemo(() => messages.filter((m) => m.type === "http"), [messages]);
  const logMessages = useMemo(() => messages.filter((m) => m.type === "log"), [messages]);

  return (
    <div className="flex flex-col h-full border-l border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] shrink-0">
        <TypeBadge type={operation.type} />
        <StatusBadge status={operation.status} />
        <span className="flex-1 text-sm text-[var(--color-text)] truncate">
          {operation.title || operation.message || operation.id.slice(0, 8)}
        </span>
        <button
          onClick={onClose}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          <XIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Meta info */}
        <div className="grid grid-cols-2 gap-3">
          {operation.providerName && (
            <div className="space-y-0.5">
              <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Provider</p>
              <p className="font-mono text-[var(--color-text)]">{operation.providerName}</p>
            </div>
          )}
          {operation.connectionName && (
            <div className="space-y-0.5">
              <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Connection</p>
              <p className="font-mono text-[var(--color-text)]">{operation.connectionName}</p>
            </div>
          )}
          {operation.syncName && (
            <div className="space-y-0.5">
              <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Sync</p>
              <p className="font-mono text-[var(--color-text)]">{operation.syncName}</p>
            </div>
          )}
          <div className="space-y-0.5">
            <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Started</p>
            <p className="font-mono text-[var(--color-text)]">
              {operation.startedAt ? new Date(operation.startedAt).toLocaleString() : "—"}
            </p>
          </div>
          {operation.endedAt && (
            <div className="space-y-0.5">
              <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Ended</p>
              <p className="font-mono text-[var(--color-text)]">{new Date(operation.endedAt).toLocaleString()}</p>
            </div>
          )}
          {operation.startedAt && operation.endedAt && (
            <div className="space-y-0.5">
              <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Duration</p>
              <p className="font-mono text-[var(--color-text)]">
                {formatDuration(new Date(operation.endedAt).getTime() - new Date(operation.startedAt).getTime())}
              </p>
            </div>
          )}
        </div>

        {/* Message */}
        {operation.message && (
          <div className="space-y-1">
            <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Message</p>
            <pre className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-[var(--color-text)] whitespace-pre-wrap break-all">
              {operation.message}
            </pre>
          </div>
        )}

        {/* Retry policy info for failed webhooks */}
        <RetryPolicyBanner operation={operation} />

        {/* Loading state */}
        {messagesLoading && (
          <div className="flex items-center gap-2 py-4 justify-center text-[var(--color-text-muted)]">
            <SpinnerIcon />
            <span>Loading messages…</span>
          </div>
        )}

        {/* Messages error */}
        {messagesError && (
          <div className="px-3 py-2.5 rounded-md border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 text-xs text-[var(--color-error)]">
            Failed to load messages: {messagesError}
          </div>
        )}

        {/* HTTP messages (request/response detail) */}
        {httpMessages.length > 0 && (
          <div className="space-y-2">
            <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">
              HTTP Requests ({httpMessages.length})
            </p>
            {httpMessages.map((msg) => (
              <HttpMessageDetail key={msg.id} message={msg} />
            ))}
          </div>
        )}

        {/* Log messages */}
        {logMessages.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">
              Log Messages ({logMessages.length})
            </p>
            <div className="rounded-md border border-[var(--color-border)] overflow-hidden">
              {logMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex items-start gap-2 px-3 py-1.5 border-b border-[var(--color-border)] last:border-0",
                    msg.level === "error" && "bg-[var(--color-error)]/5"
                  )}
                >
                  <span className={cn(
                    "shrink-0 text-[10px] font-mono font-semibold uppercase w-10",
                    msg.level === "error" ? "text-[var(--color-error)]"
                      : msg.level === "warn" ? "text-[var(--color-action)]"
                      : "text-[var(--color-text-muted)]"
                  )}>
                    {msg.level}
                  </span>
                  <span className="font-mono text-[var(--color-text)] break-all">{msg.message}</span>
                  <span className="ml-auto shrink-0 text-[var(--color-text-muted)] tabular-nums">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No messages */}
        {!messagesLoading && messages.length === 0 && (
          <p className="text-center text-[var(--color-text-muted)] py-4">No messages for this operation.</p>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

// ── Operation row ───────────────────────────────────────────────────────────

function OperationRow({
  operation,
  selected,
  onClick,
}: {
  operation: NangoLogOperation;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)] cursor-pointer transition-colors text-xs",
        selected
          ? "bg-[var(--color-primary)]/8 border-l-2 border-l-[var(--color-primary)]"
          : "hover:bg-[var(--color-surface)] border-l-2 border-l-transparent",
        operation.status === "failed" && !selected && "border-l-[var(--color-error)]/60"
      )}
    >
      <TypeBadge type={operation.type} />
      <StatusBadge status={operation.status} />
      <span className="font-mono text-[var(--color-text)] w-40 truncate shrink-0">
        {operation.providerName ?? operation.configName ?? "—"}
      </span>
      <span className="flex-1 text-[var(--color-text-muted)] truncate">
        {operation.title || operation.message || ""}
      </span>
      {operation.connectionName && (
        <span className="text-[var(--color-text-muted)] font-mono truncate max-w-28 shrink-0">
          {operation.connectionName}
        </span>
      )}
      <span className="text-[var(--color-text-muted)] tabular-nums shrink-0 w-20 text-right">
        {new Date(operation.createdAt).toLocaleTimeString()}
      </span>
    </div>
  );
}

// ── Filter bar ──────────────────────────────────────────────────────────────

function LogsFilterBar() {
  const filterType = useLogsStore((s) => s.filterType);
  const filterStatus = useLogsStore((s) => s.filterStatus);
  const filterPeriodFrom = useLogsStore((s) => s.filterPeriodFrom);
  const setFilterType = useLogsStore((s) => s.setFilterType);
  const setFilterStatus = useLogsStore((s) => s.setFilterStatus);
  const setFilterPeriod = useLogsStore((s) => s.setFilterPeriod);
  const fetchOperations = useLogsStore((s) => s.fetchOperations);

  const activePeriod = useMemo(() => {
    if (!filterPeriodFrom) return null;
    for (const opt of PERIOD_OPTIONS) {
      const { from } = periodToRange(opt.value);
      // Rough match — within 2 minutes of the expected from value
      if (Math.abs(new Date(from).getTime() - new Date(filterPeriodFrom).getTime()) < 120_000) {
        return opt.value;
      }
    }
    return "custom";
  }, [filterPeriodFrom]);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 flex-wrap">
      {/* Type pills */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setFilterType(null)}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer",
            filterType === null
              ? "bg-[var(--color-primary)] text-white"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
          )}
        >
          ALL
        </button>
        {LOG_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilterType(filterType === t.value ? null : t.value)}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer",
              filterType === t.value
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-[var(--color-border)]" />

      {/* Status select */}
      <select
        value={filterStatus ?? ""}
        onChange={(e) => setFilterStatus((e.target.value || null) as NangoLogStatus | null)}
        className="px-2 py-1 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Period select */}
      <select
        value={activePeriod ?? ""}
        onChange={(e) => {
          if (e.target.value) {
            const { from, to } = periodToRange(e.target.value);
            setFilterPeriod(from, to);
          } else {
            setFilterPeriod(null, null);
          }
        }}
        className="px-2 py-1 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer"
      >
        <option value="">All time</option>
        {PERIOD_OPTIONS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      <div className="flex-1" />

      {/* Refresh */}
      <button
        onClick={() => void fetchOperations(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/40 transition-colors cursor-pointer"
      >
        <RefreshIcon />
        Refresh
      </button>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const clearFilters = useLogsStore((s) => s.clearFilters);

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-3">
      <SearchIcon />
      <p className="text-sm text-[var(--color-text-muted)]">
        {hasFilters
          ? "No operations match your filters."
          : "No operation logs found."}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] max-w-sm">
        {hasFilters
          ? "Try adjusting your type, status, or time range filters."
          : "Logs appear here when your Nango integrations run syncs, actions, or receive webhook deliveries."}
      </p>
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="mt-1 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ── Main LogsPage ───────────────────────────────────────────────────────────

export function LogsPage() {
  const operations = useLogsStore((s) => s.operations);
  const isLoading = useLogsStore((s) => s.isLoading);
  const error = useLogsStore((s) => s.error);
  const cursor = useLogsStore((s) => s.cursor);
  const total = useLogsStore((s) => s.total);
  const selectedOperationId = useLogsStore((s) => s.selectedOperationId);
  const setSelectedOperationId = useLogsStore((s) => s.setSelectedOperationId);
  const fetchOperations = useLogsStore((s) => s.fetchOperations);
  const filterType = useLogsStore((s) => s.filterType);
  const filterStatus = useLogsStore((s) => s.filterStatus);
  const filterPeriodFrom = useLogsStore((s) => s.filterPeriodFrom);

  const hasFilters = !!(filterType || filterStatus || filterPeriodFrom);
  const selectedOp = useMemo(
    () => operations.find((o) => o.id === selectedOperationId) ?? null,
    [operations, selectedOperationId],
  );

  const listRef = useRef<HTMLDivElement>(null);

  // Initial fetch
  useEffect(() => {
    void fetchOperations(true);
  }, [fetchOperations]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!operations.length) return;
      const currentIdx = operations.findIndex((o) => o.id === selectedOperationId);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(currentIdx + 1, operations.length - 1);
        setSelectedOperationId(operations[next].id);
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(currentIdx - 1, 0);
        setSelectedOperationId(operations[prev].id);
      }
      if (e.key === "Escape") {
        setSelectedOperationId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [operations, selectedOperationId, setSelectedOperationId]);

  const handleLoadMore = useCallback(() => {
    if (cursor) void fetchOperations(false);
  }, [cursor, fetchOperations]);

  return (
    <div className="flex h-full">
      {/* Operation list */}
      <div className={cn("flex flex-col min-w-0", selectedOp ? "flex-1" : "w-full")}>
        <LogsFilterBar />

        {/* Count bar */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0">
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {total > 0 ? `${operations.length} of ${total} operations` : `${operations.length} operations`}
          </span>
          {isLoading && <SpinnerIcon />}
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 bg-[var(--color-error)]/10 border-b border-[var(--color-error)]/30 text-xs text-[var(--color-error)]">
            {error}
          </div>
        )}

        {/* List */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {operations.length === 0 && !isLoading ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            <>
              {operations.map((op) => (
                <OperationRow
                  key={op.id}
                  operation={op}
                  selected={op.id === selectedOperationId}
                  onClick={() => setSelectedOperationId(op.id === selectedOperationId ? null : op.id)}
                />
              ))}
              {cursor && (
                <div className="flex justify-center py-3">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="px-4 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/40 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isLoading ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedOp && (
        <div className="w-[440px] shrink-0">
          <OperationDetail
            operation={selectedOp}
            onClose={() => setSelectedOperationId(null)}
          />
        </div>
      )}
    </div>
  );
}
