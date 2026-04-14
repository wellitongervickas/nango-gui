import { useFlowStore } from "../../store/flowStore";
import type { NangoNodeType } from "../../types/flow";

const NODE_TEMPLATES: {
  type: NangoNodeType;
  label: string;
  color: string;
  description: string;
}[] = [
  {
    type: "sync",
    label: "Sync",
    color: "var(--color-sync)",
    description: "Recurring data sync",
  },
  {
    type: "action",
    label: "Action",
    color: "var(--color-action)",
    description: "One-shot action",
  },
  {
    type: "model",
    label: "Model",
    color: "var(--color-model)",
    description: "Data schema",
  },
];

export function Sidebar() {
  const addNode = useFlowStore((s) => s.addNode);

  function handleAddNode(type: NangoNodeType) {
    const id = `${type}-${Date.now()}`;
    addNode({
      id,
      type,
      position: { x: 250 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}` },
    });
  }

  function onDragStart(e: React.DragEvent, type: NangoNodeType) {
    e.dataTransfer.setData("application/reactflow", type);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <aside className="w-52 shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col p-4 gap-4 overflow-y-auto">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        Add Node
      </h2>
      <div className="flex flex-col gap-2">
        {NODE_TEMPLATES.map(({ type, label, color, description }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            onClick={() => handleAddNode(type)}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg)] transition-colors cursor-grab active:cursor-grabbing select-none"
          >
            <span
              className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0"
              style={{ backgroundColor: color }}
            />
            <div>
              <div className="text-sm font-medium text-[var(--color-text)]">
                {label}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {description}
              </div>
            </div>
          </div>
        ))}
      </div>
      <hr className="border-[var(--color-border)]" />
      <div className="flex flex-col gap-1.5 text-xs text-[var(--color-text-muted)]">
        <p>Drag to canvas or click to add.</p>
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[10px] font-mono">
              Ctrl+Z
            </kbd>
            <span>Undo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[10px] font-mono">
              Ctrl+Y
            </kbd>
            <span>Redo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[10px] font-mono">
              Del
            </kbd>
            <span>Delete node</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
