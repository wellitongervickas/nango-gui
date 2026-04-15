import yaml from "js-yaml";
import type { Node, Edge } from "@xyflow/react";
import type {
  SyncNodeData,
  ActionNodeData,
  ModelNodeData,
  TriggerNodeData,
  WebhookNodeData,
  TransformNodeData,
  NangoProject,
  ModelField,
} from "../types/flow";
import type {
  NangoYaml,
  NangoYamlSync,
  NangoYamlAction,
  NangoYamlWebhook,
  NangoYamlModel,
  NangoYamlIntegration,
} from "./yaml-schema";

// ── Edge helpers ────────────────────────────────────────────────────────

/** Find all nodes connected as targets from the given source. */
function connectedTargets(nodeId: string, edges: Edge[], nodes: Node[]): Node[] {
  const targetIds = edges.filter((e) => e.source === nodeId).map((e) => e.target);
  return nodes.filter((n) => targetIds.includes(n.id));
}

/** Find all nodes connected as sources to the given target. */
function connectedSources(nodeId: string, edges: Edge[], nodes: Node[]): Node[] {
  const sourceIds = edges.filter((e) => e.target === nodeId).map((e) => e.source);
  return nodes.filter((n) => sourceIds.includes(n.id));
}

/**
 * Resolve the output model label for a node.
 * Prefers the explicit modelRef from data, falls back to the first
 * connected model node found via edges.
 */
function resolveModelRef(
  nodeId: string,
  explicitRef: string | undefined,
  edges: Edge[],
  nodes: Node[],
): string {
  if (explicitRef) return explicitRef;
  const targets = connectedTargets(nodeId, edges, nodes);
  const sources = connectedSources(nodeId, edges, nodes);
  const connected = [...targets, ...sources];
  const model = connected.find((n) => n.type === "model");
  if (model) return (model.data as unknown as ModelNodeData).label || model.id;
  return "Unknown";
}

// ── Graph → YAML ────────────────────────────────────────────────────────

/**
 * Convert the visual graph + project config into a valid `nango.yaml` string.
 *
 * This transpiler walks the graph, resolves node connections via edges,
 * and emits valid Nango YAML covering syncs, actions, webhooks, and models.
 * Transform and trigger nodes contribute metadata annotations.
 */
export function graphToYaml(
  project: NangoProject,
  nodes: Node[],
  edges: Edge[],
): string {
  const provider = project.provider || "unknown";
  const integration: NangoYamlIntegration = {};
  const models: Record<string, NangoYamlModel> = {};

  // Build model map first (needed for ref resolution)
  const modelNodes = nodes.filter((n) => n.type === "model");
  for (const node of modelNodes) {
    const d = node.data as unknown as ModelNodeData;
    const name = d.label || node.id;
    models[name] = (d.fields ?? []).map((f) => ({
      name: f.name,
      type: f.type,
      ...(f.optional ? { optional: true } : {}),
    }));
  }

  // Syncs
  const syncNodes = nodes.filter((n) => n.type === "sync");
  if (syncNodes.length > 0) {
    integration.syncs = {};
    for (const node of syncNodes) {
      const d = node.data as unknown as SyncNodeData;
      const name = d.label || node.id;
      const output = resolveModelRef(node.id, d.modelRef, edges, nodes);
      const entry: NangoYamlSync = {
        endpoint: d.endpoint || "/",
        frequency: d.frequency || "every 1h",
        output,
      };
      if (d.description) entry.description = d.description;
      if (d.method && d.method !== "GET") entry.method = d.method;

      // Check for connected trigger node → override frequency/auto_start
      const sources = connectedSources(node.id, edges, nodes);
      const trigger = sources.find((n) => n.type === "trigger");
      if (trigger) {
        const td = trigger.data as unknown as TriggerNodeData;
        if (td.frequency) entry.frequency = td.frequency;
      }

      integration.syncs[name] = entry;
    }
  }

  // Actions
  const actionNodes = nodes.filter((n) => n.type === "action");
  if (actionNodes.length > 0) {
    integration.actions = {};
    for (const node of actionNodes) {
      const d = node.data as unknown as ActionNodeData;
      const name = d.label || node.id;

      // Resolve output model: explicit ref → edge-connected model
      const output = resolveModelRef(node.id, d.outputModelRef, edges, nodes);

      // Resolve input model: explicit ref → edge-connected model from sources
      let input = d.inputModelRef || "";
      if (!input) {
        const sources = connectedSources(node.id, edges, nodes);
        const inputModel = sources.find((n) => n.type === "model");
        if (inputModel) input = (inputModel.data as unknown as ModelNodeData).label || "";
      }

      const entry: NangoYamlAction = {
        endpoint: d.endpoint || "/",
        output,
      };
      if (d.description) entry.description = d.description;
      if (d.method && d.method !== "POST") entry.method = d.method;
      if (input) entry.input = input;
      integration.actions[name] = entry;
    }
  }

  // Webhooks
  const webhookNodes = nodes.filter((n) => n.type === "webhook");
  if (webhookNodes.length > 0) {
    integration.webhooks = {};
    for (const node of webhookNodes) {
      const d = node.data as unknown as WebhookNodeData;
      const name = d.label || node.id;
      const output = resolveModelRef(node.id, d.modelRef, edges, nodes);
      const entry: NangoYamlWebhook = {
        endpoint: d.endpoint || "/",
        output,
      };
      if (d.description) entry.description = d.description;
      if (d.method) entry.method = d.method;
      integration.webhooks[name] = entry;
    }
  }

  const doc: NangoYaml = {
    integrations: { [provider]: integration },
    models,
  };

  let output = yaml.dump(doc, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: "'",
    forceQuotes: false,
  });

  // Append transform metadata as comments (not part of nango.yaml spec,
  // but preserved for round-trip fidelity in the GUI).
  const transforms = nodes.filter((n) => n.type === "transform");
  if (transforms.length > 0) {
    output += "\n# ── Transform mappings (GUI metadata) ──\n";
    for (const node of transforms) {
      const d = node.data as unknown as TransformNodeData;
      const name = d.label || node.id;
      output += `# transform: ${name}`;
      if (d.inputModelRef || d.outputModelRef)
        output += ` (${d.inputModelRef || "?"} → ${d.outputModelRef || "?"})`;
      output += "\n";
      for (const m of d.mappings ?? []) {
        output += `#   ${m.sourceField} → ${m.targetField} [${m.transform}]\n`;
      }
    }
  }

  return output;
}

// ── YAML → Graph-compatible data ────────────────────────────────────────

export interface ParsedGraph {
  project: Partial<NangoProject>;
  nodes: Node[];
  edges: Edge[];
}

/**
 * Parse a `nango.yaml` string into graph-compatible nodes/edges.
 * Used when importing an existing Nango config into the visual builder.
 */
export function yamlToGraph(yamlStr: string): ParsedGraph {
  const doc = yaml.load(yamlStr) as NangoYaml;
  if (!doc?.integrations) {
    return { project: {}, nodes: [], edges: [] };
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let x = 100;
  const yStep = 160;
  let nodeIdx = 0;

  const providers = Object.keys(doc.integrations);
  const provider = providers[0] ?? "unknown";
  const integration = doc.integrations[provider] ?? {};

  const project: Partial<NangoProject> = { provider };

  // Models
  const modelMap = doc.models ?? {};
  const modelX = 500;
  for (const [name, fields] of Object.entries(modelMap)) {
    const id = `model-${nodeIdx++}`;
    const modelFields: ModelField[] = (fields ?? []).map((f) => ({
      name: f.name,
      type: f.type,
      optional: f.optional ?? false,
    }));
    nodes.push({
      id,
      type: "model",
      position: { x: modelX, y: nodeIdx * yStep },
      data: { label: name, fields: modelFields },
    });
  }

  // Syncs
  if (integration.syncs) {
    for (const [name, sync] of Object.entries(integration.syncs)) {
      const id = `sync-${nodeIdx++}`;
      nodes.push({
        id,
        type: "sync",
        position: { x, y: nodeIdx * yStep },
        data: {
          label: name,
          description: sync.description ?? "",
          endpoint: sync.endpoint,
          method: sync.method ?? "GET",
          frequency: sync.frequency,
          modelRef: sync.output,
        },
      });
      // Connect to model node if exists
      const modelNode = nodes.find(
        (n) => n.type === "model" && (n.data as unknown as ModelNodeData).label === sync.output,
      );
      if (modelNode) {
        edges.push({
          id: `e-${id}-${modelNode.id}`,
          source: id,
          target: modelNode.id,
        });
      }
    }
  }

  // Actions
  if (integration.actions) {
    for (const [name, action] of Object.entries(integration.actions)) {
      const id = `action-${nodeIdx++}`;
      nodes.push({
        id,
        type: "action",
        position: { x, y: nodeIdx * yStep },
        data: {
          label: name,
          description: action.description ?? "",
          endpoint: action.endpoint,
          method: action.method ?? "POST",
          inputModelRef: action.input ?? "",
          outputModelRef: action.output,
        },
      });
      const outModel = nodes.find(
        (n) => n.type === "model" && (n.data as unknown as ModelNodeData).label === action.output,
      );
      if (outModel) {
        edges.push({
          id: `e-${id}-${outModel.id}`,
          source: id,
          target: outModel.id,
        });
      }
    }
  }

  // Webhooks
  if (integration.webhooks) {
    for (const [name, webhook] of Object.entries(integration.webhooks)) {
      const id = `webhook-${nodeIdx++}`;
      nodes.push({
        id,
        type: "webhook",
        position: { x, y: nodeIdx * yStep },
        data: {
          label: name,
          description: webhook.description ?? "",
          endpoint: webhook.endpoint,
          method: webhook.method ?? "",
          modelRef: webhook.output,
        },
      });
      const outModel = nodes.find(
        (n) => n.type === "model" && (n.data as unknown as ModelNodeData).label === webhook.output,
      );
      if (outModel) {
        edges.push({
          id: `e-${id}-${outModel.id}`,
          source: id,
          target: outModel.id,
        });
      }
    }
  }

  return { project, nodes, edges };
}
