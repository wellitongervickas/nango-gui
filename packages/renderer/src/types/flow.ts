export type NangoNodeType = "sync" | "action" | "model" | "trigger" | "webhook";

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

export interface NangoProject {
  name: string;
  provider: string;
  filePath: string | null;
  lastSaved: string | null;
}
