import type { Node, Edge } from "@xyflow/react";
import {
  type ValidationDiagnostic,
  validateRequiredFields,
  validateModelRefs,
  validateModelFields,
  validateOrphans,
  validateRequiredConnections,
  validateTransformMappings,
} from "./rules";

/**
 * Run all validation rules against the current graph and return diagnostics.
 * Pure function — no side effects.
 */
export function validateGraph(
  nodes: Node[],
  edges: Edge[],
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  // Per-node rules
  for (const node of nodes) {
    diagnostics.push(
      ...validateRequiredFields(node),
      ...validateModelRefs(node, nodes),
      ...validateModelFields(node),
      ...validateRequiredConnections(node, edges, nodes),
      ...validateTransformMappings(node),
    );
  }

  // Graph-level rules
  diagnostics.push(...validateOrphans(nodes, edges));

  return diagnostics;
}

/** Group diagnostics by node ID for quick lookup. */
export function groupByNode(
  diagnostics: ValidationDiagnostic[],
): Map<string, ValidationDiagnostic[]> {
  const map = new Map<string, ValidationDiagnostic[]>();
  for (const d of diagnostics) {
    const key = d.nodeId ?? d.edgeId ?? "__graph__";
    const list = map.get(key);
    if (list) list.push(d);
    else map.set(key, [d]);
  }
  return map;
}
