import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ActionNodeData } from "../../../types/flow";

export function ActionNode({ data }: NodeProps) {
  const d = data as unknown as ActionNodeData;
  return (
    <div className="bg-[var(--color-surface)] border-2 border-[var(--color-action)] rounded-lg p-3 min-w-[180px] shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-[var(--color-action)]" />
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-action)]">
          Action
        </span>
      </div>
      <div className="text-sm font-medium text-[var(--color-text)]">
        {d.label || "New Action"}
      </div>
      {d.endpoint && (
        <div className="text-xs text-[var(--color-text-muted)] mt-1">
          {d.method} {d.endpoint}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
