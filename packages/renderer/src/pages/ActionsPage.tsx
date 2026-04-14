import { useCallback, useEffect, useMemo, useState } from "react";
import type { NangoProxyMethod } from "@nango-gui/shared";
import { useConnectionsStore } from "@/store/connectionsStore";
import {
  useActionsStore,
  type HistoryEntry,
} from "@/store/actionsStore";
import { cn } from "@/lib/utils";

// ── Icons ──────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
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

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function statusBadgeColor(status: number): string {
  if (status >= 200 && status < 300) return "bg-[var(--color-success)]/15 text-[var(--color-success)]";
  if (status >= 400 && status < 500) return "bg-[var(--color-warning)]/15 text-[var(--color-warning)]";
  return "bg-[var(--color-error)]/15 text-[var(--color-error)]";
}

// ── Tab type ───────────────────────────────────────────────────────────────

type Tab = "actions" | "proxy";

// ── Connection Selector (shared between tabs) ──────────────────────────────

function ConnectionSelector({
  connections,
  connectionsLoading,
  value,
  onChange,
}: {
  connections: { provider_config_key: string; connection_id: string }[];
  connectionsLoading: boolean;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const options = useMemo(
    () =>
      connections.map((c) => ({
        label: `${c.provider_config_key} / ${c.connection_id}`,
        value: `${c.provider_config_key}::${c.connection_id}`,
      })),
    [connections]
  );

  return (
    <div className="w-72">
      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
        Connection
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors cursor-pointer"
      >
        <option value="">
          {connectionsLoading ? "Loading..." : "Select connection"}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── JSON Response Viewer ───────────────────────────────────────────────────

function JsonViewer({
  data,
  label,
  maxHeight = "50vh",
}: {
  data: unknown;
  label?: string;
  maxHeight?: string;
}) {
  const text = JSON.stringify(data, null, 2);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            {label}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <CopyIcon />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <pre
        className="text-xs bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg p-4 overflow-auto text-[var(--color-text-secondary)] font-mono whitespace-pre-wrap break-all"
        style={{ maxHeight }}
      >
        {text}
      </pre>
    </div>
  );
}

// ── Key-Value Editor ───────────────────────────────────────────────────────

function KeyValueEditor({
  label,
  entries,
  onChange,
}: {
  label: string;
  entries: [string, string][];
  onChange: (entries: [string, string][]) => void;
}) {
  const addRow = () => onChange([...entries, ["", ""]]);

  const updateRow = (idx: number, field: 0 | 1, value: string) => {
    const next = entries.map((e, i) =>
      i === idx ? ([field === 0 ? value : e[0], field === 1 ? value : e[1]] as [string, string]) : e
    );
    onChange(next);
  };

  const removeRow = (idx: number) => onChange(entries.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-[var(--color-text-secondary)]">{label}</label>
        <button
          onClick={addRow}
          className="flex items-center gap-1 text-xs text-[var(--color-brand-400)] hover:text-[var(--color-brand-500)] cursor-pointer"
        >
          <PlusIcon /> Add
        </button>
      </div>
      {entries.length === 0 && (
        <p className="text-xs text-[var(--color-text-secondary)] italic py-1">
          No entries
        </p>
      )}
      <div className="space-y-1">
        {entries.map(([key, val], idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <input
              value={key}
              onChange={(e) => updateRow(idx, 0, e.target.value)}
              placeholder="Key"
              className="flex-1 px-2 py-1 text-xs bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] font-mono"
            />
            <input
              value={val}
              onChange={(e) => updateRow(idx, 1, e.target.value)}
              placeholder="Value"
              className="flex-1 px-2 py-1 text-xs bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] font-mono"
            />
            <button
              onClick={() => removeRow(idx)}
              className="flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors cursor-pointer"
              aria-label="Remove"
            >
              <XIcon />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Actions Runner Tab ─────────────────────────────────────────────────────

function ActionsRunnerTab({
  selectedConnection,
}: {
  selectedConnection: string | null;
}) {
  const [actionName, setActionName] = useState("");
  const [inputJson, setInputJson] = useState("{}");

  const {
    actionResult,
    isExecutingAction,
    actionError,
    triggerAction,
    clearActionResult,
  } = useActionsStore();

  const jsonValid = isValidJson(inputJson);

  const handleRun = useCallback(() => {
    if (!selectedConnection || !actionName.trim() || !jsonValid) return;
    const [integrationId, connectionId] = selectedConnection.split("::");
    if (!integrationId || !connectionId) return;
    triggerAction(integrationId, connectionId, actionName.trim(), parseJsonSafe(inputJson));
  }, [selectedConnection, actionName, inputJson, jsonValid, triggerAction]);

  return (
    <div className="flex flex-col gap-5">
      {/* Action Name */}
      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
          Action Name
        </label>
        <input
          type="text"
          value={actionName}
          onChange={(e) => setActionName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRun()}
          placeholder="e.g. create-contact"
          className="w-full px-3 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors font-mono"
        />
      </div>

      {/* JSON Input */}
      <div>
        <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
          Input (JSON)
        </label>
        <textarea
          value={inputJson}
          onChange={(e) => setInputJson(e.target.value)}
          rows={8}
          spellCheck={false}
          className={cn(
            "w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none transition-colors font-mono resize-y",
            jsonValid
              ? "border-[var(--color-border)] focus:border-[var(--color-border-focus)]"
              : "border-[var(--color-error)]"
          )}
        />
        {!jsonValid && (
          <p className="text-xs text-[var(--color-error)] mt-1">
            Invalid JSON
          </p>
        )}
      </div>

      {/* Run Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleRun}
          disabled={!selectedConnection || !actionName.trim() || !jsonValid || isExecutingAction}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {isExecutingAction ? <SpinnerIcon /> : <PlayIcon />}
          Run Action
        </button>
        {(actionResult !== null || actionError) && (
          <button
            onClick={clearActionResult}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
          >
            Clear result
          </button>
        )}
      </div>

      {/* Error */}
      {actionError && (
        <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          {actionError}
        </div>
      )}

      {/* Result */}
      {actionResult !== null && !actionError && (
        <JsonViewer data={actionResult} label="Result" />
      )}
    </div>
  );
}

// ── Proxy Tester Tab ───────────────────────────────────────────────────────

const HTTP_METHODS: NangoProxyMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function ProxyTesterTab({
  selectedConnection,
}: {
  selectedConnection: string | null;
}) {
  const [method, setMethod] = useState<NangoProxyMethod>("GET");
  const [endpoint, setEndpoint] = useState("");
  const [headerEntries, setHeaderEntries] = useState<[string, string][]>([]);
  const [paramEntries, setParamEntries] = useState<[string, string][]>([]);
  const [bodyJson, setBodyJson] = useState("");
  const [headersExpanded, setHeadersExpanded] = useState(false);

  const {
    proxyStatus,
    proxyHeaders,
    proxyData,
    isExecutingProxy,
    proxyError,
    sendProxyRequest,
    clearProxyResult,
  } = useActionsStore();

  const bodyJsonValid = isValidJson(bodyJson);
  const showBody = method !== "GET" && method !== "DELETE";

  const handleSend = useCallback(() => {
    if (!selectedConnection || !endpoint.trim()) return;
    const [integrationId, connectionId] = selectedConnection.split("::");
    if (!integrationId || !connectionId) return;

    const headers: Record<string, string> = {};
    for (const [k, v] of headerEntries) {
      if (k.trim()) headers[k.trim()] = v;
    }

    const params: Record<string, string> = {};
    for (const [k, v] of paramEntries) {
      if (k.trim()) params[k.trim()] = v;
    }

    sendProxyRequest(integrationId, connectionId, method, endpoint.trim(), {
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      data: showBody && bodyJson.trim() ? parseJsonSafe(bodyJson) : undefined,
      params: Object.keys(params).length > 0 ? params : undefined,
    });
  }, [selectedConnection, method, endpoint, headerEntries, paramEntries, bodyJson, showBody, sendProxyRequest]);

  return (
    <div className="flex flex-col gap-5">
      {/* Method + Endpoint */}
      <div className="flex items-end gap-2">
        <div className="w-32">
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
            Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as NangoProxyMethod)}
            className="w-full px-3 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors cursor-pointer font-mono font-semibold"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
            Endpoint Path
          </label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="/api/v1/users"
            className="w-full px-3 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors font-mono"
          />
        </div>
      </div>

      {/* Headers */}
      <KeyValueEditor
        label="Headers"
        entries={headerEntries}
        onChange={setHeaderEntries}
      />

      {/* Query Params */}
      <KeyValueEditor
        label="Query Parameters"
        entries={paramEntries}
        onChange={setParamEntries}
      />

      {/* Request Body (only for POST/PUT/PATCH) */}
      {showBody && (
        <div>
          <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
            Request Body (JSON)
          </label>
          <textarea
            value={bodyJson}
            onChange={(e) => setBodyJson(e.target.value)}
            rows={6}
            spellCheck={false}
            className={cn(
              "w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none transition-colors font-mono resize-y",
              bodyJsonValid
                ? "border-[var(--color-border)] focus:border-[var(--color-border-focus)]"
                : "border-[var(--color-error)]"
            )}
          />
          {!bodyJsonValid && (
            <p className="text-xs text-[var(--color-error)] mt-1">
              Invalid JSON
            </p>
          )}
        </div>
      )}

      {/* Send Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSend}
          disabled={
            !selectedConnection ||
            !endpoint.trim() ||
            (showBody && !bodyJsonValid) ||
            isExecutingProxy
          }
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {isExecutingProxy ? <SpinnerIcon /> : <SendIcon />}
          Send
        </button>
        {(proxyStatus !== null || proxyError) && (
          <button
            onClick={clearProxyResult}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
          >
            Clear result
          </button>
        )}
      </div>

      {/* Error */}
      {proxyError && (
        <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
          {proxyError}
        </div>
      )}

      {/* Response */}
      {proxyStatus !== null && !proxyError && (
        <div className="space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center text-sm px-2 py-0.5 rounded-md font-mono font-semibold",
                statusBadgeColor(proxyStatus)
              )}
            >
              {proxyStatus}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {method} {endpoint}
            </span>
          </div>

          {/* Response headers (collapsible) */}
          {proxyHeaders && Object.keys(proxyHeaders).length > 0 && (
            <div>
              <button
                onClick={() => setHeadersExpanded((p) => !p)}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text-primary)]"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{
                    transform: headersExpanded ? "rotate(90deg)" : undefined,
                    transition: "transform 150ms",
                  }}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
                Response Headers ({Object.keys(proxyHeaders).length})
              </button>
              {headersExpanded && (
                <div className="mt-2 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg p-3 space-y-0.5">
                  {Object.entries(proxyHeaders).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs font-mono">
                      <span className="text-[var(--color-brand-400)] shrink-0">
                        {k}:
                      </span>
                      <span className="text-[var(--color-text-secondary)] break-all">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Response body */}
          {proxyData !== null && proxyData !== undefined && (
            <JsonViewer data={proxyData} label="Response Body" />
          )}
        </div>
      )}
    </div>
  );
}

// ── History Sidebar ────────────────────────────────────────────────────────

function HistorySidebar() {
  const { history, clearHistory } = useActionsStore();

  if (history.length === 0) return null;

  return (
    <div className="w-72 border-l border-[var(--color-border)] bg-[var(--color-bg-surface)] flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          History ({history.length})
        </span>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-error)] cursor-pointer"
        >
          <TrashIcon /> Clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {history.map((entry) => (
          <HistoryItem key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const isError = entry.error !== null;

  if (entry.type === "action") {
    return (
      <div className="px-4 py-2.5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-overlay)] transition-colors">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              isError ? "bg-[var(--color-error)]" : "bg-[var(--color-success)]"
            )}
          />
          <span className="text-xs font-mono text-[var(--color-text-primary)] truncate">
            {entry.actionName}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 ml-3.5">
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {formatTimestamp(entry.timestamp)}
          </span>
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {entry.durationMs}ms
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-2.5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-overlay)] transition-colors">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            isError ? "bg-[var(--color-error)]" : "bg-[var(--color-success)]"
          )}
        />
        <span className="text-[10px] font-mono font-semibold text-[var(--color-brand-400)]">
          {entry.method}
        </span>
        <span className="text-xs font-mono text-[var(--color-text-primary)] truncate">
          {entry.endpoint}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1 ml-3.5">
        {entry.responseStatus !== null && (
          <span
            className={cn(
              "text-[10px] font-mono font-semibold px-1 rounded",
              statusBadgeColor(entry.responseStatus)
            )}
          >
            {entry.responseStatus}
          </span>
        )}
        <span className="text-[10px] text-[var(--color-text-secondary)]">
          {formatTimestamp(entry.timestamp)}
        </span>
        <span className="text-[10px] text-[var(--color-text-secondary)]">
          {entry.durationMs}ms
        </span>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function ActionsPage() {
  const {
    connections,
    isLoading: connectionsLoading,
    fetchConnections,
  } = useConnectionsStore();

  const [activeTab, setActiveTab] = useState<Tab>("actions");
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const hasConnection = selectedConnection !== null;

  return (
    <div className="flex h-full bg-[var(--color-bg-base)]">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0 space-y-3">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Actions & Proxy
            </h1>
          </div>

          {/* Connection selector */}
          <ConnectionSelector
            connections={connections}
            connectionsLoading={connectionsLoading}
            value={selectedConnection}
            onChange={setSelectedConnection}
          />

          {/* Tabs */}
          <div className="flex gap-0.5 border-b border-[var(--color-border)] -mb-3 -mx-6 px-6">
            <button
              onClick={() => setActiveTab("actions")}
              className={cn(
                "px-4 py-2 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px",
                activeTab === "actions"
                  ? "border-[var(--color-brand-500)] text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              Actions Runner
            </button>
            <button
              onClick={() => setActiveTab("proxy")}
              className={cn(
                "px-4 py-2 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px",
                activeTab === "proxy"
                  ? "border-[var(--color-brand-500)] text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              Proxy Tester
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!hasConnection ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 py-20">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                <ZapIcon />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Select a connection to get started
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {activeTab === "actions"
                    ? "Trigger Nango actions with custom JSON input and inspect results."
                    : "Send authenticated HTTP requests through the Nango proxy."}
                </p>
              </div>
            </div>
          ) : activeTab === "actions" ? (
            <ActionsRunnerTab selectedConnection={selectedConnection} />
          ) : (
            <ProxyTesterTab selectedConnection={selectedConnection} />
          )}
        </div>
      </div>

      {/* History sidebar */}
      <HistorySidebar />
    </div>
  );
}
