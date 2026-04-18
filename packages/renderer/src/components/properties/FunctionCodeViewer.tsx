import { useState, useMemo, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { useFlowStore } from "../../store/flowStore";
import { useProjectStore } from "../../store/projectStore";
import { generateFunctionCode } from "../../codegen/typescript-generator";
import { toFileName } from "../../codegen/typescript-generator";
import type { SyncNodeData, ActionNodeData } from "../../types/flow";

interface Props {
  nodeType: "sync" | "action";
  data: SyncNodeData | ActionNodeData;
}

type SourceTab = "disk" | "generated";

function ChevronIcon({ open }: { open: boolean }) {
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
      className={`transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function resolveSourcePath(
  projectFilePath: string | null,
  nodeType: "sync" | "action",
  label: string,
): string | null {
  if (!projectFilePath || !label) return null;
  const dir = projectFilePath.replace(/[\\/][^\\/]+$/, "");
  const folder = nodeType === "sync" ? "syncs" : "actions";
  const fileName = toFileName(label);
  return `${dir}/${folder}/${fileName}.ts`;
}

export function FunctionCodeViewer({ nodeType, data }: Props) {
  const [expanded, setExpanded] = useState(false);
  const nodes = useFlowStore((s) => s.nodes);
  const projectFilePath = useProjectStore((s) => s.project.filePath);

  const [diskCode, setDiskCode] = useState<string | null>(null);
  const [diskError, setDiskError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<SourceTab>("disk");

  const modelNodes = useMemo(
    () => nodes.filter((n) => n.type === "model"),
    [nodes],
  );

  const generatedCode = useMemo(
    () => generateFunctionCode(nodeType, data, modelNodes),
    [nodeType, data, modelNodes],
  );

  const sourcePath = useMemo(
    () => resolveSourcePath(projectFilePath, nodeType, data.label),
    [projectFilePath, nodeType, data.label],
  );

  useEffect(() => {
    if (!expanded || !sourcePath) {
      setDiskCode(null);
      setDiskError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    if (!window.project) { setLoading(false); return; }
    window.project
      .readFile({ filePath: sourcePath })
      .then((res) => {
        if (cancelled) return;
        if (res.status === "ok") {
          setDiskCode(res.data.data);
          setDiskError(null);
        } else {
          setDiskCode(null);
          setDiskError(res.error);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDiskCode(null);
          setDiskError("Failed to read file");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expanded, sourcePath]);

  // Auto-select the appropriate tab based on available content
  useEffect(() => {
    if (diskCode) {
      setActiveTab("disk");
    } else if (generatedCode) {
      setActiveTab("generated");
    }
  }, [diskCode, generatedCode]);

  if (!generatedCode && !sourcePath) return null;

  const showTabs = diskCode !== null && generatedCode !== null;
  const displayCode =
    activeTab === "disk" && diskCode ? diskCode : (generatedCode ?? "");

  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left cursor-pointer group"
      >
        <ChevronIcon open={expanded} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors">
          Function Code
        </span>
      </button>

      {expanded && (
        <div className="mt-2">
          {/* Tab bar (shown only when both sources available) */}
          {showTabs && (
            <div className="flex items-center gap-1 mb-1.5">
              <TabButton
                label="Source"
                active={activeTab === "disk"}
                onClick={() => setActiveTab("disk")}
              />
              <TabButton
                label="Generated"
                active={activeTab === "generated"}
                onClick={() => setActiveTab("generated")}
              />
            </div>
          )}

          {/* Status indicator */}
          {loading && (
            <p className="text-[10px] text-[var(--color-text-muted)] mb-1">
              Loading source file...
            </p>
          )}
          {!loading && diskError && activeTab === "disk" && (
            <p className="text-[10px] text-[var(--color-text-muted)] mb-1">
              No source file on disk — showing generated code
            </p>
          )}

          {/* Editor */}
          <div className="rounded border border-[var(--color-border)] overflow-hidden h-64">
            <Editor
              language="typescript"
              value={displayCode}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 11,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
                padding: { top: 6 },
                folding: false,
                renderLineHighlight: "none",
              }}
            />
          </div>

          {/* File path hint */}
          {sourcePath && activeTab === "disk" && diskCode && (
            <p className="mt-1 text-[9px] text-[var(--color-text-muted)] truncate font-mono">
              {sourcePath}
            </p>
          )}
        </div>
      )}
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
      className={`px-2 py-0.5 text-[10px] rounded transition-colors cursor-pointer ${
        active
          ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      {label}
    </button>
  );
}
