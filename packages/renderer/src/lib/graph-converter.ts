/**
 * Converts an AI-generated integration definition (nango.yaml + TypeScript)
 * into React Flow nodes and edges suitable for the canvas.
 *
 * This is the inverse of the code-generation path in `codegen/typescript-generator.ts`.
 */
import type { Node, Edge } from "@xyflow/react";
import type { AiGenerationResult } from "@nango-gui/shared";
import yaml from "js-yaml";
import type {
  SyncNodeData,
  ActionNodeData,
  ModelNodeData,
  ModelField,
} from "../types/flow";

// ── Public API ────────────────────────────────────────────────────────────

export interface FlowGraph {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Parse an AI-generated definition and produce React Flow nodes + edges.
 * Handles partial or incomplete YAML gracefully — returns whatever it can parse.
 */
export function definitionToFlow(definition: AiGenerationResult): FlowGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const parsed = safeParseYaml(definition.yaml);
  if (!parsed) return { nodes, edges };

  // The nango.yaml structure can be:
  //   integrations:
  //     <integration-id>:
  //       syncs: { <name>: { ... } }
  //       actions: { <name>: { ... } }
  //   models:
  //     <name>: { ... }
  const integrations = asRecord(parsed.integrations);
  const modelDefs = asRecord(parsed.models);

  // Layout constants
  const COLUMN_SYNC = 100;
  const COLUMN_ACTION = 500;
  const COLUMN_MODEL = 900;
  const ROW_START = 80;
  const ROW_GAP = 180;

  let syncRow = 0;
  let actionRow = 0;
  const modelMap = new Map<string, string>(); // model name → node id

  // 1. Create model nodes first so syncs/actions can reference them
  let modelRow = 0;
  for (const [modelName, modelDef] of Object.entries(modelDefs)) {
    const nodeId = `model-${Date.now()}-${modelRow}`;
    const fields = parseModelFields(modelDef);

    const data: ModelNodeData = {
      label: modelName,
      fields,
    };

    nodes.push({
      id: nodeId,
      type: "model",
      position: { x: COLUMN_MODEL, y: ROW_START + modelRow * ROW_GAP },
      data: data as unknown as Record<string, unknown>,
    });

    modelMap.set(modelName, nodeId);
    modelRow++;
  }

  // 2. Walk integrations to find syncs and actions
  for (const integrationDef of Object.values(integrations)) {
    const integration = asRecord(integrationDef);
    const syncs = asRecord(integration.syncs);
    const actions = asRecord(integration.actions);

    // Syncs
    for (const [syncName, syncDef] of Object.entries(syncs)) {
      const spec = asRecord(syncDef);
      const nodeId = `sync-${Date.now()}-${syncRow}`;

      // output can be a string or array — take the first model ref
      const outputModel = firstString(spec.output) ?? "";

      const data: SyncNodeData = {
        label: syncName,
        description: stringOr(spec.description, ""),
        frequency: stringOr(spec.runs, stringOr(spec.frequency, "every 1h")),
        endpoint: buildEndpoint(spec.endpoint),
        method: stringOr(spec.method, "GET").toUpperCase(),
        modelRef: outputModel,
      };

      nodes.push({
        id: nodeId,
        type: "sync",
        position: { x: COLUMN_SYNC, y: ROW_START + syncRow * ROW_GAP },
        data: data as unknown as Record<string, unknown>,
      });

      // Edge from sync → model
      if (outputModel && modelMap.has(outputModel)) {
        edges.push({
          id: `edge-${nodeId}-${modelMap.get(outputModel)}`,
          source: nodeId,
          target: modelMap.get(outputModel)!,
        });
      }

      syncRow++;
    }

    // Actions
    for (const [actionName, actionDef] of Object.entries(actions)) {
      const spec = asRecord(actionDef);
      const nodeId = `action-${Date.now()}-${actionRow}`;

      const inputModel = firstString(spec.input) ?? "";
      const outputModel = firstString(spec.output) ?? "";

      const data: ActionNodeData = {
        label: actionName,
        description: stringOr(spec.description, ""),
        endpoint: buildEndpoint(spec.endpoint),
        method: stringOr(spec.method, "POST").toUpperCase(),
        inputModelRef: inputModel,
        outputModelRef: outputModel,
      };

      nodes.push({
        id: nodeId,
        type: "action",
        position: { x: COLUMN_ACTION, y: ROW_START + actionRow * ROW_GAP },
        data: data as unknown as Record<string, unknown>,
      });

      // Edge from action → output model
      if (outputModel && modelMap.has(outputModel)) {
        edges.push({
          id: `edge-${nodeId}-${modelMap.get(outputModel)}`,
          source: nodeId,
          target: modelMap.get(outputModel)!,
        });
      }

      actionRow++;
    }
  }

  return { nodes, edges };
}

// ── Internal helpers ──────────────────────────────────────────────────────

function safeParseYaml(yamlStr: string): Record<string, unknown> | null {
  if (!yamlStr?.trim()) return null;
  try {
    const result = yaml.load(yamlStr);
    if (result && typeof result === "object") {
      return result as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function asRecord(val: unknown): Record<string, unknown> {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function stringOr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

/** Extract the first string from a value that might be a string, string[], or object. */
function firstString(val: unknown): string | null {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && typeof val[0] === "string") return val[0];
  return null;
}

/**
 * nango.yaml endpoint can be:
 *  - a plain string: "/contacts"
 *  - an object: { method: "GET", path: "/contacts" }
 *  - an array of the above
 */
function buildEndpoint(val: unknown): string {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && val.length > 0) return buildEndpoint(val[0]);
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    return stringOr(obj.path, stringOr(obj.endpoint, "/"));
  }
  return "/";
}

/** Parse model fields from a nango.yaml model definition. */
function parseModelFields(modelDef: unknown): ModelField[] {
  // Models in nango.yaml can be:
  //   ModelName:
  //     id: string
  //     name: string
  //     email?: string        (optional marker varies)
  //     tags: string[]
  const fields: ModelField[] = [];
  const record = asRecord(modelDef);

  for (const [fieldName, fieldType] of Object.entries(record)) {
    // Skip non-field entries (e.g. __extends)
    if (fieldName.startsWith("__")) continue;

    const optional = fieldName.endsWith("?");
    const cleanName = optional ? fieldName.slice(0, -1) : fieldName;
    const tsType = mapYamlType(fieldType);

    fields.push({
      name: cleanName,
      type: tsType,
      optional,
    });
  }

  return fields;
}

function mapYamlType(val: unknown): string {
  if (typeof val === "string") {
    const lower = val.toLowerCase().trim();
    if (lower === "integer" || lower === "int" || lower === "float" || lower === "double") return "number";
    if (lower === "bool") return "boolean";
    if (lower === "date" || lower === "datetime") return "Date";
    if (lower.endsWith("[]")) {
      const inner = mapYamlType(lower.slice(0, -2));
      return `${inner}[]`;
    }
    return val;
  }
  if (Array.isArray(val)) return "string[]";
  if (val && typeof val === "object") return "object";
  return "string";
}
