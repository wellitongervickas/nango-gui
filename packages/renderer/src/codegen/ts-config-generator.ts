import type { Node, Edge } from "@xyflow/react";
import type {
  SyncNodeData,
  ActionNodeData,
  ModelNodeData,
  TriggerNodeData,
  WebhookNodeData,
  NangoProject,
} from "../types/flow";

// ── Edge helpers ────────────────────────────────────────────────────────

function connectedTargets(nodeId: string, edges: Edge[], nodes: Node[]): Node[] {
  const targetIds = edges.filter((e) => e.source === nodeId).map((e) => e.target);
  return nodes.filter((n) => targetIds.includes(n.id));
}

function connectedSources(nodeId: string, edges: Edge[], nodes: Node[]): Node[] {
  const sourceIds = edges.filter((e) => e.target === nodeId).map((e) => e.source);
  return nodes.filter((n) => sourceIds.includes(n.id));
}

function resolveModelRef(
  nodeId: string,
  explicitRef: string | undefined,
  edges: Edge[],
  nodes: Node[],
): string {
  if (explicitRef) return explicitRef;
  const connected = [
    ...connectedTargets(nodeId, edges, nodes),
    ...connectedSources(nodeId, edges, nodes),
  ];
  const model = connected.find((n) => n.type === "model");
  if (model) return (model.data as unknown as ModelNodeData).label || model.id;
  return "Unknown";
}

// ── Helpers ─────────────────────────────────────────────────────────────

function indent(text: string, level: number): string {
  const pad = "  ".repeat(level);
  return text
    .split("\n")
    .map((line) => (line.trim() ? `${pad}${line}` : line))
    .join("\n");
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "\\'")}'`;
}

// ── Graph → nango.ts ────────────────────────────────────────────────────

/**
 * Convert the visual graph + project config into a valid `nango.ts`
 * TypeScript configuration string.
 *
 * This replaces the legacy `nango.yaml` export. The generated config
 * conforms to the Nango CLI v0.64.0+ TypeScript config format using
 * `satisfies NangoYAMLConfig` for type safety.
 */
export function graphToTsConfig(
  project: NangoProject,
  nodes: Node[],
  edges: Edge[],
): string {
  const provider = project.provider || "unknown";

  const modelNodes = nodes.filter((n) => n.type === "model");
  const syncNodes = nodes.filter((n) => n.type === "sync");
  const actionNodes = nodes.filter((n) => n.type === "action");
  const webhookNodes = nodes.filter((n) => n.type === "webhook");

  // Build integration object
  const integrationParts: string[] = [];

  // Syncs
  if (syncNodes.length > 0) {
    const syncEntries: string[] = [];
    for (const node of syncNodes) {
      const d = node.data as unknown as SyncNodeData;
      const name = d.label || node.id;
      const output = resolveModelRef(node.id, d.modelRef, edges, nodes);

      const props: string[] = [];
      props.push(`runs: ${quote(resolveFrequency(node, d, edges, nodes))}`);
      props.push(`endpoint: ${quote(`${(d.method && d.method !== "GET" ? d.method + " " : "GET ")}${d.endpoint || "/"}`)}`);
      props.push(`output: ${quote(output)}`);
      if (d.description) props.push(`description: ${quote(d.description)}`);

      syncEntries.push(`${quote(name)}: {\n${indent(props.join(",\n"), 1)},\n}`);
    }
    integrationParts.push(`syncs: {\n${indent(syncEntries.join(",\n"), 1)},\n}`);
  }

  // Actions
  if (actionNodes.length > 0) {
    const actionEntries: string[] = [];
    for (const node of actionNodes) {
      const d = node.data as unknown as ActionNodeData;
      const name = d.label || node.id;
      const output = resolveModelRef(node.id, d.outputModelRef, edges, nodes);

      let input = d.inputModelRef || "";
      if (!input) {
        const sources = connectedSources(node.id, edges, nodes);
        const inputModel = sources.find((n) => n.type === "model");
        if (inputModel)
          input = (inputModel.data as unknown as ModelNodeData).label || "";
      }

      const props: string[] = [];
      props.push(`endpoint: ${quote(`${(d.method || "POST").toUpperCase()} ${d.endpoint || "/"}`)}`);
      if (input) props.push(`input: ${quote(input)}`);
      props.push(`output: ${quote(output)}`);
      if (d.description) props.push(`description: ${quote(d.description)}`);

      actionEntries.push(
        `${quote(name)}: {\n${indent(props.join(",\n"), 1)},\n}`,
      );
    }
    integrationParts.push(
      `actions: {\n${indent(actionEntries.join(",\n"), 1)},\n}`,
    );
  }

  // Webhooks
  if (webhookNodes.length > 0) {
    const webhookEntries: string[] = [];
    for (const node of webhookNodes) {
      const d = node.data as unknown as WebhookNodeData;
      const name = d.label || node.id;
      const output = resolveModelRef(node.id, d.modelRef, edges, nodes);

      const props: string[] = [];
      props.push(`endpoint: ${quote(d.endpoint || "/")}`);
      props.push(`output: ${quote(output)}`);
      if (d.method) props.push(`method: ${quote(d.method)}`);
      if (d.description) props.push(`description: ${quote(d.description)}`);

      webhookEntries.push(
        `${quote(name)}: {\n${indent(props.join(",\n"), 1)},\n}`,
      );
    }
    integrationParts.push(
      `webhooks: {\n${indent(webhookEntries.join(",\n"), 1)},\n}`,
    );
  }

  // Models
  const modelEntries: string[] = [];
  for (const node of modelNodes) {
    const d = node.data as unknown as ModelNodeData;
    const name = d.label || node.id;
    const fields = d.fields ?? [];

    if (fields.length === 0) {
      modelEntries.push(`${quote(name)}: {\n  id: 'string',\n}`);
    } else {
      const fieldLines = fields.map((f) => {
        const key = f.optional ? `'${f.name}?'` : f.name;
        return `${key}: ${quote(f.type)}`;
      });
      modelEntries.push(
        `${quote(name)}: {\n${indent(fieldLines.join(",\n"), 1)},\n}`,
      );
    }
  }

  // Assemble full config
  const integrationBody =
    integrationParts.length > 0
      ? `{\n${indent(integrationParts.join(",\n"), 1)},\n}`
      : "{}";

  const modelsBody =
    modelEntries.length > 0
      ? `{\n${indent(modelEntries.join(",\n"), 1)},\n}`
      : "{}";

  return `import type { NangoYAMLConfig } from '@nangohq/types';

export default {
  integrations: {
    ${quote(provider)}: ${indent(integrationBody, 2).trimStart()},
  },
  models: ${indent(modelsBody, 1).trimStart()},
} satisfies NangoYAMLConfig;
`;
}

// ── Frequency resolution ────────────────────────────────────────────────

function resolveFrequency(
  node: Node,
  data: SyncNodeData,
  edges: Edge[],
  nodes: Node[],
): string {
  const sources = connectedSources(node.id, edges, nodes);
  const trigger = sources.find((n) => n.type === "trigger");
  if (trigger) {
    const td = trigger.data as unknown as TriggerNodeData;
    if (td.frequency) return td.frequency;
  }
  return data.frequency || "every 1h";
}
