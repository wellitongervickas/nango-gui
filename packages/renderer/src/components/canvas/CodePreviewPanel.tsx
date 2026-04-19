import { useState, useMemo, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { useFlowStore } from "../../store/flowStore";
import { useProjectStore } from "../../store/projectStore";
import {
  graphToTypeScript,
  type GeneratedFile,
} from "../../codegen/typescript-generator";
import { cn } from "../../lib/utils";

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
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--color-border)] shrink-0">
        <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
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

      {/* TypeScript file selector */}
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
