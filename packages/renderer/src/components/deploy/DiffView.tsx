import { useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { cn } from "../../lib/utils";

export interface DiffViewProps {
  /** Content on the left pane (e.g. live/deployed config). */
  original: string;
  /** Content on the right pane (e.g. generated config). */
  modified: string;
  /** Label for the left pane. Defaults to "Live (deployed)". */
  originalLabel?: string;
  /** Label for the right pane. Defaults to "Generated (local)". */
  modifiedLabel?: string;
  /** Language for syntax highlighting. Defaults to "yaml". */
  language?: string;
  /** Called when the user clicks the close button. */
  onClose: () => void;
  /** Called when the user clicks refresh. */
  onRefresh?: () => void;
  /** Whether the original content is currently loading. */
  loading?: boolean;
}

/**
 * Side-by-side diff editor comparing two text documents.
 * Designed for comparing generated nango.yaml against live configuration,
 * but generic enough for any text diff.
 */
export function DiffView({
  original,
  modified,
  originalLabel = "Live (deployed)",
  modifiedLabel = "Generated (local)",
  language = "yaml",
  onClose,
  onRefresh,
  loading = false,
}: DiffViewProps) {
  const [renderSideBySide, setRenderSideBySide] = useState(true);

  const displayOriginal = loading
    ? "# Loading..."
    : original;

  return (
    <div className="flex flex-col h-full border-l border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text)]">
            Diff View
          </span>
          <button
            onClick={() => setRenderSideBySide((v) => !v)}
            className="px-2 py-0.5 text-[10px] rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
          >
            {renderSideBySide ? "Inline" : "Side-by-side"}
          </button>
          {onRefresh && !loading && (
            <button
              onClick={onRefresh}
              className="px-2 py-0.5 text-[10px] rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
            >
              Refresh
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close diff view"
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-md transition-colors cursor-pointer",
            "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]",
          )}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Labels */}
      <div className="flex items-center border-b border-[var(--color-border)] shrink-0">
        <div className="flex-1 px-3 py-1 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          {originalLabel}
        </div>
        <div className="flex-1 px-3 py-1 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider border-l border-[var(--color-border)]">
          {modifiedLabel}
        </div>
      </div>

      {/* Diff editor */}
      <div className="flex-1 min-h-0">
        <DiffEditor
          original={displayOriginal}
          modified={modified}
          language={language}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide,
            minimap: { enabled: false },
            fontSize: 12,
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 8 },
            originalEditable: false,
          }}
        />
      </div>
    </div>
  );
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
