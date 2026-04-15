import { create } from "zustand";
import type { ValidationDiagnostic } from "../validation/rules";
import { validateGraph, groupByNode } from "../validation/engine";
import { useFlowStore } from "./flowStore";

interface ValidationState {
  diagnostics: ValidationDiagnostic[];
  byNode: Map<string, ValidationDiagnostic[]>;
  errorCount: number;
  warningCount: number;
}

export const useValidationStore = create<ValidationState>(() => ({
  diagnostics: [],
  byNode: new Map(),
  errorCount: 0,
  warningCount: 0,
}));

function runValidation() {
  const { nodes, edges } = useFlowStore.getState();
  const diagnostics = validateGraph(nodes, edges);
  const byNode = groupByNode(diagnostics);
  useValidationStore.setState({
    diagnostics,
    byNode,
    errorCount: diagnostics.filter((d) => d.level === "error").length,
    warningCount: diagnostics.filter((d) => d.level === "warning").length,
  });
}

// Debounce re-validation so rapid node changes don't thrash.
let timer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 300;

function scheduleValidation() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(runValidation, DEBOUNCE_MS);
}

// Subscribe to flow store changes and re-validate automatically.
useFlowStore.subscribe(
  (state, prev) => {
    if (state.nodes !== prev.nodes || state.edges !== prev.edges) {
      scheduleValidation();
    }
  },
);

const EMPTY: ValidationDiagnostic[] = [];

/** Convenience selector: get diagnostics for a specific node. */
export function useNodeDiagnostics(
  nodeId: string,
): ValidationDiagnostic[] {
  return useValidationStore((s) => s.byNode.get(nodeId) ?? EMPTY);
}
