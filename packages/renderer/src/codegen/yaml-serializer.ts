import yaml from "js-yaml";
import type { Node, Edge } from "@xyflow/react";
import type {
  SyncNodeData,
  ActionNodeData,
  ModelNodeData,
  WebhookNodeData,
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

// ── Graph → YAML ────────────────────────────────────────────────────────

/**
 * Convert the visual graph + project config into a valid `nango.yaml` string.
 */
export function graphToYaml(
  project: NangoProject,
  nodes: Node[],
  _edges: Edge[],
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
      const entry: NangoYamlSync = {
        endpoint: d.endpoint || "/",
        frequency: d.frequency || "every 1h",
        output: d.modelRef || "Unknown",
      };
      if (d.description) entry.description = d.description;
      if (d.method && d.method !== "GET") entry.method = d.method;
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
      const entry: NangoYamlAction = {
        endpoint: d.endpoint || "/",
        output: d.outputModelRef || "Unknown",
      };
      if (d.description) entry.description = d.description;
      if (d.method && d.method !== "POST") entry.method = d.method;
      if (d.inputModelRef) entry.input = d.inputModelRef;
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
      const entry: NangoYamlWebhook = {
        endpoint: d.endpoint || "/",
        output: d.modelRef || "Unknown",
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

  return yaml.dump(doc, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: "'",
    forceQuotes: false,
  });
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
