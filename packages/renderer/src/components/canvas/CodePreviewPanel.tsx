import { useState, useMemo, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { useFlowStore } from "../../store/flowStore";
import { useProjectStore } from "../../store/projectStore";
import { graphToYaml } from "../../codegen/yaml-serializer";
import {
  graphToTypeScript,
  type GeneratedFile,
} from "../../codegen/typescript-generator";
import { cn } from "../../lib/utils";

type Tab = "yaml" | "typescript";

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
  const [activeTab, setActiveTab] = useState<Tab>("yaml");
  const [selectedFile, setSelectedFile] = useState(0);

  const project = useProjectStore((s) => s.project);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);

  // Regenerate code whenever graph or project changes
  const yamlCode = useMemo(
    () => graphToYaml(project, nodes, edges),
    [project, nodes, edges],
  );

  const tsFiles = useMemo(
    () => graphToTypeScript(project, nodes, edges),
    [project, nodes, edges],
  );

  const currentTsFile: GeneratedFile | undefined = tsFiles[selectedFile];

  const displayCode =
    activeTab === "yaml"
      ? yamlCode
      : (currentTsFile?.content ?? "// No generated files");

  const language = activeTab === "yaml" ? "yaml" : "typescript";

  const [exporting, setExporting] = useState(false);

  const exportFiles = useCallback(async () => {
    const res = await window.project.showDirectoryDialog();
    if (res.status !== "ok" || !res.data.filePath) return;
    const dir = res.data.filePath;

    setExporting(true);
    try {
      // Write nango.yaml
      await window.project.writeFile({
        filePath: `${dir}/nango.yaml`,
        data: yamlCode,
      });

      // Write TypeScript files
      for (const file of tsFiles) {
        await window.project.writeFile({
          filePath: `${dir}/${file.path}`,
          data: file.content,
        });
      }
    } finally {
      setExporting(false);
    }
  }, [yamlCode, tsFiles]);

  return (
    <div className="flex flex-col h-full border-l border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-1">
          <TabButton
            label="YAML"
            active={activeTab === "yaml"}
            onClick={() => setActiveTab("yaml")}
          />
          <TabButton
            label="TypeScript"
            active={activeTab === "typescript"}
            onClick={() => setActiveTab("typescript")}
          />
        </div>
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
      {activeTab === "typescript" && tsFiles.length > 1 && (
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
          language={language}
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

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer",
        active
          ? "bg-[var(--color-bg)] text-[var(--color-text)] font-medium"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
      )}
    >
      {label}
    </button>
  );
}
