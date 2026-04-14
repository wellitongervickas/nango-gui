// IPC channel names shared between main process and renderer.
// All cross-process communication must use these constants.

export const IPC_CHANNELS = {
  // Nango SDK operations
  NANGO_LIST_CONNECTIONS: "nango:listConnections",
  NANGO_GET_CONNECTION: "nango:getConnection",
  NANGO_VALIDATE_KEY: "nango:validateKey",
  NANGO_CREATE_CONNECT_SESSION: "nango:createConnectSession",

  // Credential storage
  CREDENTIALS_SAVE: "credentials:save",
  CREDENTIALS_EXISTS: "credentials:exists",
  CREDENTIALS_CLEAR: "credentials:clear",
  CREDENTIALS_VALIDATE: "credentials:validate",

  // App environment
  APP_GET_ENVIRONMENT: "app:getEnvironment",
  APP_SET_ENVIRONMENT: "app:setEnvironment",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// Standard response envelope — all IPC handlers return this shape.
// Errors are always wrapped; never throw raw across IPC.
export type IpcResponse<T> =
  | { status: "ok"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export type NangoEnvironment = "development" | "production";

// Per-channel request/response types

export interface NangoListConnectionsRequest {
  /** Filter by integration ID (formerly providerConfigKey). */
  integrationId?: string;
}

export interface NangoConnectionSummary {
  id: number;
  connection_id: string;
  provider: string;
  provider_config_key: string;
  created: string;
  metadata: Record<string, unknown> | null;
}

export interface NangoGetConnectionRequest {
  /** The integration ID (formerly providerConfigKey). */
  providerConfigKey: string;
  connectionId: string;
}

export interface NangoConnectionDetail {
  id: number;
  connection_id: string;
  provider_config_key: string;
  provider: string;
  credentials: Record<string, unknown>;
  created: string;
  updated_at?: string;
}

export interface NangoValidateKeyRequest {
  secretKey: string;
  environment?: NangoEnvironment;
}

export interface NangoValidateKeyResult {
  valid: boolean;
}

export interface CredentialsSaveRequest {
  secretKey: string;
  environment: NangoEnvironment;
}

export interface CredentialsExistsResult {
  exists: boolean;
}

export interface AppGetEnvironmentResult {
  environment: NangoEnvironment;
}

export interface AppSetEnvironmentRequest {
  environment: NangoEnvironment;
}

export interface NangoCreateConnectSessionRequest {
  /** Stable end-user identifier (e.g. app user ID). */
  endUserId: string;
  /** Optional display name shown in the Connect UI. */
  endUserDisplayName?: string;
  /** Restrict which integrations appear in the Connect UI. */
  allowedIntegrations?: string[];
}

export interface NangoCreateConnectSessionResult {
  /** Short-lived token to pass to @nangohq/frontend's openConnectUI. */
  token: string;
  expiresAt: string;
}
