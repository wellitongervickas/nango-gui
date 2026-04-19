import type { Node, Edge } from "@xyflow/react";
import type {
  SyncNodeData,
  ActionNodeData,
  ModelNodeData,
  ModelField,
  NangoProject,
} from "../types/flow";

// ── Public API ───────────────────────────────────────────────────────────

export interface GeneratedFile {
  path: string;
  content: string;
}

/**
 * Walk the visual graph and emit a set of TypeScript handler files that form
 * a valid Nango integration project.
 *
 * Model interfaces and SDK types are no longer emitted — the Nango CLI
 * (v0.70.0+) auto-generates them from the config at build time.
 */
export function graphToTypeScript(_project: NangoProject, nodes: Node[], _edges: Edge[]): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const modelNodes = nodes.filter((n) => n.type === "model");
  const syncNodes = nodes.filter((n) => n.type === "sync");
  const actionNodes = nodes.filter((n) => n.type === "action");

  // Build a lookup: model label → field list
  const modelMap = new Map<string, ModelField[]>();
  for (const node of modelNodes) {
    const d = node.data as unknown as ModelNodeData;
    modelMap.set(d.label, d.fields ?? []);
  }

  // Sync handlers
  for (const node of syncNodes) {
    const d = node.data as unknown as SyncNodeData;
    const name = toFileName(d.label || node.id);
    files.push({
      path: `syncs/${name}.ts`,
      content: emitSyncHandler(d, modelMap),
    });
  }

  // Action handlers
  for (const node of actionNodes) {
    const d = node.data as unknown as ActionNodeData;
    const name = toFileName(d.label || node.id);
    files.push({
      path: `actions/${name}.ts`,
      content: emitActionHandler(d, modelMap),
    });
  }

  return files;
}

// ── Sync handler ─────────────────────────────────────────────────────────

function emitSyncHandler(
  data: SyncNodeData,
  modelMap: Map<string, ModelField[]>,
): string {
  const modelName = data.modelRef ? toTypeName(data.modelRef) : "Record";
  const hasModel = data.modelRef && modelMap.has(data.modelRef);
  const outputType = hasModel ? modelName : "Record<string, unknown>";
  const endpoint = data.endpoint || "/";

  // Import NangoSync + model type from auto-generated models (Nango CLI v0.70.0+)
  const importTypes = hasModel ? `NangoSync, ${modelName}` : "NangoSync";

  return `import type { ${importTypes} } from "../models.js";

/**
 * ${data.description || `Sync: ${data.label}`}
 *
 * Frequency: ${data.frequency || "every 1h"}
 * Endpoint:  ${(data.method || "GET").toUpperCase()} ${endpoint}
 */
export default async function fetchData(nango: NangoSync): Promise<void> {
  // Paginate through the API and save records to the Nango cache.
  for await (const batch of nango.paginate<${outputType}>({
    endpoint: "${endpoint}",
  })) {
    await nango.batchSave(batch, "${data.modelRef || "Unknown"}");
  }

  nango.log("Sync completed successfully.");
}
`;
}

// ── Action handler ───────────────────────────────────────────────────────

function emitActionHandler(
  data: ActionNodeData,
  modelMap: Map<string, ModelField[]>,
): string {
  const inputType = data.inputModelRef ? toTypeName(data.inputModelRef) : null;
  const outputType = data.outputModelRef
    ? toTypeName(data.outputModelRef)
    : null;

  // Collect all types to import from the auto-generated models (Nango CLI v0.70.0+)
  const importedTypes: string[] = ["NangoAction"];
  if (inputType && data.inputModelRef && modelMap.has(data.inputModelRef)) {
    importedTypes.push(inputType);
  }
  if (
    outputType &&
    data.outputModelRef &&
    modelMap.has(data.outputModelRef) &&
    outputType !== inputType
  ) {
    importedTypes.push(outputType);
  }

  const inputParam = inputType ? `input: ${inputType}` : "";
  const returnType = outputType ? `Promise<${outputType}>` : "Promise<void>";
  const endpoint = data.endpoint || "/";
  const method = (data.method || "POST").toLowerCase();

  return `import type { ${importedTypes.join(", ")} } from "../models.js";

/**
 * ${data.description || `Action: ${data.label}`}
 *
 * Endpoint: ${(data.method || "POST").toUpperCase()} ${endpoint}
 */
export default async function runAction(nango: NangoAction${inputParam ? `, ${inputParam}` : ""}): ${returnType} {
  const response = await nango.${method}<${outputType || "unknown"}>({
    endpoint: "${endpoint}",${inputParam ? "\n    data: input," : ""}
  });

  return response.data;
}
`;
}

// ── Single-node code generation ─────────────────────────────────────

/**
 * Generate the TypeScript handler source for a single sync or action node.
 * Returns `null` for unsupported node types.
 */
export function generateFunctionCode(
  nodeType: string,
  nodeData: SyncNodeData | ActionNodeData,
  modelNodes: Node[],
): string | null {
  const modelMap = new Map<string, ModelField[]>();
  for (const node of modelNodes) {
    const d = node.data as unknown as ModelNodeData;
    modelMap.set(d.label, d.fields ?? []);
  }

  if (nodeType === "sync") {
    return emitSyncHandler(nodeData as SyncNodeData, modelMap);
  }
  if (nodeType === "action") {
    return emitActionHandler(nodeData as ActionNodeData, modelMap);
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Convert a user-facing label to a valid TypeScript identifier (PascalCase). */
function toTypeName(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/** Convert a user-facing label to a kebab-case filename. */
export function toFileName(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}
