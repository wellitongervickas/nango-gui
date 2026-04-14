import { useFlowStore } from "../../store/flowStore";
import type { NangoNodeType } from "../../types/flow";

const NODE_TEMPLATES: { type: NangoNodeType; label: string; color: string }[] =
  [
    { type: "sync", label: "Sync", color: "var(--color-sync)" },
    { type: "action", label: "Action", color: "var(--color-action)" },
    { type: "model", label: "Model", color: "var(--color-model)" },
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

  return (
    <aside className="w-56 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col p-4 gap-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        Add Node
      </h2>
      <div className="flex flex-col gap-2">
        {NODE_TEMPLATES.map(({ type, label, color }) => (
          <button
            key={type}
            onClick={() => handleAddNode(type)}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg)] transition-colors text-left text-sm cursor-pointer"
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            {label}
          </button>
        ))}
      </div>
      <hr className="border-[var(--color-border)]" />
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        Project
      </h2>
      <p className="text-xs text-[var(--color-text-muted)]">
        Add nodes to the canvas to define your Nango integration.
      </p>
    </aside>
  );
}
