import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ActionNodeData } from "../../../types/flow";

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as unknown as ActionNodeData;
  return (
    <div
      style={{
        width: 220,
        background: "var(--color-bg-surface)",
        border: selected
          ? "2px solid var(--color-node-action)"
          : "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      {/* Colored header band */}
      <div
        style={{
          backgroundColor: "var(--color-node-action)",
          padding: "6px 10px",
        }}
        className="flex items-center gap-2"
      >
        <span className="text-[10px] font-semibold text-white uppercase tracking-widest shrink-0">
          Action
        </span>
        <span className="text-xs text-white/80 font-medium truncate flex-1">
          {d.label || "New Action"}
        </span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-1.5">
        {d.endpoint && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span style={{ color: "var(--color-text-secondary)" }}>
              Endpoint:
            </span>
            <span
              className="font-mono truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {d.method ? `${d.method} ` : ""}
              {d.endpoint}
            </span>
          </div>
        )}
        {d.inputModelRef && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span style={{ color: "var(--color-text-secondary)" }}>Input:</span>
            <span style={{ color: "var(--color-node-model)" }}>
              {d.inputModelRef}
            </span>
          </div>
        )}
        {d.outputModelRef && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span style={{ color: "var(--color-text-secondary)" }}>
              Output:
            </span>
            <span style={{ color: "var(--color-node-model)" }}>
              {d.outputModelRef}
            </span>
          </div>
        )}
        {!d.endpoint && !d.inputModelRef && !d.outputModelRef && (
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
          background: "var(--color-node-action)",
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
          background: "var(--color-node-action)",
          border: "none",
        }}
      />
    </div>
  );
}
