export type NangoNodeType = "sync" | "action" | "model" | "trigger" | "webhook" | "transform";

export interface SyncNodeData {
  label: string;
  description: string;
  frequency: string;
  endpoint: string;
  method: string;
  modelRef: string;
}

export interface ActionNodeData {
  label: string;
  description: string;
  endpoint: string;
  method: string;
  inputModelRef: string;
  outputModelRef: string;
}

export interface ModelField {
  name: string;
  type: string;
  optional: boolean;
}

export interface ModelNodeData {
  label: string;
  fields: ModelField[];
}

export interface TriggerNodeData {
  label: string;
  description: string;
  frequency: string;
  modelRef: string;
}

export interface WebhookNodeData {
  label: string;
  description: string;
  endpoint: string;
  method: string;
  modelRef: string;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform: "direct" | "rename" | "cast" | "template";
}

export interface TransformNodeData {
  label: string;
  description: string;
  inputModelRef: string;
  outputModelRef: string;
  mappings: FieldMapping[];
}

export interface FieldMappingEdgeData {
  mappings: FieldMapping[];
  expanded: boolean;
}

export type NangoAuthType = "oauth2" | "api_key" | "basic" | "none";
export type NangoEnvironment = "development" | "production";

export interface NangoErrorHandling {
  retryOn: ("4xx" | "5xx" | "timeout" | "network")[];
  maxRetries: number;
}

export interface NangoProject {
  name: string;
  provider: string;
  authType: NangoAuthType;
  environment: NangoEnvironment;
  errorHandling: NangoErrorHandling;
  filePath: string | null;
  lastSaved: string | null;
}
