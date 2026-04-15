import type { Node, Edge } from "@xyflow/react";
import type {
  SyncNodeData,
  ActionNodeData,
  ModelNodeData,
  TriggerNodeData,
  WebhookNodeData,
  TransformNodeData,
} from "../types/flow";

export type ValidationLevel = "error" | "warning";

export interface ValidationDiagnostic {
  /** Node or edge that owns this diagnostic. */
  nodeId?: string;
  edgeId?: string;
  level: ValidationLevel;
  message: string;
}

// ── Required-field checks per node type ──────────────────────────────────

const REQUIRED_SYNC_FIELDS: (keyof SyncNodeData)[] = [
  "label",
  "endpoint",
  "frequency",
];
const REQUIRED_ACTION_FIELDS: (keyof ActionNodeData)[] = [
  "label",
  "endpoint",
];
const REQUIRED_MODEL_FIELDS: (keyof ModelNodeData)[] = ["label"];
const REQUIRED_TRIGGER_FIELDS: (keyof TriggerNodeData)[] = [
  "label",
  "frequency",
];
const REQUIRED_WEBHOOK_FIELDS: (keyof WebhookNodeData)[] = [
  "label",
  "endpoint",
];
const REQUIRED_TRANSFORM_FIELDS: (keyof TransformNodeData)[] = ["label"];

function missingFields(
  data: Record<string, unknown>,
  required: string[],
): string[] {
  return required.filter((f) => {
    const v = data[f];
    return v === undefined || v === null || v === "";
  });
}

export function validateRequiredFields(node: Node): ValidationDiagnostic[] {
  const data = node.data as Record<string, unknown>;
  let required: string[];

  switch (node.type) {
    case "sync":
      required = REQUIRED_SYNC_FIELDS;
      break;
    case "action":
      required = REQUIRED_ACTION_FIELDS;
      break;
    case "model":
      required = REQUIRED_MODEL_FIELDS;
      break;
    case "trigger":
      required = REQUIRED_TRIGGER_FIELDS;
      break;
    case "webhook":
      required = REQUIRED_WEBHOOK_FIELDS;
      break;
    case "transform":
      required = REQUIRED_TRANSFORM_FIELDS;
      break;
    default:
      return [];
  }

  const missing = missingFields(data, required);
  if (missing.length === 0) return [];

  return [
    {
      nodeId: node.id,
      level: "error",
      message: `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
    },
  ];
}

// ── Model-ref checks ─────────────────────────────────────────────────────

/** Nodes that reference models by name must point to an existing ModelNode. */
export function validateModelRefs(
  node: Node,
  allNodes: Node[],
): ValidationDiagnostic[] {
  const data = node.data as Record<string, unknown>;
  const modelLabels = new Set(
    allNodes
      .filter((n) => n.type === "model")
      .map((n) => (n.data as Record<string, unknown>).label as string)
      .filter(Boolean),
  );

  const diagnostics: ValidationDiagnostic[] = [];
  const refKeys =
    node.type === "action" || node.type === "transform"
      ? ["inputModelRef", "outputModelRef"]
      : ["modelRef"];

  for (const key of refKeys) {
    const ref = data[key] as string | undefined;
    if (ref && !modelLabels.has(ref)) {
      diagnostics.push({
        nodeId: node.id,
        level: "warning",
        message: `${key} "${ref}" does not match any Model node`,
      });
    }
  }

  return diagnostics;
}

// ── Model node field validation ──────────────────────────────────────────

export function validateModelFields(node: Node): ValidationDiagnostic[] {
  if (node.type !== "model") return [];
  const data = node.data as unknown as ModelNodeData;
  if (!data.fields || data.fields.length === 0) {
    return [
      {
        nodeId: node.id,
        level: "warning",
        message: "Model has no fields defined",
      },
    ];
  }
  return [];
}

// ── Orphan detection ─────────────────────────────────────────────────────

export function validateOrphans(
  nodes: Node[],
  edges: Edge[],
): ValidationDiagnostic[] {
  if (nodes.length <= 1) return [];

  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.source);
    connected.add(e.target);
  }

  return nodes
    .filter((n) => !connected.has(n.id))
    .map((n) => ({
      nodeId: n.id,
      level: "warning" as const,
      message: "Node is disconnected from the graph",
    }));
}

// ── Connection requirement checks ────────────────────────────────────────

/** Sync and Action nodes should be connected to at least one Model node. */
export function validateRequiredConnections(
  node: Node,
  edges: Edge[],
  allNodes: Node[],
): ValidationDiagnostic[] {
  if (node.type !== "sync" && node.type !== "action") return [];

  const connectedIds = edges
    .filter((e) => e.source === node.id || e.target === node.id)
    .flatMap((e) => [e.source, e.target])
    .filter((id) => id !== node.id);

  const hasModel = connectedIds.some((id) => {
    const n = allNodes.find((x) => x.id === id);
    return n?.type === "model";
  });

  if (!hasModel) {
    return [
      {
        nodeId: node.id,
        level: "warning",
        message: `${node.type === "sync" ? "Sync" : "Action"} node should be connected to a Model node`,
      },
    ];
  }

  return [];
}

// ── Transform mapping validation ─────────────────────────────────────────

export function validateTransformMappings(node: Node): ValidationDiagnostic[] {
  if (node.type !== "transform") return [];
  const data = node.data as unknown as TransformNodeData;

  if (!data.inputModelRef && !data.outputModelRef) return [];
  if (data.inputModelRef && data.outputModelRef && (!data.mappings || data.mappings.length === 0)) {
    return [
      {
        nodeId: node.id,
        level: "warning",
        message: "Transform has models but no field mappings defined",
      },
    ];
  }
  return [];
}
