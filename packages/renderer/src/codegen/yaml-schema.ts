/**
 * Types representing the Nango YAML configuration format.
 * See https://docs.nango.dev/reference/integration-configuration
 */

export interface NangoYamlSync {
  description?: string;
  endpoint: string;
  method?: string;
  frequency: string;
  output: string;
  track_deletes?: boolean;
  auto_start?: boolean;
}

export interface NangoYamlAction {
  description?: string;
  endpoint: string;
  method?: string;
  input?: string;
  output: string;
}

export interface NangoYamlWebhook {
  description?: string;
  endpoint: string;
  method?: string;
  output: string;
}

export interface NangoYamlModelField {
  name: string;
  type: string;
  optional?: boolean;
}

export type NangoYamlModel = NangoYamlModelField[];

export interface NangoYamlIntegration {
  syncs?: Record<string, NangoYamlSync>;
  actions?: Record<string, NangoYamlAction>;
  webhooks?: Record<string, NangoYamlWebhook>;
}

export interface NangoYaml {
  integrations: Record<string, NangoYamlIntegration>;
  models: Record<string, NangoYamlModel>;
}
