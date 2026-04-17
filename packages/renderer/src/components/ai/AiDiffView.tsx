import { useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { cn } from "@/lib/utils";
import type { AiGenerationResult } from "@nango-gui/shared";

type DiffTab = "yaml" | "typescript";

interface AiDiffViewProps {
  /** The definition before the most recent refinement. */
  previous: AiGenerationResult;
  /** The newly refined definition. */
  current: AiGenerationResult;
  onClose: () => void;
}

/**
 * Side-by-side diff comparing the previous AI-generated definition against
 * the latest refinement. Shows YAML and TypeScript tabs.
 */
export function AiDiffView({ previous, current, onClose }: AiDiffViewProps) {
  const [activeTab, setActiveTab] = useState<DiffTab>("yaml");
  const [renderSideBySide, setRenderSideBySide] = useState(true);

  const original = activeTab === "yaml" ? previous.yaml : previous.typescript;
  const modified = activeTab === "yaml" ? current.yaml : current.typescript;
  const language = activeTab === "yaml" ? "yaml" : "typescript";

  return (
    <div className="flex flex-col h-full border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            Refinement diff
          </span>
          {/* Tabs */}
          <div className="flex items-center gap-0.5 ml-2">
            {(["yaml", "typescript"] as DiffTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-2 py-0.5 text-[10px] rounded transition-colors cursor-pointer",
                  activeTab === tab
                    ? "bg-[var(--color-bg)] text-[var(--color-text-primary)] font-medium"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {tab === "yaml" ? "YAML" : "TypeScript"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRenderSideBySide((v) => !v)}
            className="px-2 py-0.5 text-[10px] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer ml-1"
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
          original={original}
          modified={modified}
          language={language}
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
