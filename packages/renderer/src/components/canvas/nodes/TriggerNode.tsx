import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TriggerNodeData } from "../../../types/flow";
import { NodeValidationIndicator } from "../NodeValidationIndicator";

export function TriggerNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as TriggerNodeData;
  return (
    <div
      style={{
        position: "relative",
        width: 220,
        background: "var(--color-bg-surface)",
        border: selected
          ? "2px solid var(--color-node-trigger)"
          : "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      <NodeValidationIndicator nodeId={id} />
      <div
        style={{
          backgroundColor: "var(--color-node-trigger)",
          padding: "6px 10px",
        }}
        className="flex items-center gap-2"
      >
        <span className="text-[10px] font-semibold text-white uppercase tracking-widest shrink-0">
          Trigger
        </span>
        <span className="text-xs text-white/80 font-medium truncate flex-1">
          {d.label || "New Trigger"}
        </span>
      </div>

      <div className="p-3 space-y-1.5">
        {d.description && (
          <div
            className="text-[11px] truncate"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {d.description}
          </div>
        )}
        {d.frequency && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span style={{ color: "var(--color-text-secondary)" }}>Every:</span>
            <span style={{ color: "var(--color-node-trigger)" }}>
              {d.frequency}
            </span>
          </div>
        )}
        {d.modelRef && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span style={{ color: "var(--color-text-secondary)" }}>Model:</span>
            <span style={{ color: "var(--color-node-model)" }}>
              {d.modelRef}
            </span>
          </div>
        )}
        {!d.frequency && !d.modelRef && !d.description && (
          <p
            className="text-[11px] italic"
            style={{ color: "var(--color-text-disabled)" }}
          >
            No configuration
          </p>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{
          width: 6,
          height: 6,
          background: "var(--color-node-trigger)",
          border: "none",
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{
          width: 6,
          height: 6,
          background: "var(--color-node-trigger)",
          border: "none",
        }}
      />
    </div>
  );
}
