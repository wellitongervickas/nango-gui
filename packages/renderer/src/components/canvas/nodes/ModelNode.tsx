import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ModelNodeData } from "../../../types/flow";

export function ModelNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModelNodeData;
  const fields = d.fields ?? [];
  return (
    <div
      style={{
        width: 220,
        background: "var(--color-bg-surface)",
        border: selected
          ? "2px solid var(--color-node-model)"
          : "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      {/* Colored header band */}
      <div
        style={{
          backgroundColor: "var(--color-node-model)",
          padding: "6px 10px",
        }}
        className="flex items-center gap-2"
      >
        <span className="text-[10px] font-semibold text-white uppercase tracking-widest shrink-0">
          Model
        </span>
        <span className="text-xs text-white/80 font-medium truncate flex-1">
          {d.label || "New Model"}
        </span>
      </div>

      {/* Body */}
      <div className="p-3">
        {fields.length > 0 ? (
          <div className="space-y-0.5">
            {fields.slice(0, 5).map((f, i) => (
              <div key={i} className="flex items-center gap-1 text-[11px]">
                <span style={{ color: "var(--color-text-primary)" }}>
                  {f.name}
                </span>
                {f.optional && (
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    ?
                  </span>
                )}
                <span
                  className="ml-auto"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {f.type}
                </span>
              </div>
            ))}
            {fields.length > 5 && (
              <div
                className="text-[11px]"
                style={{ color: "var(--color-text-disabled)" }}
              >
                +{fields.length - 5} more
              </div>
            )}
          </div>
        ) : (
          <p
            className="text-[11px] italic"
            style={{ color: "var(--color-text-disabled)" }}
          >
            No fields
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
          background: "var(--color-node-model)",
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
          background: "var(--color-node-model)",
          border: "none",
        }}
      />
    </div>
  );
}
