import { useCallback, useEffect, useRef, useState } from "react";
import type { WebhookEvent } from "@nango-gui/shared";
import { useWebhookStore, selectFilteredEvents } from "../store/webhookStore";
import { cn } from "../lib/utils";
import { WebhookIcon, CopyIcon, XIcon, TrashIcon } from "@/components/icons";

// ── Method badge ─────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-[var(--color-sync)]/15 text-[var(--color-sync)]",
  POST:   "bg-[var(--color-primary)]/15 text-[var(--color-primary)]",
  PUT:    "bg-[var(--color-trigger)]/15 text-[var(--color-trigger)]",
  PATCH:  "bg-[var(--color-action)]/15 text-[var(--color-action)]",
  DELETE: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
};

function MethodBadge({ method }: { method: string }) {
  const cls = METHOD_COLORS[method] ?? "bg-[var(--color-border)] text-[var(--color-text-muted)]";
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide shrink-0", cls)}>
      {method}
    </span>
  );
}

// ── Server controls ──────────────────────────────────────────────────────────

function ServerControls() {
  const status = useWebhookStore((s) => s.status);
  const isStarting = useWebhookStore((s) => s.isStarting);
  const isStopping = useWebhookStore((s) => s.isStopping);
  const error = useWebhookStore((s) => s.error);
  const startServer = useWebhookStore((s) => s.startServer);
  const stopServer = useWebhookStore((s) => s.stopServer);

  const [port, setPort] = useState("3456");
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!status.url) return;
    void navigator.clipboard.writeText(status.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Port input — only editable when stopped */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-[var(--color-text-muted)]">Port</label>
        <input
          type="number"
          min={1024}
          max={65535}
          value={port}
          disabled={status.running}
          onChange={(e) => setPort(e.target.value)}
          className="w-20 px-2 py-1 text-xs font-mono bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] disabled:opacity-50 focus:outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      {/* Start / Stop */}
      {!status.running ? (
        <button
          onClick={() => void startServer(parseInt(port, 10) || 3456)}
          disabled={isStarting}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
        >
          {isStarting ? "Starting…" : "Start listener"}
        </button>
      ) : (
        <button
          onClick={() => void stopServer()}
          disabled={isStopping}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--color-error)]/10 text-[var(--color-error)] border border-[var(--color-error)]/30 hover:bg-[var(--color-error)]/20 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isStopping ? "Stopping…" : "Stop listener"}
        </button>
      )}

      {/* URL display */}
      {status.running && status.url && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-sync)] shrink-0 animate-pulse" />
          <span className="text-xs font-mono text-[var(--color-text)]">{status.url}</span>
          <button
            onClick={handleCopy}
            title="Copy URL"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
          >
            {copied ? (
              <span className="text-[10px] text-[var(--color-sync)]">Copied</span>
            ) : (
              <CopyIcon />
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <span className="text-xs text-[var(--color-error)]">{error}</span>
      )}
    </div>
  );
}

// ── Event detail panel ────────────────────────────────────────────────────────

function EventDetail({ event, onClose }: { event: WebhookEvent; onClose: () => void }) {
  const bodyText = event.body == null
    ? "(empty)"
    : typeof event.body === "string"
      ? event.body
      : JSON.stringify(event.body, null, 2);

  const hasQuery = Object.keys(event.query).length > 0;
  const hasHeaders = Object.keys(event.headers).length > 0;

  return (
    <div className="flex flex-col h-full border-l border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Detail header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] shrink-0">
        <MethodBadge method={event.method} />
        <span className="flex-1 text-sm font-mono text-[var(--color-text)] truncate">{event.path}</span>
        <button
          onClick={onClose}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          <XIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Meta */}
        <div className="space-y-1">
          <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Received</p>
          <p className="font-mono text-[var(--color-text)]">{new Date(event.timestamp).toLocaleString()}</p>
        </div>

        {/* Query params */}
        {hasQuery && (
          <div className="space-y-1.5">
            <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Query Params</p>
            <div className="rounded-md border border-[var(--color-border)] overflow-hidden">
              {Object.entries(event.query).map(([k, v]) => (
                <div key={k} className="flex px-3 py-1.5 border-b border-[var(--color-border)] last:border-0 gap-3">
                  <span className="font-mono text-[var(--color-text-muted)] shrink-0">{k}</span>
                  <span className="font-mono text-[var(--color-text)] break-all">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Headers */}
        {hasHeaders && (
          <div className="space-y-1.5">
            <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Headers</p>
            <div className="rounded-md border border-[var(--color-border)] overflow-hidden max-h-48 overflow-y-auto">
              {Object.entries(event.headers).map(([k, v]) => (
                <div key={k} className="flex px-3 py-1.5 border-b border-[var(--color-border)] last:border-0 gap-3">
                  <span className="font-mono text-[var(--color-text-muted)] shrink-0 w-40 truncate">{k}</span>
                  <span className="font-mono text-[var(--color-text)] break-all">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="space-y-1.5">
          <p className="text-[var(--color-text-muted)] font-medium uppercase tracking-wide text-[10px]">Body</p>
          <pre className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 font-mono text-[var(--color-text)] whitespace-pre-wrap break-all max-h-80 overflow-y-auto">
            {bodyText}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Event row ────────────────────────────────────────────────────────────────

function EventRow({
  event,
  selected,
  onClick,
}: {
  event: WebhookEvent;
  selected: boolean;
  onClick: () => void;
}) {
  const bodyPreview = event.body == null
    ? "—"
    : typeof event.body === "string"
      ? event.body.slice(0, 60)
      : JSON.stringify(event.body).slice(0, 60);

  const queryCount = Object.keys(event.query).length;

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)] cursor-pointer transition-colors text-xs",
        selected
          ? "bg-[var(--color-primary)]/8 border-l-2 border-l-[var(--color-primary)]"
          : "hover:bg-[var(--color-surface)] border-l-2 border-l-transparent"
      )}
    >
      <MethodBadge method={event.method} />
      <span className="font-mono text-[var(--color-text)] w-48 truncate shrink-0">
        {event.path}
        {queryCount > 0 && (
          <span className="text-[var(--color-text-muted)]">?…({queryCount})</span>
        )}
      </span>
      <span className="flex-1 font-mono text-[var(--color-text-muted)] truncate">
        {bodyPreview}
      </span>
      <span className="text-[var(--color-text-muted)] tabular-nums shrink-0 w-24 text-right">
        {new Date(event.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function FilterBar() {
  const filterText = useWebhookStore((s) => s.filterText);
  const filterMethod = useWebhookStore((s) => s.filterMethod);
  const events = useWebhookStore((s) => s.events);
  const setFilterText = useWebhookStore((s) => s.setFilterText);
  const setFilterMethod = useWebhookStore((s) => s.setFilterMethod);
  const clearEvents = useWebhookStore((s) => s.clearEvents);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
      {/* Method pills */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setFilterMethod(null)}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer",
            filterMethod === null
              ? "bg-[var(--color-primary)] text-white"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
          )}
        >
          ALL
        </button>
        {METHODS.map((m) => (
          <button
            key={m}
            onClick={() => setFilterMethod(filterMethod === m ? null : m)}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer",
              filterMethod === m
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-[var(--color-border)]" />

      {/* Text search */}
      <input
        type="text"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        placeholder="Filter by path…"
        className="w-52 px-3 py-1 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
      />

      <div className="flex-1" />

      {/* Clear */}
      {events.length > 0 && (
        <button
          onClick={() => void clearEvents()}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:border-[var(--color-error)]/40 transition-colors cursor-pointer"
        >
          <TrashIcon />
          Clear
        </button>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function WebhooksPage() {
  const events = useWebhookStore(selectFilteredEvents);
  const allEvents = useWebhookStore((s) => s.events);
  const selectedEventId = useWebhookStore((s) => s.selectedEventId);
  const setSelectedEventId = useWebhookStore((s) => s.setSelectedEventId);
  const appendEvent = useWebhookStore((s) => s.appendEvent);
  const fetchStatus = useWebhookStore((s) => s.fetchStatus);
  const fetchEvents = useWebhookStore((s) => s.fetchEvents);
  const status = useWebhookStore((s) => s.status);

  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Fetch initial status and events on mount
  useEffect(() => {
    void fetchStatus();
    void fetchEvents();
  }, [fetchStatus, fetchEvents]);

  // Subscribe to push events from main process
  useEffect(() => {
    if (!window.webhook) return;
    window.webhook.onEvent((event) => {
      appendEvent(event);
    });
    return () => {
      window.webhook.removeAllEventListeners();
    };
  }, [appendEvent]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [allEvents.length, autoScroll]);

  // Keyboard shortcuts: J/K navigate, C copy body, Esc close detail
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        setSelectedEventId(null);
        return;
      }

      if (e.key === "j" || e.key === "k") {
        if (events.length === 0) return;
        const currentIdx = selectedEventId
          ? events.findIndex((ev) => ev.id === selectedEventId)
          : -1;
        const nextIdx = e.key === "j"
          ? Math.min(currentIdx + 1, events.length - 1)
          : Math.max(currentIdx - 1, 0);
        setSelectedEventId(events[nextIdx].id);
        return;
      }

      if (e.key === "c" && !e.ctrlKey && !e.metaKey) {
        const sel = allEvents.find((ev) => ev.id === selectedEventId);
        if (!sel) return;
        const bodyText = sel.body == null
          ? ""
          : typeof sel.body === "string"
            ? sel.body
            : JSON.stringify(sel.body, null, 2);
        void navigator.clipboard.writeText(bodyText);
      }
    },
    [events, allEvents, selectedEventId, setSelectedEventId]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setAutoScroll(atBottom);
  }

  const selectedEvent = allEvents.find((e) => e.id === selectedEventId) ?? null;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-sm font-semibold text-[var(--color-text)]">Webhook Listener</h1>
          {status.running && (
            <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
              {allEvents.length} event{allEvents.length !== 1 ? "s" : ""} received
            </span>
          )}
        </div>
        <ServerControls />
      </div>

      {/* Body — filter + event log + optional detail */}
      <div className="flex flex-1 min-h-0">
        {/* Left: event list */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <FilterBar />

          {/* Column headers */}
          {allEvents.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide shrink-0">
              <span className="w-16 shrink-0">Method</span>
              <span className="w-48 shrink-0">Path</span>
              <span className="flex-1">Body preview</span>
              <span className="w-24 text-right">Time</span>
            </div>
          )}

          <div
            ref={listRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto"
          >
            {/* Empty states */}
            {!status.running && allEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)]">
                  <WebhookIcon />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--color-text)] mb-1">No listener running</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Start the listener above, then send HTTP requests to the displayed URL.
                  </p>
                </div>
              </div>
            )}

            {status.running && allEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] animate-pulse">
                  <WebhookIcon />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--color-text)] mb-1">Waiting for requests</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Send a request to{" "}
                    <span className="font-mono">{status.url}</span>
                  </p>
                </div>
              </div>
            )}

            {events.length === 0 && allEvents.length > 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-sm text-[var(--color-text-muted)]">No events match the current filter</p>
              </div>
            )}

            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                selected={event.id === selectedEventId}
                onClick={() =>
                  setSelectedEventId(event.id === selectedEventId ? null : event.id)
                }
              />
            ))}
          </div>
        </div>

        {/* Right: detail panel */}
        {selectedEvent && (
          <div className="w-[420px] shrink-0">
            <EventDetail
              event={selectedEvent}
              onClose={() => setSelectedEventId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
