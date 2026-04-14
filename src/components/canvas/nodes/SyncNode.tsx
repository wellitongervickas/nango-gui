import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { SyncNodeData } from "../../../types/flow";

export function SyncNode({ data }: NodeProps) {
  const d = data as unknown as SyncNodeData;
  return (
    <div className="bg-[var(--color-surface)] border-2 border-[var(--color-sync)] rounded-lg p-3 min-w-[180px] shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-[var(--color-sync)]" />
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-sync)]">
          Sync
        </span>
      </div>
      <div className="text-sm font-medium text-[var(--color-text)]">
        {d.label || "New Sync"}
      </div>
      {d.frequency && (
        <div className="text-xs text-[var(--color-text-muted)] mt-1">
          {d.frequency}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
