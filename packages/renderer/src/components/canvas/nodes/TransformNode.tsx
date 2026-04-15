import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TransformNodeData } from "../../../types/flow";
import { NodeValidationIndicator } from "../NodeValidationIndicator";

const TRANSFORM_LABELS: Record<string, string> = {
  direct: "=",
  rename: "Rename",
  cast: "Cast",
  template: "Tmpl",
};

export function TransformNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as TransformNodeData;
  const mappings = d.mappings ?? [];

  return (
    <div
      style={{
        position: "relative",
        width: 260,
        background: "var(--color-bg-surface)",
        border: selected
          ? "2px solid var(--color-node-transform)"
          : "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      <NodeValidationIndicator nodeId={id} />
      <div
        style={{
          backgroundColor: "var(--color-node-transform)",
          padding: "6px 10px",
        }}
        className="flex items-center gap-2"
      >
        <span className="text-[10px] font-semibold text-white uppercase tracking-widest shrink-0">
          Transform
        </span>
        <span className="text-xs text-white/80 font-medium truncate flex-1">
          {d.label || "New Transform"}
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

        {(d.inputModelRef || d.outputModelRef) && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className="font-mono truncate"
              style={{ color: "var(--color-node-model)" }}
            >
              {d.inputModelRef || "?"}
            </span>
            <span style={{ color: "var(--color-text-disabled)" }}>&rarr;</span>
            <span
              className="font-mono truncate"
              style={{ color: "var(--color-node-model)" }}
            >
              {d.outputModelRef || "?"}
            </span>
          </div>
        )}

        {mappings.length > 0 ? (
          <div
            className="space-y-0.5 pt-1 border-t"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            {mappings.slice(0, 5).map((m, i) => (
              <div key={i} className="flex items-center gap-1 text-[11px]">
                <span
                  className="truncate"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {m.sourceField}
                </span>
                <span
                  className="shrink-0 px-1 rounded text-[9px] font-mono"
                  style={{
                    color: "var(--color-node-transform)",
                    backgroundColor: "rgba(139,92,246,0.12)",
                  }}
                >
                  {TRANSFORM_LABELS[m.transform] ?? m.transform}
                </span>
                <span
                  className="truncate ml-auto"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {m.targetField}
                </span>
              </div>
            ))}
            {mappings.length > 5 && (
              <div
                className="text-[11px]"
                style={{ color: "var(--color-text-disabled)" }}
              >
                +{mappings.length - 5} more
              </div>
            )}
          </div>
        ) : (
          !d.inputModelRef &&
          !d.outputModelRef &&
          !d.description && (
            <p
              className="text-[11px] italic"
              style={{ color: "var(--color-text-disabled)" }}
            >
              No configuration
            </p>
          )
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{
          width: 6,
          height: 6,
          background: "var(--color-node-transform)",
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
          background: "var(--color-node-transform)",
          border: "none",
        }}
      />
    </div>
  );
}
