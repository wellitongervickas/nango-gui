import { useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { cn } from "@/lib/utils";
import type { AiGenerationResult } from "@nango-gui/shared";

interface AiDiffViewProps {
  /** The definition before the most recent refinement. */
  previous: AiGenerationResult;
  /** The newly refined definition. */
  current: AiGenerationResult;
  onClose: () => void;
}

/**
 * Side-by-side diff comparing the previous AI-generated TypeScript handlers
 * against the latest refinement. nango.yaml is no longer surfaced here since
 * all config is now expressed in TypeScript (nango.config.ts).
 */
export function AiDiffView({ previous, current, onClose }: AiDiffViewProps) {
  const [renderSideBySide, setRenderSideBySide] = useState(true);

  return (
    <div className="flex flex-col h-full border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            Refinement diff
          </span>
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-[var(--color-bg)] text-[var(--color-text-secondary)] font-medium">
            TypeScript
          </span>
          <button
            onClick={() => setRenderSideBySide((v) => !v)}
            className={cn(
              "px-2 py-0.5 text-[10px] rounded transition-colors cursor-pointer ml-1",
              "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg)]",
            )}
          >
            {renderSideBySide ? "Inline" : "Side-by-side"}
          </button>
        </div>
        <button
          onClick={onClose}
          aria-label="Close diff view"
          className="flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Pane labels */}
      <div className="flex items-center border-b border-[var(--color-border)] shrink-0">
        <div className="flex-1 px-3 py-1 text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Previous
        </div>
        <div className="flex-1 px-3 py-1 text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider border-l border-[var(--color-border)]">
          Refined
        </div>
      </div>

      {/* Monaco diff editor */}
      <div className="flex-1 min-h-0">
        <DiffEditor
          original={previous.typescript}
          modified={current.typescript}
          language="typescript"
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide,
            minimap: { enabled: false },
            fontSize: 11,
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
