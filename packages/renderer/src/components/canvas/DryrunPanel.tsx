import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../../lib/utils";

type DryrunStatus = "idle" | "running" | "success" | "error";

interface LogLine {
  stream: "stdout" | "stderr";
  text: string;
  ts: number;
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

interface DryrunPanelProps {
  onClose: () => void;
}

export function DryrunPanel({ onClose }: DryrunPanelProps) {
  const [status, setStatus] = useState<DryrunStatus>("idle");
  const [lines, setLines] = useState<LogLine[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  // Register CLI output/exit listeners
  useEffect(() => {
    const handleOutput = (event: { runId: string; stream: "stdout" | "stderr"; line: string }) => {
      setLines((prev) => [...prev, { stream: event.stream, text: event.line, ts: Date.now() }]);
    };
    const handleExit = (event: { runId: string; code: number | null; signal: string | null }) => {
      const ok = event.code === 0;
      setStatus(ok ? "success" : "error");
      setLines((prev) => [
        ...prev,
        {
          stream: "stdout",
          text: ok
            ? `\nDryrun completed successfully (exit code ${event.code}).`
            : `\nDryrun failed (exit code ${event.code}${event.signal ? `, signal ${event.signal}` : ""}).`,
          ts: Date.now(),
        },
      ]);
      setRunId(null);
    };

    window.cli.onOutput(handleOutput);
    window.cli.onExit(handleExit);

    return () => {
      window.cli.removeAllOutputListeners();
      window.cli.removeAllExitListeners();
    };
  }, []);

  const startDryrun = useCallback(async () => {
    setStatus("running");
    setLines([{ stream: "stdout", text: "Starting nango dryrun...", ts: Date.now() }]);

    const result = await window.cli.run({
      command: "nango",
      args: ["dryrun"],
    });

    if (result.status === "ok") {
      setRunId(result.data.runId);
    } else {
      setStatus("error");
      setLines((prev) => [
        ...prev,
        { stream: "stderr", text: `Failed to start dryrun: ${result.error}`, ts: Date.now() },
      ]);
    }
  }, []);

  const stopDryrun = useCallback(async () => {
    if (runId) {
      await window.cli.abort({ runId });
      setRunId(null);
      setStatus("idle");
      setLines((prev) => [
        ...prev,
        { stream: "stdout", text: "\nDryrun aborted.", ts: Date.now() },
      ]);
    }
  }, [runId]);

  const clearLog = useCallback(() => {
    setLines([]);
    setStatus("idle");
  }, []);

  return (
    <div className="flex flex-col h-64 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--color-text)]">
            Dryrun
          </span>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-1">
          {status === "running" ? (
            <button
              onClick={stopDryrun}
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <StopIcon /> Stop
            </button>
          ) : (
            <button
              onClick={startDryrun}
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors cursor-pointer"
            >
              <PlayIcon /> Run
            </button>
          )}
          {lines.length > 0 && status !== "running" && (
            <button
              onClick={clearLog}
              className="px-2 py-1 text-[10px] rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close dryrun panel"
            className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-[var(--color-text-muted)] italic">
            Click Run to start a dryrun of the current integration.
          </p>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap break-all",
                line.stream === "stderr"
                  ? "text-red-400"
                  : "text-[var(--color-text-secondary)]",
              )}
            >
              {line.text}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DryrunStatus }) {
  if (status === "idle") return null;

  const styles = {
    running: "bg-blue-500/10 text-blue-400",
    success: "bg-green-500/10 text-green-400",
    error: "bg-red-500/10 text-red-400",
  };

  const labels = {
    running: "Running...",
    success: "Success",
    error: "Failed",
  };

  return (
    <span className={cn("px-1.5 py-0.5 text-[10px] rounded", styles[status])}>
      {labels[status]}
    </span>
  );
}
