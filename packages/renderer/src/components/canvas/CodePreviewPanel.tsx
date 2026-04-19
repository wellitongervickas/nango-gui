import { useState, useMemo, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { useFlowStore } from "../../store/flowStore";
import { useProjectStore } from "../../store/projectStore";
import {
  graphToTypeScript,
  type GeneratedFile,
} from "../../codegen/typescript-generator";
import { cn } from "../../lib/utils";

const MIGRATION_DISMISSED_KEY = "nango-yaml-migration-dismissed";

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

function WarningIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/** One-time dismissable banner informing users of the nango.yaml → TypeScript migration. */
function MigrationNotice() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(MIGRATION_DISMISSED_KEY) === "true",
  );

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
      <span className="text-amber-400 mt-px shrink-0">
        <WarningIcon />
      </span>
      <p className="flex-1 text-[11px] leading-relaxed">
        <span className="text-amber-400 font-medium">Migration notice: </span>
        <span className="text-[var(--color-text-muted)]">
          <code className="font-mono">nango.yaml</code> was removed on Dec 1, 2025.
          Configs are now TypeScript files (<code className="font-mono">nango.config.ts</code>)
          colocated with your integration scripts.
        </span>
      </p>
      <button
        onClick={() => {
          localStorage.setItem(MIGRATION_DISMISSED_KEY, "true");
          setDismissed(true);
        }}
        aria-label="Dismiss migration notice"
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer shrink-0"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

interface CodePreviewPanelProps {
  onClose: () => void;
}

export function CodePreviewPanel({ onClose }: CodePreviewPanelProps) {
  const [selectedFile, setSelectedFile] = useState(0);

  const project = useProjectStore((s) => s.project);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);

  const tsFiles = useMemo(
    () => graphToTypeScript(project, nodes, edges),
    [project, nodes, edges],
  );

  const currentTsFile: GeneratedFile | undefined = tsFiles[selectedFile];
  const displayCode = currentTsFile?.content ?? "// No generated files";

  const [exporting, setExporting] = useState(false);

  const exportFiles = useCallback(async () => {
    if (!window.project) return;
    const res = await window.project.showDirectoryDialog();
    if (res.status !== "ok" || !res.data.filePath) return;
    const dir = res.data.filePath;

    setExporting(true);
    try {
      for (const file of tsFiles) {
        await window.project.writeFile({
          filePath: `${dir}/${file.path}`,
          data: file.content,
        });
      }
    } finally {
      setExporting(false);
    }
  }, [tsFiles]);

  return (
    <div className="flex flex-col h-full border-l border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Migration notice */}
      <MigrationNotice />

      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--color-border)] shrink-0">
        <span className="text-xs font-medium text-[var(--color-text)]">
          TypeScript
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={exportFiles}
            disabled={exporting}
            className="px-2 py-0.5 text-[10px] rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export"}
          </button>
          <button
            onClick={onClose}
            aria-label="Close code preview"
            className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* File selector */}
      {tsFiles.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--color-border)] overflow-x-auto shrink-0">
          {tsFiles.map((file, i) => (
            <button
              key={file.path}
              onClick={() => setSelectedFile(i)}
              className={cn(
                "px-2 py-0.5 text-[10px] rounded whitespace-nowrap transition-colors cursor-pointer",
                i === selectedFile
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]",
              )}
            >
              {file.path}
            </button>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          language="typescript"
          value={displayCode}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}
