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
  NANGO_UPDATE_SYNC_FREQUENCY: "nango:updateSyncFrequency",

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

  // Connection health
  NANGO_GET_CONNECTION_HEALTH: "nango:getConnectionHealth",

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

  // Deploy snapshots & rollback
  DEPLOY_SAVE_SNAPSHOT: "deploy:saveSnapshot",
  DEPLOY_LIST_SNAPSHOTS: "deploy:listSnapshots",
  DEPLOY_DELETE_SNAPSHOT: "deploy:deleteSnapshot",
  DEPLOY_ROLLBACK: "deploy:rollback",

  // Project file I/O
  PROJECT_SHOW_OPEN_DIALOG: "project:showOpenDialog",
  PROJECT_SHOW_SAVE_DIALOG: "project:showSaveDialog",
  PROJECT_SHOW_DIRECTORY_DIALOG: "project:showDirectoryDialog",
  PROJECT_READ_FILE: "project:readFile",
  PROJECT_WRITE_FILE: "project:writeFile",

  // Webhook listener
  WEBHOOK_START_SERVER: "webhook:startServer",
  WEBHOOK_STOP_SERVER: "webhook:stopServer",
  WEBHOOK_GET_STATUS: "webhook:getStatus",
  WEBHOOK_GET_EVENTS: "webhook:getEvents",
  WEBHOOK_CLEAR_EVENTS: "webhook:clearEvents",
  /** Main → renderer push event: a new incoming webhook was received. */
  WEBHOOK_EVENT: "webhook:event",

  // Rate limit monitor
  RATE_LIMIT_GET_STATE: "rateLimit:getState",
  /** Main → renderer push event: a rate-limit threshold was crossed. */
  RATE_LIMIT_ALERT: "rateLimit:alert",

  // AI Integration Builder
  NANGO_AI_GENERATE: "nango:aiGenerate",
  NANGO_AI_REFINE: "nango:aiRefine",
  /** Main → renderer push event: a partial token streamed from the AI endpoint. */
  NANGO_AI_STREAM_TOKEN: "nango:aiStreamToken",

  // AI Integration Builder v2 — real provider-backed tool-calling loop
  AI_BUILDER_RUN: "ai:builderRun",
  /** Main → renderer push event: AI invoked a canvas tool (addNode, addEdge, etc.). */
  AI_BUILDER_TOOL_CALL: "ai:builderToolCall",
  /** Main → renderer push event: AI sent a text message to the user. */
  AI_BUILDER_MESSAGE: "ai:builderMessage",
  /** Save/load AI provider API keys via safeStorage. */
  AI_PROVIDER_SAVE_KEY: "ai:providerSaveKey",
  AI_PROVIDER_LOAD_KEY: "ai:providerLoadKey",
  AI_PROVIDER_CLEAR_KEY: "ai:providerClearKey",

  // MCP server management
  MCP_LIST_CONFIGS: "mcp:listConfigs",
  MCP_ADD_CONFIG: "mcp:addConfig",
  MCP_REMOVE_CONFIG: "mcp:removeConfig",
  MCP_START: "mcp:start",
  MCP_STOP: "mcp:stop",
  /** Main → renderer push event: an MCP server status changed. */
  MCP_STATUS_CHANGED: "mcp:statusChanged",

  // Nango webhook settings (outgoing webhook URL configuration)
  NANGO_GET_WEBHOOK_SETTINGS: "nango:getWebhookSettings",
  NANGO_UPDATE_WEBHOOK_SETTINGS: "nango:updateWebhookSettings",

  // Connection metadata management
  NANGO_SET_METADATA: "nango:setMetadata",

  // Re-authorization (reconnect session)
  NANGO_CREATE_RECONNECT_SESSION: "nango:createReconnectSession",
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

export type NangoEnvironment = "development" | "staging" | "production";

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
  /** When true, forces a token refresh before returning credentials. */
  forceRefresh?: boolean;
}

export interface NangoConnectionDetail {
  id: number;
  connection_id: string;
  provider_config_key: string;
  provider: string;
  credentials: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  created: string;
  updated_at?: string;
}

export interface NangoSetMetadataRequest {
  providerConfigKey: string;
  connectionId: string;
  metadata: Record<string, unknown>;
}

export interface NangoCreateReconnectSessionRequest {
  providerConfigKey: string;
  connectionId: string;
  endUserId: string;
  endUserDisplayName?: string;
  /** Advanced configuration to pass to the reconnect session. */
  integrationsConfigDefaults?: Record<string, AdvancedConnectionConfig>;
}

export interface NangoCreateReconnectSessionResult {
  token: string;
  expiresAt: string;
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

/** Advanced per-integration configuration for a connect session. */
export interface AdvancedConnectionConfig {
  /** Additional authorization parameters (e.g. tenant ID, workspace). */
  authParams?: Record<string, string>;
  /** Custom OAuth scopes to request (replaces provider defaults). */
  userScopes?: string[];
  /** Override the registered OAuth client ID for this connection. */
  oauthClientId?: string;
  /** Override the registered OAuth client secret for this connection. */
  oauthClientSecret?: string;
}

export interface NangoCreateConnectSessionRequest {
  /** Stable end-user identifier (e.g. app user ID). */
  endUserId: string;
  /** Optional display name shown in the Connect UI. */
  endUserDisplayName?: string;
  /** Restrict which integrations appear in the Connect UI. */
  allowedIntegrations?: string[];
  /**
   * Per-integration advanced configuration. Keys are provider config keys
   * (integration IDs). Values override auth params, scopes, and dev app creds.
   */
  integrationsConfigDefaults?: Record<string, AdvancedConnectionConfig>;
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
  /** Whether RBAC is enabled on the connected Nango server. */
  hasRbac: boolean;
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

export interface NangoUpdateSyncFrequencyRequest {
  providerConfigKey: string;
  syncName: string;
  connectionId: string;
  /** Frequency string (e.g. "every 5m", "every 1h") or null to reset to default. */
  frequency: string | null;
}

export interface NangoUpdateSyncFrequencyResult {
  /** The applied frequency string returned by the Nango API. */
  frequency: string;
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

// ── Deploy snapshots & rollback ────────────────────────────────────────────

/** The CLI configuration captured at deploy time — enough to re-run exactly. */
export interface DeployCliConfig {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

/** A point-in-time snapshot of a successful deploy. */
export interface DeploySnapshot {
  id: string;
  timestamp: string;
  environment: NangoEnvironment;
  cliConfig: DeployCliConfig;
  /** Optional human-readable label (e.g. branch name, version tag). */
  label?: string;
}

export interface DeploySaveSnapshotRequest {
  environment: NangoEnvironment;
  cliConfig: DeployCliConfig;
  label?: string;
}

export interface DeployListSnapshotsResult {
  snapshots: DeploySnapshot[];
}

export interface DeployDeleteSnapshotRequest {
  id: string;
}

export interface DeployRollbackRequest {
  id: string;
}

export interface DeployRollbackResult {
  /** runId to correlate CLI_OUTPUT / CLI_EXIT stream events. */
  runId: string;
}

// ── Project file I/O ──────────────────────────────────────────────────────

export interface ProjectFileDialogResult {
  /** null when the user cancels the dialog. */
  filePath: string | null;
}

export interface ProjectReadFileRequest {
  filePath: string;
}

export interface ProjectWriteFileRequest {
  filePath: string;
  data: string;
}

export interface ProjectReadFileResult {
  data: string;
}

// ── Webhook listener ──────────────────────────────────────────────────────────

export interface WebhookStartServerRequest {
  /** Local port to listen on. Defaults to 3456 if omitted. */
  port?: number;
}

export interface WebhookStartServerResult {
  port: number;
  url: string;
}

export interface WebhookServerStatus {
  running: boolean;
  port: number | null;
  url: string | null;
  eventCount: number;
}

export interface WebhookEvent {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

export interface WebhookGetEventsResult {
  events: WebhookEvent[];
}

// ── Rate limit monitor ────────────────────────────────────────────────────────

/** Per-provider rate-limit state extracted from X-RateLimit-* response headers. */
export interface RateLimitProviderState {
  /** Provider key (e.g. "github", "slack"). */
  provider: string;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Total requests allowed in the window. */
  limit: number;
  /** Unix timestamp (seconds) when the window resets. */
  reset: number;
  /** ISO timestamp of the last header observation. */
  updatedAt: string;
}

export type RateLimitAlertLevel = "warning" | "critical";

/** Emitted when a provider crosses the 75% (warning) or 90% (critical) threshold. */
export interface RateLimitAlert {
  provider: string;
  level: RateLimitAlertLevel;
  remaining: number;
  limit: number;
  reset: number;
  timestamp: string;
}

export interface RateLimitGetStateResult {
  providers: RateLimitProviderState[];
}

// ── AI Integration Builder ────────────────────────────────────────────────────

/** A single turn in the AI conversation history. */
export interface AiConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/** The structured output produced by the Nango AI generate/refine endpoint. */
export interface AiGenerationResult {
  /** Provider key the integration was generated for (e.g. "github"). */
  provider: string;
  /** Human-readable summary of what was generated. */
  description: string;
  /** Generated nango.yaml content. */
  yaml: string;
  /** Generated TypeScript sync/action code. */
  typescript: string;
}

export interface AiGenerateRequest {
  /** Provider key to generate an integration for (e.g. "github", "slack"). */
  provider: string;
  /** Free-form user prompt describing the desired integration. */
  prompt: string;
  /** Conversation history for multi-turn context. Omit for the first turn. */
  conversationHistory?: AiConversationTurn[];
}

export interface AiRefineRequest {
  /** Provider key of the integration being refined. */
  provider: string;
  /** User's follow-up instruction for the refinement. */
  prompt: string;
  /** Full conversation history up to this point (at least one prior turn). */
  conversationHistory: AiConversationTurn[];
  /** The definition produced by the previous generate/refine call. */
  currentDefinition: AiGenerationResult;
}

/** Emitted on the NANGO_AI_STREAM_TOKEN channel during streaming generation. */
export interface AiStreamTokenEvent {
  token: string;
  /** True when this is the final token and the full result follows. */
  done: boolean;
  result?: AiGenerationResult;
}

// ── MCP server management ─────────────────────────────────────────────────────

export type McpServerStatus = "stopped" | "starting" | "running" | "error";

/** A single MCP server entry from the config file. */
export interface McpServerConfig {
  /** Unique name for this server (the key in the config object). */
  name: string;
  /** Shell command to start the server (e.g. "npx", "node"). */
  command: string;
  /** Command arguments. */
  args: string[];
  /** Optional environment variables for the subprocess. */
  env?: Record<string, string>;
  /** Source config file path this entry was read from. */
  sourceFile: string;
}

/** Runtime state for a managed MCP server. */
export interface McpServerState {
  config: McpServerConfig;
  status: McpServerStatus;
  /** Process ID when running/starting, null otherwise. */
  pid: number | null;
  /** Tool names discovered from tools/list on startup. */
  tools: string[];
  /** Error message if status is "error". */
  error: string | null;
  /** ISO timestamp of the last status change. */
  updatedAt: string;
}

export interface McpListConfigsResult {
  servers: McpServerState[];
  /** Config file paths that were scanned. */
  configFiles: string[];
}

export interface McpAddConfigRequest {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  /** Which config file to write to. If omitted, uses the first discovered path. */
  targetFile?: string;
}

export interface McpRemoveConfigRequest {
  name: string;
}

export interface McpStartRequest {
  name: string;
}

export interface McpStopRequest {
  name: string;
}

export interface McpStatusChangedEvent {
  name: string;
  status: McpServerStatus;
  pid: number | null;
  error: string | null;
}

// ── Nango webhook settings ────────────────────────────────────────────────────

/** Strategy for resolving conflicts between webhook and polling data. */
export type WebhookConflictStrategy = "deep_merge" | "custom_update" | "most_recent_wins";

/** Nango outgoing webhook URL configuration and event filter settings. */
export interface NangoWebhookSettings {
  primaryUrl: string;
  secondaryUrl: string;
  onSyncCompletionAlways: boolean;
  onAuthCreation: boolean;
  onAuthRefreshError: boolean;
  onSyncError: boolean;
  onAsyncActionCompletion: boolean;
  conflictResolutionStrategy: WebhookConflictStrategy;
}

/** Partial update payload for webhook settings. */
export interface NangoUpdateWebhookSettingsRequest {
  primaryUrl?: string;
  secondaryUrl?: string;
  onSyncCompletionAlways?: boolean;
  onAuthCreation?: boolean;
  onAuthRefreshError?: boolean;
  onSyncError?: boolean;
  onAsyncActionCompletion?: boolean;
  conflictResolutionStrategy?: WebhookConflictStrategy;
}

// ── AI Integration Builder v2 (provider-backed tool-calling) ─────────────────

/** Supported external AI providers. */
export type AiProviderType = "openai" | "anthropic";

/** Request to run the AI builder conversation loop. */
export interface AiBuilderRunRequest {
  /** Which AI provider to use. */
  aiProvider: AiProviderType;
  /** User's free-form prompt describing the desired integration. */
  prompt: string;
  /** Conversation history for multi-turn context. Omit for first turn. */
  conversationHistory?: AiConversationTurn[];
  /** Current canvas state snapshot so the AI can reason about existing nodes. */
  canvasSnapshot?: AiCanvasSnapshot;
}

/** Snapshot of the current canvas state passed to the AI for context. */
export interface AiCanvasSnapshot {
  nodes: AiCanvasNode[];
  edges: AiCanvasEdge[];
  integrationMeta?: AiIntegrationMeta;
}

export interface AiCanvasNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface AiCanvasEdge {
  id: string;
  source: string;
  target: string;
  data?: Record<string, unknown>;
}

export interface AiIntegrationMeta {
  name: string;
  provider: string;
  description: string;
}

/** Result of a completed AI builder conversation loop. */
export interface AiBuilderRunResult {
  /** All tool calls the AI made during the conversation. */
  toolCalls: AiBuilderToolCallEvent[];
  /** Final assistant message summarizing what was built. */
  summary: string;
  /** Number of conversation turns used. */
  turnsUsed: number;
}

/** A single tool call made by the AI during the conversation loop. */
export interface AiBuilderToolCallEvent {
  /** Tool function name: addNode, addEdge, setIntegrationMeta, getAvailableProviders. */
  tool: string;
  /** The arguments the AI passed to the tool. */
  args: Record<string, unknown>;
  /** The result returned to the AI. */
  result: unknown;
}

/** Streamed text message from the AI during the conversation loop. */
export interface AiBuilderMessageEvent {
  /** Partial or complete message text. */
  text: string;
  /** True when this is the final message. */
  done: boolean;
}

/** Request to save an AI provider API key. */
export interface AiProviderSaveKeyRequest {
  provider: AiProviderType;
  apiKey: string;
}

/** Request to load an AI provider API key (returns masked version for display). */
export interface AiProviderLoadKeyRequest {
  provider: AiProviderType;
}

/** Result of loading an AI provider key. */
export interface AiProviderLoadKeyResult {
  /** Whether a key is stored for this provider. */
  exists: boolean;
  /** Masked key for display (e.g. "••••••••ab12"), null if not stored. */
  maskedKey: string | null;
}

/** Request to clear an AI provider API key. */
export interface AiProviderClearKeyRequest {
  provider: AiProviderType;
}

// ── Connection Health ─────────────────────────────────────────────────────

export type ConnectionStatus = "active" | "syncing" | "broken" | "expired";

export interface NangoGetConnectionHealthRequest {
  providerConfigKey: string;
  connectionId: string;
}

export interface NangoConnectionHealthData {
  status: ConnectionStatus;
  /** 0–100 health score based on sync success rate, last seen, error frequency, token age. */
  healthScore: number;
  /** ISO timestamp of the most recent activity (sync finish or connection update). */
  lastSeen: string | null;
  /** Number of total syncs for this connection. */
  syncCount: number;
  /** Number of syncs currently in error state. */
  errorCount: number;
}
