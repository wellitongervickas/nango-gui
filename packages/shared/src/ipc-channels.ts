// IPC channel names shared between main process and renderer.
// All cross-process communication must use these constants.

export const IPC_CHANNELS = {
  // Nango SDK operations
  NANGO_LIST_CONNECTIONS: "nango:listConnections",
  NANGO_GET_CONNECTION: "nango:getConnection",
  NANGO_DELETE_CONNECTION: "nango:deleteConnection",
  NANGO_VALIDATE_KEY: "nango:validateKey",
  NANGO_CREATE_CONNECT_SESSION: "nango:createConnectSession",
  NANGO_LIST_PROVIDERS: "nango:listProviders",
  NANGO_GET_PROVIDER: "nango:getProvider",

  // Sync operations
  NANGO_LIST_SYNCS: "nango:listSyncs",
  NANGO_GET_SYNC_STATUS: "nango:getSyncStatus",
  NANGO_TRIGGER_SYNC: "nango:triggerSync",
  NANGO_PAUSE_SYNC: "nango:pauseSync",
  NANGO_START_SYNC: "nango:startSync",

  // Credential storage
  CREDENTIALS_SAVE: "credentials:save",
  CREDENTIALS_EXISTS: "credentials:exists",
  CREDENTIALS_CLEAR: "credentials:clear",
  CREDENTIALS_VALIDATE: "credentials:validate",

  // App environment
  APP_GET_ENVIRONMENT: "app:getEnvironment",
  APP_SET_ENVIRONMENT: "app:setEnvironment",

  // Records
  NANGO_LIST_RECORDS: "nango:listRecords",

  // Dashboard
  NANGO_GET_DASHBOARD: "nango:getDashboard",

  // Actions & Proxy
  NANGO_TRIGGER_ACTION: "nango:triggerAction",
  NANGO_PROXY_REQUEST: "nango:proxyRequest",

  // App settings (env + theme + version info)
  APP_GET_SETTINGS: "app:getSettings",
  APP_UPDATE_SETTINGS: "app:updateSettings",

  // Auto-updater
  APP_UPDATE_DOWNLOAD: "app:updateDownload",
  APP_UPDATE_INSTALL: "app:updateInstall",

  // CLI subprocess
  CLI_RUN: "cli:run",
  CLI_ABORT: "cli:abort",
  /** Main → renderer push event: a line of stdout/stderr from a running CLI process. */
  CLI_OUTPUT: "cli:output",
  /** Main → renderer push event: the CLI process has exited. */
  CLI_EXIT: "cli:exit",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// Categorized error codes returned from IPC handlers.
// Renderer logic can branch on these to show targeted UX (re-auth prompt,
// cooldown message, offline banner, etc.).
export type IpcErrorCode =
  | "AUTH_INVALID"      // 401/403 — key expired or revoked
  | "RATE_LIMITED"      // 429 — API rate limit hit
  | "SERVER_ERROR"      // 5xx — Nango server error
  | "NETWORK_ERROR"     // fetch/DNS/timeout failure
  | "CLIENT_NOT_READY"  // Nango SDK not yet initialized
  | "UNKNOWN";          // catch-all

// Standard response envelope — all IPC handlers return this shape.
// Errors are always wrapped; never throw raw across IPC.
export type IpcResponse<T> =
  | { status: "ok"; data: T; error: null }
  | { status: "error"; data: null; error: string; errorCode: IpcErrorCode };

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

export interface NangoDeleteConnectionRequest {
  providerConfigKey: string;
  connectionId: string;
}

export interface NangoListProvidersRequest {
  search?: string;
}

export interface NangoProvider {
  /** Unique provider key (e.g. "github", "slack"). */
  name: string;
  display_name: string;
  logo_url: string;
  auth_mode: string;
  categories?: string[];
  docs?: string;
}

export interface NangoGetProviderRequest {
  provider: string;
}

export type AppTheme = "light" | "dark" | "system";

export interface AppSettings {
  environment: NangoEnvironment;
  theme: AppTheme;
  /** Last 4 chars of the stored key, prefixed with bullets. Null if no key stored. */
  maskedKey: string | null;
  appVersion: string;
  electronVersion: string;
  nangoSdkVersion: string;
}

export interface AppUpdateSettingsRequest {
  environment?: NangoEnvironment;
  theme?: AppTheme;
}

// ── Sync types ────────────────────────────────────────────────────────────

export type NangoSyncStatus =
  | "RUNNING"
  | "PAUSED"
  | "STOPPED"
  | "ERROR"
  | "SUCCESS";

export interface NangoSyncRecord {
  id: string;
  name: string;
  status: NangoSyncStatus;
  type: string;
  frequency: string | null;
  finishedAt: string | null;
  nextScheduledSyncAt: string | null;
  latestResult: {
    added: number;
    updated: number;
    deleted: number;
  } | null;
}

export interface NangoListSyncsRequest {
  connectionId: string;
  providerConfigKey: string;
}

export interface NangoGetSyncStatusRequest {
  providerConfigKey: string;
  syncs: string[];
  connectionId?: string;
}

export interface NangoTriggerSyncRequest {
  providerConfigKey: string;
  syncs: string[];
  connectionId?: string;
  fullResync?: boolean;
}

export interface NangoPauseSyncRequest {
  providerConfigKey: string;
  syncs: string[];
  connectionId?: string;
}

export interface NangoStartSyncRequest {
  providerConfigKey: string;
  syncs: string[];
  connectionId?: string;
}

// ── Records ─────────────────────────────────────────────────────────────────

export type NangoRecordFilterAction = "added" | "updated" | "deleted";

export interface NangoListRecordsRequest {
  providerConfigKey: string;
  connectionId: string;
  model: string;
  cursor?: string | null;
  limit?: number;
  filter?: NangoRecordFilterAction;
  modifiedAfter?: string;
}

export interface NangoRecordMetadata {
  first_seen_at: string;
  last_modified_at: string;
  last_action: string;
  deleted_at: string | null;
  cursor: string;
}

export interface NangoRecord {
  id: string | number;
  _nango_metadata: NangoRecordMetadata;
  [key: string]: unknown;
}

export interface NangoListRecordsResult {
  records: NangoRecord[];
  next_cursor: string | null;
}

// ── Actions & Proxy ──────────────────────────────────────────────────────

export interface NangoTriggerActionRequest {
  connectionId: string;
  integrationId: string;
  actionName: string;
  input: Record<string, unknown>;
}

export interface NangoTriggerActionResult {
  result: unknown;
}

export type NangoProxyMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface NangoProxyRequest {
  connectionId: string;
  integrationId: string;
  method: NangoProxyMethod;
  endpoint: string;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, string>;
}

export interface NangoProxyResult {
  status: number;
  headers: Record<string, string>;
  data: unknown;
}

// ── CLI subprocess ───────────────────────────────────────────────────────────

export interface CliRunRequest {
  /** Executable to invoke (e.g. "nango", "node"). */
  command: string;
  args: string[];
  /** Working directory for the subprocess. */
  cwd?: string;
  /** Extra environment variables to inject on top of the main process env. */
  env?: Record<string, string>;
}

export interface CliRunResult {
  /** Unique ID for this run — correlates CLI_OUTPUT / CLI_EXIT events and CLI_ABORT. */
  runId: string;
}

export interface CliAbortRequest {
  runId: string;
}

export interface CliOutputEvent {
  runId: string;
  stream: "stdout" | "stderr";
  line: string;
}

export interface CliExitEvent {
  runId: string;
  code: number | null;
  signal: string | null;
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface NangoDashboardRecentError {
  syncName: string;
  connectionId: string;
  providerConfigKey: string;
  timestamp: string | null;
}

export interface NangoDashboardTopConnection {
  id: number;
  connectionId: string;
  provider: string;
  providerConfigKey: string;
  syncCount: number;
  lastActivity: string | null;
}

export interface NangoDashboardData {
  totalConnections: number;
  activeConnections: number;
  totalSyncs: number;
  runningSyncs: number;
  pausedSyncs: number;
  errorSyncs: number;
  recentErrors: NangoDashboardRecentError[];
  topConnections: NangoDashboardTopConnection[];
}
