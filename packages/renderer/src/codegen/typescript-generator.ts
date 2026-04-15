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
 * Walk the visual graph and emit a set of TypeScript files that form a valid
 * Nango integration project.
 */
export function graphToTypeScript(
  _project: NangoProject,
  nodes: Node[],
  _edges: Edge[],
): GeneratedFile[] {
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

  // 1. Nango SDK type stubs
  files.push({
    path: "nango-sdk.d.ts",
    content: emitSdkStubs(),
  });

  // 2. Model interfaces
  if (modelNodes.length > 0) {
    files.push({
      path: "models.ts",
      content: emitModels(modelNodes),
    });
  }

  // 3. Sync handlers
  for (const node of syncNodes) {
    const d = node.data as unknown as SyncNodeData;
    const name = toFileName(d.label || node.id);
    files.push({
      path: `syncs/${name}.ts`,
      content: emitSyncHandler(d, modelMap),
    });
  }

  // 4. Action handlers
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

// ── Nango SDK type stubs ─────────────────────────────────────────────────

function emitSdkStubs(): string {
  return `/**
 * Nango SDK type stubs for generated integration code.
 * These provide type-safe access to the Nango runtime context.
 */

export interface NangoSync {
  /** Make an authenticated GET request through the Nango proxy. */
  get<T = unknown>(config: ProxyConfig): Promise<ProxyResponse<T>>;
  /** Make an authenticated POST request through the Nango proxy. */
  post<T = unknown>(config: ProxyConfig): Promise<ProxyResponse<T>>;
  /** Make an authenticated PUT request through the Nango proxy. */
  put<T = unknown>(config: ProxyConfig): Promise<ProxyResponse<T>>;
  /** Make an authenticated PATCH request through the Nango proxy. */
  patch<T = unknown>(config: ProxyConfig): Promise<ProxyResponse<T>>;
  /** Make an authenticated DELETE request through the Nango proxy. */
  delete<T = unknown>(config: ProxyConfig): Promise<ProxyResponse<T>>;
  /** Paginate through an API endpoint. Returns an async iterator. */
  paginate<T = unknown>(config: ProxyConfig): AsyncIterable<T[]>;
  /** Persist records to the Nango cache. Each record must have an \`id\` field. */
  batchSave<T extends { id: string | number }>(records: T[], model: string): Promise<void>;
  /** Soft-delete records from the Nango cache. */
  batchDelete<T extends { id: string | number }>(records: T[], model: string): Promise<void>;
  /** Log a message to the Nango execution log. */
  log(message: string, options?: { level?: "debug" | "info" | "warn" | "error" }): void;
  /** Get the current connection metadata. */
  getMetadata<T = Record<string, unknown>>(): Promise<T>;
  /** Retrieve a previously saved checkpoint (incremental sync state). */
  getCheckpoint<T = unknown>(): Promise<T | null>;
  /** Save a checkpoint for resumable incremental syncs. */
  saveCheckpoint(data: unknown): Promise<void>;
}

export interface NangoAction {
  /** Make an authenticated GET request through the Nango proxy. */
  get<T = unknown>(config: ProxyConfig): Promise<ProxyResponse<T>>;
  /** Make an authenticated POST request through the Nango proxy. */
  post<T = unknown>(config: ProxyConfig): Promise<ProxyResponse<T>>;
  /** Make an authenticated PUT request through the Nango proxy. */
  put<T = unknown>(config: ProxyConfig): Promise<ProxyResponse<T>>;
  /** Make an authenticated PATCH request through the Nango proxy. */
  patch<T = unknown>(config: ProxyConfig): Promise<ProxyResponse<T>>;
  /** Make an authenticated DELETE request through the Nango proxy. */
  delete<T = unknown>(config: ProxyConfig): Promise<ProxyResponse<T>>;
  /** Log a message to the Nango execution log. */
  log(message: string, options?: { level?: "debug" | "info" | "warn" | "error" }): void;
  /** Get the current connection metadata. */
  getMetadata<T = Record<string, unknown>>(): Promise<T>;
}

export interface ProxyConfig {
  endpoint: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  data?: unknown;
  retries?: number;
  retryOn?: number[];
}

export interface ProxyResponse<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export class ActionError extends Error {
  payload: Record<string, unknown>;
  constructor(payload: Record<string, unknown>) {
    super(JSON.stringify(payload));
    this.payload = payload;
  }
}
`;
}

// ── Model interfaces ─────────────────────────────────────────────────────

function emitModels(modelNodes: Node[]): string {
  const sections: string[] = [];

  for (const node of modelNodes) {
    const d = node.data as unknown as ModelNodeData;
    const name = toTypeName(d.label);
    const fields = d.fields ?? [];
    sections.push(emitInterface(name, fields));
  }

  return `/**\n * Auto-generated model interfaces from Nango Builder.\n */\n\n${sections.join("\n\n")}\n`;
}

function emitInterface(name: string, fields: ModelField[]): string {
  if (fields.length === 0) {
    return `export interface ${name} {\n  id: string;\n}`;
  }

  const lines = fields.map((f) => {
    const tsType = mapFieldType(f.type);
    const opt = f.optional ? "?" : "";
    return `  ${f.name}${opt}: ${tsType};`;
  });

  // Ensure id field exists (Nango requires it for batchSave)
  const hasId = fields.some((f) => f.name === "id");
  if (!hasId) {
    lines.unshift("  id: string;");
  }

  return `export interface ${name} {\n${lines.join("\n")}\n}`;
}

function mapFieldType(flowType: string): string {
  switch (flowType) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "Date":
      return "string";
    case "string[]":
      return "string[]";
    case "number[]":
      return "number[]";
    case "object":
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
}

// ── Sync handler ─────────────────────────────────────────────────────────

function emitSyncHandler(
  data: SyncNodeData,
  modelMap: Map<string, ModelField[]>,
): string {
  const modelName = data.modelRef ? toTypeName(data.modelRef) : "Record";
  const hasModel = data.modelRef && modelMap.has(data.modelRef);
  const modelImport = hasModel
    ? `import type { ${modelName} } from "../models";\n`
    : "";
  const outputType = hasModel ? modelName : "Record<string, unknown>";
  const endpoint = data.endpoint || "/";

  return `${modelImport}import type { NangoSync } from "../nango-sdk";

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
  const imports: string[] = [];
  const inputType = data.inputModelRef ? toTypeName(data.inputModelRef) : null;
  const outputType = data.outputModelRef
    ? toTypeName(data.outputModelRef)
    : null;

  const modelImports: string[] = [];
  if (inputType && data.inputModelRef && modelMap.has(data.inputModelRef)) {
    modelImports.push(inputType);
  }
  if (
    outputType &&
    data.outputModelRef &&
    modelMap.has(data.outputModelRef) &&
    outputType !== inputType
  ) {
    modelImports.push(outputType);
  }
  if (modelImports.length > 0) {
    imports.push(
      `import type { ${modelImports.join(", ")} } from "../models";`,
    );
  }
  imports.push('import type { NangoAction } from "../nango-sdk";');

  const inputParam = inputType ? `input: ${inputType}` : "";
  const returnType = outputType ? `Promise<${outputType}>` : "Promise<void>";
  const endpoint = data.endpoint || "/";
  const method = (data.method || "POST").toLowerCase();

  return `${imports.join("\n")}

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
function toFileName(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}
