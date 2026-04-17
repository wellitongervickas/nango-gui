import { useState } from "react";
import type { McpServerState, McpServerStatus } from "@nango-gui/shared";
import { cn } from "@/lib/utils";

// ── Icons ─────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("transition-transform", open && "rotate-180")}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<McpServerStatus, string> = {
  running:  "bg-[var(--color-sync)]/15 text-[var(--color-sync)]",
  starting: "bg-[var(--color-action)]/15 text-[var(--color-action)]",
  stopped:  "bg-[var(--color-border)] text-[var(--color-text-muted)]",
  error:    "bg-[var(--color-error)]/15 text-[var(--color-error)]",
};

const STATUS_DOT: Record<McpServerStatus, string> = {
  running:  "bg-[var(--color-sync)] animate-pulse",
  starting: "bg-[var(--color-action)] animate-pulse",
  stopped:  "bg-[var(--color-text-muted)]",
  error:    "bg-[var(--color-error)]",
};

function StatusBadge({ status }: { status: McpServerStatus }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize",
      STATUS_STYLES[status]
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[status])} />
      {status}
    </span>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface McpServerCardProps {
  server: McpServerState;
  selected: boolean;
  onSelect: () => void;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onRemove: () => Promise<void>;
}

export function McpServerCard({ server, selected, onSelect, onStart, onStop, onRemove }: McpServerCardProps) {
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);

  const { config, status, pid, tools, error } = server;
  const isRunning = status === "running";
  const isStarting = status === "starting";
  const canToggle = !toggling && status !== "starting";

  const cmdDisplay = [config.command, ...config.args].join(" ");

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canToggle) return;
    setToggling(true);
    setToggleError(null);
    try {
      if (isRunning) {
        await onStop();
      } else {
        await onStart();
      }
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "Failed");
    } finally {
      setToggling(false);
    }
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setRemoving(true);
    try {
      await onRemove();
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded-lg border transition-colors cursor-pointer",
        selected
          ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/5"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-focus)]"
      )}
    >
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-[var(--color-text)]">{config.name}</span>
            <StatusBadge status={status} />
            {pid != null && (
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                PID {pid}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-[var(--color-text-muted)] truncate" title={cmdDisplay}>
            {cmdDisplay}
          </p>
          {config.sourceFile && (
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1 truncate" title={config.sourceFile}>
              {config.sourceFile}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Start / Stop toggle */}
          <button
            onClick={handleToggle}
            disabled={!canToggle}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer",
              isRunning || isStarting
                ? "bg-[var(--color-error)]/10 text-[var(--color-error)] border border-[var(--color-error)]/30 hover:bg-[var(--color-error)]/20"
                : "bg-[var(--color-sync)]/10 text-[var(--color-sync)] border border-[var(--color-sync)]/30 hover:bg-[var(--color-sync)]/20",
              !canToggle && "opacity-50 cursor-not-allowed"
            )}
          >
            {toggling
              ? isRunning ? "Stopping…" : "Starting…"
              : isRunning || isStarting ? "Stop" : "Start"
            }
          </button>

          {/* Remove */}
          {confirmRemove ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--color-text-muted)]">Remove?</span>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="px-2 py-1 text-[10px] font-medium rounded text-[var(--color-error)] border border-[var(--color-error)]/40 hover:bg-[var(--color-error)]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                {removing ? "…" : "Yes"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmRemove(false); }}
                className="px-2 py-1 text-[10px] font-medium rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleRemove}
              title="Remove server"
              className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors cursor-pointer"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {(error || toggleError) && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
          <p className="text-xs text-[var(--color-error)]">{error || toggleError}</p>
        </div>
      )}

      {/* Tools section */}
      {tools.length > 0 && (
        <div className="border-t border-[var(--color-border)] px-4 py-2">
          <button
            onClick={(e) => { e.stopPropagation(); setToolsExpanded((v) => !v); }}
            className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer w-full"
          >
            <ChevronDownIcon open={toolsExpanded} />
            <span>{tools.length} tool{tools.length !== 1 ? "s" : ""}</span>
          </button>
          {toolsExpanded && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tools.map((tool) => (
                <span
                  key={tool}
                  className="px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[10px] font-mono text-[var(--color-text-muted)]"
                >
                  {tool}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Env vars summary (only when selected) */}
      {selected && config.env && Object.keys(config.env).length > 0 && (
        <div className="border-t border-[var(--color-border)] px-4 py-2">
          <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
            Env ({Object.keys(config.env).length})
          </p>
          <div className="space-y-1">
            {Object.entries(config.env).map(([key]) => (
              <span key={key} className="inline-block mr-2 px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[10px] font-mono text-[var(--color-text-muted)]">
                {key}=•••
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
