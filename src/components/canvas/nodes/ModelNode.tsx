import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ModelNodeData } from "../../../types/flow";

export function ModelNode({ data }: NodeProps) {
  const d = data as unknown as ModelNodeData;
  return (
    <div className="bg-[var(--color-surface)] border-2 border-[var(--color-model)] rounded-lg p-3 min-w-[180px] shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-[var(--color-model)]" />
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-model)]">
          Model
        </span>
      </div>
      <div className="text-sm font-medium text-[var(--color-text)]">
        {d.label || "New Model"}
      </div>
      {d.fields && d.fields.length > 0 && (
        <div className="mt-2 text-xs text-[var(--color-text-muted)] space-y-0.5">
          {d.fields.slice(0, 4).map((f) => (
            <div key={f.name}>
              {f.name}: {f.type}
              {f.optional && "?"}
            </div>
          ))}
          {d.fields.length > 4 && (
            <div>+{d.fields.length - 4} more</div>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
