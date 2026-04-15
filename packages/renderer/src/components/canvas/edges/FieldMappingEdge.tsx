import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import type { FieldMappingEdgeData, FieldMapping } from "../../../types/flow";
import { useFlowStore } from "../../../store/flowStore";

const TRANSFORM_LABELS: Record<string, string> = {
  direct: "=",
  rename: "Rn",
  cast: "Cs",
  template: "Tp",
};

function MappingRow({ mapping }: { mapping: FieldMapping }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] leading-tight">
      <span
        className="truncate max-w-[70px] font-mono"
        style={{ color: "var(--color-text-primary)" }}
      >
        {mapping.sourceField}
      </span>
      <span
        className="shrink-0 px-1 rounded text-[8px] font-mono font-semibold"
        style={{
          color: "var(--color-node-transform)",
          backgroundColor: "rgba(139,92,246,0.15)",
        }}
      >
        {TRANSFORM_LABELS[mapping.transform] ?? mapping.transform}
      </span>
      <span
        className="truncate max-w-[70px] font-mono"
        style={{ color: "var(--color-text-primary)" }}
      >
        {mapping.targetField}
      </span>
    </div>
  );
}

export function FieldMappingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const d = data as unknown as FieldMappingEdgeData | undefined;
  const mappings = d?.mappings ?? [];
  const expanded = selected || (d?.expanded ?? false);
  const updateEdgeData = useFlowStore((s) => s.updateEdgeData);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateEdgeData(id, { expanded: !d?.expanded });
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected
            ? "var(--color-node-transform)"
            : "var(--color-border-base)",
          strokeWidth: selected ? 2.5 : 1.5,
          transition: "stroke 0.15s, stroke-width 0.15s",
        }}
      />

      {mappings.length > 0 && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nopan nodrag"
          >
            {expanded ? (
              <div
                onClick={toggleExpanded}
                style={{
                  background: "var(--color-bg-surface)",
                  border: selected
                    ? "1.5px solid var(--color-node-transform)"
                    : "1px solid var(--color-border-subtle)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
                  maxWidth: 240,
                  cursor: "pointer",
                }}
              >
                <div
                  className="text-[9px] font-semibold uppercase tracking-widest mb-1"
                  style={{ color: "var(--color-node-transform)" }}
                >
                  Mappings ({mappings.length})
                </div>
                <div className="space-y-0.5">
                  {mappings.slice(0, 6).map((m, i) => (
                    <MappingRow key={i} mapping={m} />
                  ))}
                  {mappings.length > 6 && (
                    <div
                      className="text-[10px]"
                      style={{ color: "var(--color-text-disabled)" }}
                    >
                      +{mappings.length - 6} more
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={toggleExpanded}
                style={{
                  background: "var(--color-bg-surface)",
                  border: selected
                    ? "1.5px solid var(--color-node-transform)"
                    : "1px solid var(--color-border-subtle)",
                  borderRadius: 10,
                  padding: "2px 8px",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                className="hover:border-[var(--color-node-transform)]"
              >
                <span
                  className="text-[10px] font-medium"
                  style={{ color: "var(--color-node-transform)" }}
                >
                  {mappings.length} field{mappings.length !== 1 ? "s" : ""}
                </span>
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
