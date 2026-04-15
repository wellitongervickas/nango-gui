import { useNodeDiagnostics } from "../../store/validationStore";

interface Props {
  nodeId: string;
}

/**
 * Renders a small error/warning badge on a node when validation diagnostics
 * exist. Place inside the node's wrapper div.
 */
export function NodeValidationIndicator({ nodeId }: Props) {
  const diagnostics = useNodeDiagnostics(nodeId);
  if (diagnostics.length === 0) return null;

  const hasError = diagnostics.some((d) => d.level === "error");
  const color = hasError
    ? "var(--color-error, #ef4444)"
    : "var(--color-warning, #f59e0b)";
  const label = diagnostics
    .map((d) => `${d.level === "error" ? "✗" : "⚠"} ${d.message}`)
    .join("\n");

  return (
    <div
      title={label}
      style={{
        position: "absolute",
        top: -6,
        right: -6,
        width: 16,
        height: 16,
        borderRadius: "50%",
        backgroundColor: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        color: "#fff",
        cursor: "default",
        zIndex: 10,
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }}
    >
      {diagnostics.length}
    </div>
  );
}
