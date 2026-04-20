import { ipcMain, app, dialog, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnCli, type CliRunner } from "./cli-runner.js";
import log from "./logger.js";
import {
  IPC_CHANNELS,
  type IpcResponse,
  type IpcErrorCode,
  type NangoListConnectionsRequest,
  type NangoGetConnectionRequest,
  type NangoDeleteConnectionRequest,
  type NangoValidateKeyRequest,
  type NangoConnectionSummary,
  type NangoConnectionDetail,
  type NangoValidateKeyResult,
  type NangoCreateConnectSessionRequest,
  type NangoCreateConnectSessionResult,
  type NangoListProvidersRequest,
  type NangoProvider,
  type NangoGetProviderRequest,
  type NangoGetIntegrationReadmeRequest,
  type NangoGetIntegrationReadmeResult,
  type NangoGetProviderModelsRequest,
  type NangoGetProviderModelsResult,
  type NangoListSyncsRequest,
  type NangoGetSyncStatusRequest,
  type NangoTriggerSyncRequest,
  type NangoPauseSyncRequest,
  type NangoStartSyncRequest,
  type NangoUpdateSyncFrequencyRequest,
  type NangoUpdateSyncFrequencyResult,
  type NangoSyncRecord,
  type NangoCheckpoint,
  type NangoListRecordsRequest,
  type NangoListRecordsResult,
  type NangoDashboardData,
  type NangoDashboardRecentError,
  type NangoDashboardTopConnection,
  type NangoTriggerActionRequest,
  type NangoTriggerActionResult,
  type NangoTriggerActionAsyncRequest,
  type NangoTriggerActionAsyncResult,
  type NangoGetAsyncActionResultRequest,
  type NangoGetAsyncActionResultResult,
  type NangoProxyRequest,
  type NangoProxyResult,
  type CredentialsSaveRequest,
  type CredentialsExistsResult,
  type AppGetEnvironmentResult,
  type AppSetEnvironmentRequest,
  type AppSettings,
  type AppUpdateSettingsRequest,
  type CliRunRequest,
  type CliRunResult,
  type CliAbortRequest,
  type DeploySnapshot,
  type DeploySaveSnapshotRequest,
  type DeployListSnapshotsResult,
  type DeployDeleteSnapshotRequest,
  type DeployRollbackRequest,
  type DeployRollbackResult,
  type ProjectFileDialogResult,
  type ProjectReadFileRequest,
  type ProjectReadFileResult,
  type ProjectWriteFileRequest,
  type WebhookStartServerRequest,
  type WebhookStartServerResult,
  type WebhookServerStatus,
  type WebhookGetEventsResult,
  type RateLimitGetStateResult,
  type AiGenerateRequest,
  type AiRefineRequest,
  type AiGenerationResult,
  type AiBuilderRunRequest,
  type AiBuilderRunResult,
  type AiProviderSaveKeyRequest,
  type AiProviderLoadKeyRequest,
  type AiProviderLoadKeyResult,
  type AiProviderClearKeyRequest,
  type McpListConfigsResult,
  type McpAddConfigRequest,
  type McpRemoveConfigRequest,
  type McpStartRequest,
  type McpStopRequest,
  type NangoGetMcpToolsRequest,
  type NangoGetMcpToolsResult,
  type NangoSetMcpToolEnabledRequest,
  type NangoCreateJwtConnectionRequest,
  type NangoCreateJwtConnectionResult,
  type NangoCreateMcpConnectionRequest,
  type NangoCreateMcpConnectionResult,
  type NangoValidateConnectionRequest,
  type NangoValidateConnectionResult,
  type ConnectionHealthStatus,
  type NangoListMcpIntegrationsResult,
} from "@nango-gui/shared";
import { webhookServer } from "./webhook-server.js";
import { deploySnapshotStore } from "./deploy-snapshot-store.js";
import { rateLimitTracker } from "./rate-limit-tracker.js";
import { aiService } from "./ai-service.js";
import { runAiBuilder } from "./ai-builder-service.js";
import { mcpManager } from "./mcp-manager.js";
import {
  getNangoClient,
  initNangoClient,
  resetNangoClient,
  validateNangoKey,
} from "./nango-client.js";
import { credentialStore } from "./credential-store.js";

/** Classify an error into an IpcErrorCode for the renderer to act on. */
function classifyError(err: unknown): { code: IpcErrorCode; message: string } {
  if (err instanceof Error && err.message === "Nango client not initialized. Call initNangoClient() first.") {
    return { code: "CLIENT_NOT_READY", message: "Nango client not initialized. Please configure your API key in Settings." };
  }

  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403) {
    return { code: "AUTH_INVALID", message: "Your Nango API key is invalid or expired. Please update it in Settings." };
  }
  if (status === 429) {
    return { code: "RATE_LIMITED", message: "Nango API rate limit reached. Please wait a moment and try again." };
  }
  if (status && status >= 500) {
    return { code: "SERVER_ERROR", message: "The Nango server returned an error. Please try again later." };
  }

  // Network-level failures (fetch errors, DNS, timeouts)
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("fetch failed") ||
      msg.includes("econnrefused") ||
      msg.includes("enotfound") ||
      msg.includes("etimedout") ||
      msg.includes("network") ||
      msg.includes("abort")
    ) {
      return { code: "NETWORK_ERROR", message: "Unable to reach the Nango API. Check your internet connection." };
    }
  }

  const message = err instanceof Error ? err.message : "Unknown error occurred";
  return { code: "UNKNOWN", message };
}

/** Wrap a handler body in the standard IpcResponse envelope. */
async function wrap<T>(fn: () => Promise<T>): Promise<IpcResponse<T>> {
  try {
    const data = await fn();
    return { status: "ok", data, error: null };
  } catch (err: unknown) {
    const { code, message } = classifyError(err);
    log.error(`[IPC] ${code}: ${message}`, err instanceof Error ? err.stack : "");
    return { status: "error", data: null, error: message, errorCode: code };
  }
}

const VALID_SYNC_STATUSES = new Set([
  "RUNNING",
  "PAUSED",
  "STOPPED",
  "ERROR",
  "SUCCESS",
]);

/** Extract a validated NangoCheckpoint from a raw value, or null. */
function extractCheckpoint(raw: unknown): NangoCheckpoint | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const result: NangoCheckpoint = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      result[key] = val;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** Map a raw Nango sync status object to our typed record with field validation. */
function mapSyncRecord(raw: unknown): NangoSyncRecord {
  if (raw == null || typeof raw !== "object") {
    throw new Error("Invalid sync record: expected an object");
  }
  const s = raw as Record<string, unknown>;

  if (!s.id && !s.name) {
    throw new Error("Invalid sync record: missing both id and name");
  }

  const rawStatus = typeof s.status === "string" ? s.status : "STOPPED";
  const status = VALID_SYNC_STATUSES.has(rawStatus)
    ? (rawStatus as NangoSyncRecord["status"])
    : "STOPPED";

  const result =
    s.latestResult != null && typeof s.latestResult === "object"
      ? (s.latestResult as Record<string, unknown>)
      : null;

  return {
    id: String(s.id ?? ""),
    name: String(s.name ?? ""),
    status,
    type: typeof s.type === "string" ? s.type : "INCREMENTAL",
    frequency:
      s.frequency != null && typeof s.frequency === "string"
        ? s.frequency
        : null,
    finishedAt:
      s.finishedAt != null && typeof s.finishedAt === "string"
        ? s.finishedAt
        : null,
    nextScheduledSyncAt:
      s.nextScheduledSyncAt != null &&
      typeof s.nextScheduledSyncAt === "string"
        ? s.nextScheduledSyncAt
        : null,
    latestResult: result
      ? {
          added: typeof result.added === "number" ? result.added : 0,
          updated: typeof result.updated === "number" ? result.updated : 0,
          deleted: typeof result.deleted === "number" ? result.deleted : 0,
        }
      : null,
    checkpoint: extractCheckpoint(s.checkpoint),
  };
}

function toConnectionSummary(raw: unknown): NangoConnectionSummary {
  const conn = raw as Record<string, unknown>;
  return {
    id: Number(conn.id ?? 0),
    connection_id: String(conn.connection_id ?? ""),
    provider: String(conn.provider ?? ""),
    provider_config_key: String(conn.provider_config_key ?? ""),
    created: String(conn.created ?? ""),
    metadata: (conn.metadata as Record<string, unknown> | null) ?? null,
  };
}

function toConnectionDetail(raw: unknown): NangoConnectionDetail {
  const conn = raw as Record<string, unknown>;
  return {
    id: Number(conn.id ?? 0),
    connection_id: String(conn.connection_id ?? ""),
    provider_config_key: String(conn.provider_config_key ?? ""),
    provider: String(conn.provider ?? ""),
    credentials: (conn.credentials as Record<string, unknown>) ?? {},
    created: String(conn.created ?? ""),
    ...(conn.updated_at != null ? { updated_at: String(conn.updated_at) } : {}),
  };
}

// ── Dashboard aggregation helpers ──────────────────────────────────────────

type ConnectionRow = {
  id: number;
  connection_id: string;
  provider: string;
  provider_config_key: string;
  created: string;
};

type SyncCounts = Map<string, { syncCount: number; lastActivity: string | null }>;

interface SyncStatsResult {
  stats: {
    totalConnections: number;
    activeConnections: number;
    totalSyncs: number;
    runningSyncs: number;
    pausedSyncs: number;
    errorSyncs: number;
  };
  errors: NangoDashboardRecentError[];
  syncCounts: SyncCounts;
}

/**
 * Derive a timestamp string from checkpoint data for activity tracking.
 * Looks for common timestamp keys (last_synced_at, updated_at, timestamp, etc.)
 * and returns the latest one found. Falls back to null.
 */
function deriveTimestampFromCheckpoint(checkpoint: unknown): string | null {
  if (checkpoint == null || typeof checkpoint !== "object" || Array.isArray(checkpoint)) return null;
  const cp = checkpoint as Record<string, unknown>;
  const timestampKeys = ["last_synced_at", "updated_at", "timestamp", "synced_at", "completed_at"];
  let latest: string | null = null;
  for (const key of timestampKeys) {
    const val = cp[key];
    if (typeof val === "string" && val.length > 0) {
      if (!latest || val > latest) latest = val;
    }
  }
  return latest;
}

async function aggregateSyncStats(
  client: ReturnType<typeof getNangoClient>,
  connections: ConnectionRow[],
): Promise<SyncStatsResult> {
  let totalSyncs = 0;
  let runningSyncs = 0;
  let pausedSyncs = 0;
  let errorSyncs = 0;
  const errors: NangoDashboardRecentError[] = [];
  const syncCounts: SyncCounts = new Map();
  const activeConnectionIds = new Set<string>();

  for (const conn of connections) {
    const key = `${conn.provider_config_key}:${conn.connection_id}`;
    try {
      const result = await client.syncStatus(conn.provider_config_key, [], conn.connection_id);
      const syncs = ((result as { syncs?: unknown[] }).syncs ?? []) as Array<{
        name?: string;
        status?: string;
        finishedAt?: string;
        checkpoint?: Record<string, unknown> | null;
      }>;

      let connLastActivity: string | null = null;
      for (const s of syncs) {
        totalSyncs++;
        const status = String(s.status ?? "STOPPED");
        if (status === "RUNNING" || status === "SUCCESS") {
          activeConnectionIds.add(key);
          if (status === "RUNNING") runningSyncs++;
        }
        if (status === "PAUSED") pausedSyncs++;
        if (status === "ERROR") {
          errorSyncs++;
          errors.push({
            syncName: String(s.name ?? "unknown"),
            connectionId: conn.connection_id,
            providerConfigKey: conn.provider_config_key,
            timestamp: s.finishedAt ?? null,
          });
        }
        // Prefer checkpoint timestamp, fall back to finishedAt
        const checkpointTs = deriveTimestampFromCheckpoint(s.checkpoint);
        const activityTs = checkpointTs ?? s.finishedAt ?? null;
        if (activityTs && (!connLastActivity || activityTs > connLastActivity)) {
          connLastActivity = activityTs;
        }
      }
      syncCounts.set(key, { syncCount: syncs.length, lastActivity: connLastActivity });
    } catch {
      syncCounts.set(key, { syncCount: 0, lastActivity: null });
    }
  }

  return {
    stats: {
      totalConnections: connections.length,
      activeConnections: activeConnectionIds.size,
      totalSyncs,
      runningSyncs,
      pausedSyncs,
      errorSyncs,
    },
    errors,
    syncCounts,
  };
}

function rankRecentErrors(errors: NangoDashboardRecentError[], limit = 5): NangoDashboardRecentError[] {
  return [...errors]
    .sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return b.timestamp.localeCompare(a.timestamp);
    })
    .slice(0, limit);
}

function rankTopConnections(
  connections: ConnectionRow[],
  syncCounts: SyncCounts,
  limit = 5,
): NangoDashboardTopConnection[] {
  return connections
    .map((conn) => {
      const key = `${conn.provider_config_key}:${conn.connection_id}`;
      const stats = syncCounts.get(key) ?? { syncCount: 0, lastActivity: null };
      return {
        id: conn.id,
        connectionId: conn.connection_id,
        provider: conn.provider,
        providerConfigKey: conn.provider_config_key,
        syncCount: stats.syncCount,
        lastActivity: stats.lastActivity,
      };
    })
    .sort((a, b) => {
      if (b.syncCount !== a.syncCount) return b.syncCount - a.syncCount;
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return b.lastActivity.localeCompare(a.lastActivity);
    })
    .slice(0, limit);
}

/**
 * Register all IPC handlers. Call once from the main process after app ready.
 */
export function registerIpcHandlers(): void {
  // ── Nango SDK handlers ──────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_LIST_CONNECTIONS,
    async (
      _event: IpcMainInvokeEvent,
      args?: NangoListConnectionsRequest
    ): Promise<IpcResponse<NangoConnectionSummary[]>> =>
      wrap(async () => {
        const client = getNangoClient();
        const result = await client.listConnections({
          ...(args?.integrationId
            ? { integrationId: args.integrationId }
            : {}),
        });
        return result.connections.map(toConnectionSummary);
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_GET_CONNECTION,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoGetConnectionRequest
    ): Promise<IpcResponse<NangoConnectionDetail>> =>
      wrap(async () => {
        const client = getNangoClient();
        const result = await client.getConnection(
          args.providerConfigKey,
          args.connectionId
        );
        return toConnectionDetail(result);
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_DELETE_CONNECTION,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoDeleteConnectionRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        const client = getNangoClient();
        await client.deleteConnection(args.providerConfigKey, args.connectionId);
      })
  );

  // ── Connection credential health validation ────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_VALIDATE_CONNECTION,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoValidateConnectionRequest
    ): Promise<IpcResponse<NangoValidateConnectionResult>> =>
      wrap(async () => {
        if (!args?.providerConfigKey || !args?.connectionId) {
          throw new Error("providerConfigKey and connectionId are required");
        }
        const client = getNangoClient();
        let status: ConnectionHealthStatus = "unchecked";
        let output: string | null = null;

        try {
          const conn = await client.getConnection(
            args.providerConfigKey,
            args.connectionId
          );
          const creds = conn?.credentials as Record<string, unknown> | undefined;
          if (creds && Object.keys(creds).length > 0) {
            status = "valid";
            output = "Credentials retrieved successfully.";
          } else {
            status = "invalid";
            output = "No credentials found on this connection.";
          }
        } catch (err: unknown) {
          status = "invalid";
          const errStatus = (err as { status?: number })?.status;
          if (errStatus === 401 || errStatus === 403) {
            output = "Authentication failed: credentials are expired or revoked.";
          } else if (errStatus === 404) {
            output = "Connection not found on the Nango server.";
          } else {
            output = err instanceof Error ? err.message : "Validation failed with an unknown error.";
          }
        }

        // Truncate output to 500 chars as per spec
        if (output && output.length > 500) {
          output = output.slice(0, 497) + "...";
        }

        return {
          status,
          lastChecked: new Date().toISOString(),
          output,
        };
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_VALIDATE_KEY,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoValidateKeyRequest
    ): Promise<IpcResponse<NangoValidateKeyResult>> =>
      wrap(async () => {
        const valid = await validateNangoKey(args.secretKey);
        return { valid };
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_CREATE_CONNECT_SESSION,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoCreateConnectSessionRequest
    ): Promise<IpcResponse<NangoCreateConnectSessionResult>> =>
      wrap(async () => {
        const client = getNangoClient();
        const result = await client.createConnectSession({
          end_user: {
            id: args.endUserId,
            ...(args.endUserDisplayName
              ? { display_name: args.endUserDisplayName }
              : {}),
          },
          ...(args.allowedIntegrations
            ? { allowed_integrations: args.allowedIntegrations }
            : {}),
        });
        return {
          token: result.data.token,
          expiresAt: result.data.expires_at,
        };
      })
  );

  // ── JWT Bearer connection creation ────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_CREATE_JWT_CONNECTION,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoCreateJwtConnectionRequest
    ): Promise<IpcResponse<NangoCreateJwtConnectionResult>> =>
      wrap(async () => {
        const client = getNangoClient();
        // The Nango Node SDK deprecated createConnection; use the REST API
        // directly via the SDK's internal axios instance.
        const httpClient = (client as unknown as { http: { post: (url: string, body: unknown, config: unknown) => Promise<{ data: unknown }> } }).http;
        const res = await httpClient.post(
          "/connection",
          {
            connection_id: args.connectionId,
            provider_config_key: args.providerConfigKey,
            credentials: {
              privateKey: args.privateKey,
              username: args.username,
            },
          },
          { headers: { Authorization: `Bearer ${client.secretKey}` } }
        );
        const data = res.data as { connectionId?: string; connection_id?: string; providerConfigKey?: string; provider_config_key?: string };
        return {
          connectionId: data.connection_id ?? data.connectionId ?? args.connectionId,
          providerConfigKey: data.provider_config_key ?? data.providerConfigKey ?? args.providerConfigKey,
        };
      })
  );

  // ── MCP Auth connection creation ─────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_CREATE_MCP_CONNECTION,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoCreateMcpConnectionRequest
    ): Promise<IpcResponse<NangoCreateMcpConnectionResult>> =>
      wrap(async () => {
        const client = getNangoClient();
        const mcpHttpClient = (client as unknown as { http: { post: (url: string, body: unknown, config: unknown) => Promise<{ data: unknown }> } }).http;
        const res = await mcpHttpClient.post(
          "/connection",
          {
            connection_id: args.connectionId,
            provider_config_key: args.providerConfigKey,
            credentials: {
              token: args.token,
            },
          },
          { headers: { Authorization: `Bearer ${client.secretKey}` } }
        );
        const data = res.data as { connectionId?: string; connection_id?: string; providerConfigKey?: string; provider_config_key?: string };
        return {
          connectionId: data.connection_id ?? data.connectionId ?? args.connectionId,
          providerConfigKey: data.provider_config_key ?? data.providerConfigKey ?? args.providerConfigKey,
        };
      })
  );

  // ── Provider catalog handlers ───────────────────────────────────────────

  // TTL cache so the 700+ provider list isn't re-fetched on every render.
  let _providersCache: NangoProvider[] | null = null;
  let _providersCacheAt = 0;
  const PROVIDERS_TTL_MS = 5 * 60 * 1000; // 5 minutes

  ipcMain.handle(
    IPC_CHANNELS.NANGO_LIST_PROVIDERS,
    async (
      _event: IpcMainInvokeEvent,
      args?: NangoListProvidersRequest
    ): Promise<IpcResponse<NangoProvider[]>> =>
      wrap(async () => {
        const now = Date.now();
        // Refresh cache if stale or forced by a search term.
        if (!_providersCache || now - _providersCacheAt > PROVIDERS_TTL_MS) {
          const client = getNangoClient();
          const search = args?.search?.trim() || undefined;
          const result = await client.listProviders(search ? { search } : {});
          _providersCache = (result.data as NangoProvider[]).map((p) => ({
            name: p.name,
            display_name: p.display_name,
            logo_url: p.logo_url,
            auth_mode: p.auth_mode,
            categories: (p as { categories?: string[] }).categories,
            docs: (p as { docs?: string }).docs,
          }));
          _providersCacheAt = now;
        }
        // Client-side search filter when cache is warm.
        const search = args?.search?.toLowerCase().trim();
        if (!search) return _providersCache;
        return _providersCache.filter(
          (p) =>
            p.name.toLowerCase().includes(search) ||
            p.display_name.toLowerCase().includes(search) ||
            p.categories?.some((c) => c.toLowerCase().includes(search))
        );
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_GET_PROVIDER,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoGetProviderRequest
    ): Promise<IpcResponse<NangoProvider>> =>
      wrap(async () => {
        const client = getNangoClient();
        const result = await client.getProvider({ provider: args.provider });
        const p = result.data as NangoProvider & { categories?: string[]; docs?: string };
        return {
          name: p.name,
          display_name: p.display_name,
          logo_url: p.logo_url,
          auth_mode: p.auth_mode,
          categories: p.categories,
          docs: p.docs,
        };
      })
  );

  // ── Integration readme handler ───────────────────────────────────────────

  const _readmeCache = new Map<string, { markdown: string | null; fetchedAt: number }>();
  const README_TTL_MS = 30 * 60 * 1000; // 30 minutes

  ipcMain.handle(
    IPC_CHANNELS.NANGO_GET_INTEGRATION_README,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoGetIntegrationReadmeRequest
    ): Promise<IpcResponse<NangoGetIntegrationReadmeResult>> =>
      wrap(async () => {
        const provider = args.provider;
        const now = Date.now();
        const cached = _readmeCache.get(provider);
        if (cached && now - cached.fetchedAt < README_TTL_MS) {
          return { markdown: cached.markdown };
        }

        // Try fetching from GitHub integration-templates repo (canonical source)
        let markdown: string | null = null;
        try {
          const url = `https://raw.githubusercontent.com/NangoHQ/integration-templates/main/integrations/${encodeURIComponent(provider)}/README.md`;
          const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
          if (res.ok) {
            markdown = await res.text();
          }
        } catch {
          // Network error — leave markdown null
        }

        _readmeCache.set(provider, { markdown, fetchedAt: now });
        return { markdown };
      })
  );

  // ── Typed model download handler ─────────────────────────────────────────

  const _modelsYamlCache = new Map<string, { yaml: string | null; fetchedAt: number }>();
  const MODELS_TTL_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Parse the `models` block from a nango.yaml string.
   * Returns a map of model name → record of field name → field type.
   */
  function parseModelsFromYaml(yamlContent: string): Record<string, Record<string, string>> {
    const models: Record<string, Record<string, string>> = {};
    const lines = yamlContent.split("\n");
    let inModels = false;
    let currentModel: string | null = null;

    for (const line of lines) {
      // Detect top-level `models:` key
      if (/^models:\s*$/.test(line)) {
        inModels = true;
        continue;
      }
      if (!inModels) continue;

      // A non-indented line (other than blank) exits the models block
      if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
        break;
      }

      // Model name line: exactly 2-space or 4-space indent, ends with ':'
      const modelMatch = line.match(/^  (\w[\w-]*):\s*$/);
      if (modelMatch) {
        currentModel = modelMatch[1];
        models[currentModel] = {};
        continue;
      }

      // Field line: deeper indent under a model
      if (currentModel) {
        const fieldMatch = line.match(/^\s{4,}(\w[\w-]*):\s*(.+)$/);
        if (fieldMatch) {
          models[currentModel][fieldMatch[1]] = fieldMatch[2].trim();
        }
      }
    }

    return models;
  }

  /** Map a nango.yaml type string to a TypeScript type. */
  function nangoTypeToTs(t: string): string {
    const trimmed = t.replace(/\s/g, "");
    if (trimmed === "string" || trimmed === "boolean" || trimmed === "number") return trimmed;
    if (trimmed === "integer") return "number";
    if (trimmed === "date") return "string";
    if (trimmed.endsWith("[]")) return `${nangoTypeToTs(trimmed.slice(0, -2))}[]`;
    return "string";
  }

  function generateTypescript(models: Record<string, Record<string, string>>): string {
    const lines: string[] = ["// Auto-generated TypeScript types from Nango integration models", ""];
    for (const [name, fields] of Object.entries(models)) {
      lines.push(`export interface ${name} {`);
      for (const [field, type] of Object.entries(fields)) {
        lines.push(`  ${field}: ${nangoTypeToTs(type)};`);
      }
      lines.push("}", "");
    }
    return lines.join("\n");
  }

  function generateZod(models: Record<string, Record<string, string>>): string {
    const zodType = (t: string): string => {
      const trimmed = t.replace(/\s/g, "");
      if (trimmed === "string") return "z.string()";
      if (trimmed === "boolean") return "z.boolean()";
      if (trimmed === "number" || trimmed === "integer") return "z.number()";
      if (trimmed === "date") return "z.string().datetime()";
      if (trimmed.endsWith("[]")) return `z.array(${zodType(trimmed.slice(0, -2))})`;
      return "z.string()";
    };

    const lines: string[] = [
      '// Auto-generated Zod schemas from Nango integration models',
      'import { z } from "zod";',
      "",
    ];
    for (const [name, fields] of Object.entries(models)) {
      lines.push(`export const ${name}Schema = z.object({`);
      for (const [field, type] of Object.entries(fields)) {
        lines.push(`  ${field}: ${zodType(type)},`);
      }
      lines.push("});", "");
      lines.push(`export type ${name} = z.infer<typeof ${name}Schema>;`, "");
    }
    return lines.join("\n");
  }

  ipcMain.handle(
    IPC_CHANNELS.NANGO_GET_PROVIDER_MODELS,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoGetProviderModelsRequest
    ): Promise<IpcResponse<NangoGetProviderModelsResult>> =>
      wrap(async () => {
        const { provider, format } = args;
        const now = Date.now();

        // Fetch and cache nango.yaml for this provider
        let yamlContent: string | null = null;
        const cached = _modelsYamlCache.get(provider);
        if (cached && now - cached.fetchedAt < MODELS_TTL_MS) {
          yamlContent = cached.yaml;
        } else {
          try {
            const url = `https://raw.githubusercontent.com/NangoHQ/integration-templates/main/integrations/${encodeURIComponent(provider)}/nango.yaml`;
            const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
            if (res.ok) {
              yamlContent = await res.text();
            }
          } catch {
            // Network error — leave null
          }
          _modelsYamlCache.set(provider, { yaml: yamlContent, fetchedAt: now });
        }

        if (!yamlContent) {
          return { content: "", filename: "", hasModels: false };
        }

        const models = parseModelsFromYaml(yamlContent);
        if (Object.keys(models).length === 0) {
          return { content: "", filename: "", hasModels: false };
        }

        const base = `${provider}-models`;
        let content: string;
        let filename: string;

        switch (format) {
          case "typescript":
            content = generateTypescript(models);
            filename = `${base}.d.ts`;
            break;
          case "zod":
            content = generateZod(models);
            filename = `${base}.ts`;
            break;
          default:
            throw new Error(`Unsupported format: ${format}`);
        }

        return { content, filename, hasModels: true };
      })
  );

  // ── Sync handlers ───────────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_LIST_SYNCS,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoListSyncsRequest
    ): Promise<IpcResponse<NangoSyncRecord[]>> =>
      wrap(async () => {
        if (!args?.providerConfigKey || !args?.connectionId) {
          throw new Error("providerConfigKey and connectionId are required");
        }
        const client = getNangoClient();
        const result = await client.syncStatus(
          args.providerConfigKey,
          [],
          args.connectionId
        );
        const syncs = (result as { syncs?: unknown[] }).syncs ?? [];
        return syncs.map(mapSyncRecord);
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_GET_SYNC_STATUS,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoGetSyncStatusRequest
    ): Promise<IpcResponse<NangoSyncRecord[]>> =>
      wrap(async () => {
        if (!args?.providerConfigKey || !Array.isArray(args?.syncs)) {
          throw new Error("providerConfigKey and syncs array are required");
        }
        const client = getNangoClient();
        const result = await client.syncStatus(
          args.providerConfigKey,
          args.syncs,
          args.connectionId
        );
        const syncs = (result as { syncs?: unknown[] }).syncs ?? [];
        return syncs.map(mapSyncRecord);
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_TRIGGER_SYNC,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoTriggerSyncRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        if (!args?.providerConfigKey || !Array.isArray(args?.syncs) || args.syncs.length === 0) {
          throw new Error("providerConfigKey and at least one sync name are required");
        }
        const client = getNangoClient();
        await client.triggerSync(
          args.providerConfigKey,
          args.syncs,
          args.connectionId,
          args.fullResync
        );
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_PAUSE_SYNC,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoPauseSyncRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        if (!args?.providerConfigKey || !Array.isArray(args?.syncs) || args.syncs.length === 0) {
          throw new Error("providerConfigKey and at least one sync name are required");
        }
        const client = getNangoClient();
        await client.pauseSync(
          args.providerConfigKey,
          args.syncs,
          args.connectionId
        );
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_START_SYNC,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoStartSyncRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        if (!args?.providerConfigKey || !Array.isArray(args?.syncs) || args.syncs.length === 0) {
          throw new Error("providerConfigKey and at least one sync name are required");
        }
        const client = getNangoClient();
        await client.startSync(
          args.providerConfigKey,
          args.syncs,
          args.connectionId
        );
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_UPDATE_SYNC_FREQUENCY,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoUpdateSyncFrequencyRequest
    ): Promise<IpcResponse<NangoUpdateSyncFrequencyResult>> =>
      wrap(async () => {
        if (!args?.providerConfigKey || !args?.syncName || !args?.connectionId) {
          throw new Error("providerConfigKey, syncName, and connectionId are required");
        }
        const client = getNangoClient();
        const result = await client.updateSyncConnectionFrequency(
          args.providerConfigKey,
          args.syncName,
          args.connectionId,
          args.frequency
        );
        return { frequency: result.frequency };
      })
  );

  // ── Records handler ──────────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_LIST_RECORDS,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoListRecordsRequest
    ): Promise<IpcResponse<NangoListRecordsResult>> =>
      wrap(async () => {
        const client = getNangoClient();
        const result = await client.listRecords({
          providerConfigKey: args.providerConfigKey,
          connectionId: args.connectionId,
          model: args.model,
          ...(args.cursor ? { cursor: args.cursor } : {}),
          ...(args.limit ? { limit: args.limit } : {}),
          ...(args.filter ? { filter: args.filter } : {}),
          ...(args.modifiedAfter ? { modifiedAfter: args.modifiedAfter } : {}),
        });
        return {
          records: result.records.map((r) => ({
            ...r,
            id: r.id,
            _nango_metadata: r._nango_metadata,
          })),
          next_cursor: result.next_cursor,
        };
      })
  );

  // ── Action trigger handler ───────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_TRIGGER_ACTION,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoTriggerActionRequest
    ): Promise<IpcResponse<NangoTriggerActionResult>> =>
      wrap(async () => {
        const client = getNangoClient();
        const result = await client.triggerAction(
          args.integrationId,
          args.connectionId,
          args.actionName,
          args.input
        );
        return { result };
      })
  );

  // ── Async action trigger handler ─────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_TRIGGER_ACTION_ASYNC,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoTriggerActionAsyncRequest
    ): Promise<IpcResponse<NangoTriggerActionAsyncResult>> =>
      wrap(async () => {
        const client = getNangoClient();
        const { id, statusUrl } = await client.triggerActionAsync(
          args.integrationId,
          args.connectionId,
          args.actionName,
          args.input
        );
        return { id, statusUrl };
      })
  );

  // ── Async action result handler ─────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_GET_ASYNC_ACTION_RESULT,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoGetAsyncActionResultRequest
    ): Promise<IpcResponse<NangoGetAsyncActionResultResult>> =>
      wrap(async () => {
        const client = getNangoClient();
        try {
          const output = await client.getAsyncActionResult({ id: args.id });
          return { status: "success" as const, output };
        } catch (err: unknown) {
          const httpStatus = (err as { status?: number })?.status;
          if (httpStatus === 404) {
            return { status: "pending" as const };
          }
          if (httpStatus === 202) {
            return { status: "running" as const };
          }
          return {
            status: "failed" as const,
            error: err instanceof Error ? err.message : "Unknown async action error",
          };
        }
      })
  );

  // ── Proxy request handler ──────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_PROXY_REQUEST,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoProxyRequest
    ): Promise<IpcResponse<NangoProxyResult>> =>
      wrap(async () => {
        const client = getNangoClient();
        const response = await client.proxy({
          method: args.method,
          endpoint: args.endpoint,
          providerConfigKey: args.integrationId,
          connectionId: args.connectionId,
          ...(args.headers ? { headers: args.headers } : {}),
          ...(args.data ? { data: args.data } : {}),
          ...(args.params ? { params: args.params } : {}),
        });
        const headers: Record<string, string> = {};
        if (response.headers) {
          for (const [key, value] of Object.entries(response.headers)) {
            if (typeof value === "string") headers[key] = value;
          }
        }
        // Feed rate-limit headers to the tracker
        if (args.integrationId) {
          rateLimitTracker.observe(args.integrationId, headers);
        }

        return {
          status: response.status,
          headers,
          data: response.data,
        };
      })
  );

  // ── Dashboard handler ──────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_GET_DASHBOARD,
    async (): Promise<IpcResponse<NangoDashboardData>> =>
      wrap(async () => {
        const client = getNangoClient();

        const connResult = await client.listConnections();
        const connections =
          connResult.connections as unknown as Array<{
            id: number;
            connection_id: string;
            provider: string;
            provider_config_key: string;
            created: string;
          }>;

        const { stats, errors, syncCounts } = await aggregateSyncStats(client, connections);
        const recentErrors = rankRecentErrors(errors);
        const topConnections = rankTopConnections(connections, syncCounts);

        return { ...stats, recentErrors, topConnections };
      })
  );

  // ── Credential handlers ─────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.CREDENTIALS_SAVE,
    async (
      _event: IpcMainInvokeEvent,
      args: CredentialsSaveRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        credentialStore.save(args.secretKey, args.environment);
        credentialStore.saveEnvironment(args.environment);
        await initNangoClient(args.secretKey);
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.CREDENTIALS_EXISTS,
    async (): Promise<IpcResponse<CredentialsExistsResult>> =>
      wrap(async () => ({ exists: credentialStore.load() !== null }))
  );

  ipcMain.handle(
    IPC_CHANNELS.CREDENTIALS_CLEAR,
    async (): Promise<IpcResponse<void>> =>
      wrap(async () => {
        credentialStore.clear();
        resetNangoClient();
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.CREDENTIALS_VALIDATE,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoValidateKeyRequest
    ): Promise<IpcResponse<NangoValidateKeyResult>> =>
      wrap(async () => {
        const valid = await validateNangoKey(args.secretKey);
        return { valid };
      })
  );

  // ── App environment handlers ────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.APP_GET_ENVIRONMENT,
    async (): Promise<IpcResponse<AppGetEnvironmentResult>> =>
      wrap(async () => ({
        environment: credentialStore.loadEnvironment(),
      }))
  );

  ipcMain.handle(
    IPC_CHANNELS.APP_SET_ENVIRONMENT,
    async (
      _event: IpcMainInvokeEvent,
      args: AppSetEnvironmentRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        credentialStore.saveEnvironment(args.environment);
      })
  );

  // ── App settings (env + theme + version info) ───────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.APP_GET_SETTINGS,
    async (): Promise<IpcResponse<AppSettings>> =>
      wrap(async () => {
        const environment = credentialStore.loadEnvironment();
        return {
          environment,
          theme: credentialStore.loadTheme(),
          maskedKey: credentialStore.loadMaskedKey(environment),
          environmentKeys: credentialStore.getEnvironmentKeyStatus(),
          appVersion: app.getVersion(),
          electronVersion: process.versions.electron ?? "unknown",
          nangoSdkVersion: "0.70.1",
        };
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.APP_UPDATE_SETTINGS,
    async (
      _event: IpcMainInvokeEvent,
      args: AppUpdateSettingsRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        if (args.environment !== undefined) {
          credentialStore.saveEnvironment(args.environment);
          // Re-initialize the Nango client with the target environment's key
          const secretKey = credentialStore.load(args.environment);
          if (secretKey) {
            await initNangoClient(secretKey);
          } else {
            resetNangoClient();
          }
        }
        if (args.theme !== undefined) {
          credentialStore.saveTheme(args.theme);
        }
      })
  );

  // ── CLI subprocess handlers ─────────────────────────────────────────────
  // Keyed by runId. Cleaned up on process exit or explicit CLI_ABORT.
  const _activeCliProcesses = new Map<string, CliRunner>();

  ipcMain.handle(
    IPC_CHANNELS.CLI_RUN,
    async (
      event: IpcMainInvokeEvent,
      args: CliRunRequest
    ): Promise<IpcResponse<CliRunResult>> =>
      wrap(async () => {
        const runId = randomUUID();

        const runner = spawnCli(
          {
            command: args.command,
            args: args.args,
            cwd: args.cwd,
            env: args.env,
          },
          (lineEvent) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.CLI_OUTPUT, { runId, ...lineEvent });
            }
          },
          (exitEvent) => {
            _activeCliProcesses.delete(runId);
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.CLI_EXIT, { runId, ...exitEvent });
            }
          }
        );

        _activeCliProcesses.set(runId, runner);
        log.info(`[CLI] started run ${runId} — pid ${runner.pid} — ${args.command} ${args.args.join(" ")}`);
        return { runId };
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.CLI_ABORT,
    async (
      _event: IpcMainInvokeEvent,
      args: CliAbortRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        const runner = _activeCliProcesses.get(args.runId);
        if (runner) {
          log.info(`[CLI] aborting run ${args.runId} — pid ${runner.pid}`);
          runner.kill();
          _activeCliProcesses.delete(args.runId);
        }
      })
  );

  // ── Deploy snapshot handlers ────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.DEPLOY_SAVE_SNAPSHOT,
    async (
      _event: IpcMainInvokeEvent,
      args: DeploySaveSnapshotRequest
    ): Promise<IpcResponse<DeploySnapshot>> =>
      wrap(async () => deploySnapshotStore.save(args))
  );

  ipcMain.handle(
    IPC_CHANNELS.DEPLOY_LIST_SNAPSHOTS,
    async (): Promise<IpcResponse<DeployListSnapshotsResult>> =>
      wrap(async () => ({ snapshots: deploySnapshotStore.load() }))
  );

  ipcMain.handle(
    IPC_CHANNELS.DEPLOY_DELETE_SNAPSHOT,
    async (
      _event: IpcMainInvokeEvent,
      args: DeployDeleteSnapshotRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        deploySnapshotStore.delete(args.id);
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.DEPLOY_ROLLBACK,
    async (
      event: IpcMainInvokeEvent,
      args: DeployRollbackRequest
    ): Promise<IpcResponse<DeployRollbackResult>> =>
      wrap(async () => {
        const snapshot = deploySnapshotStore.get(args.id);
        if (!snapshot) {
          throw new Error(`Deploy snapshot not found: ${args.id}`);
        }

        const runId = randomUUID();
        const runner = spawnCli(
          snapshot.cliConfig,
          (lineEvent) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.CLI_OUTPUT, { runId, ...lineEvent });
            }
          },
          (exitEvent) => {
            _activeCliProcesses.delete(runId);
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.CLI_EXIT, { runId, ...exitEvent });
            }
          }
        );

        _activeCliProcesses.set(runId, runner);
        log.info(`[DEPLOY] rollback run ${runId} from snapshot ${snapshot.id} — pid ${runner.pid}`);
        return { runId };
      })
  );

  // ── Project file I/O handlers ──────────────────────────────────────────

  const NANGO_PROJECT_FILTER = {
    name: "Nango Project",
    extensions: ["nango-project"],
  };

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SHOW_OPEN_DIALOG,
    async (): Promise<IpcResponse<ProjectFileDialogResult>> =>
      wrap(async () => {
        const opts: Electron.OpenDialogOptions = {
          filters: [NANGO_PROJECT_FILTER],
          properties: ["openFile"],
        };
        const win = BrowserWindow.getFocusedWindow();
        const result = win
          ? await dialog.showOpenDialog(win, opts)
          : await dialog.showOpenDialog(opts);
        return { filePath: result.canceled ? null : (result.filePaths[0] ?? null) };
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SHOW_DIRECTORY_DIALOG,
    async (): Promise<IpcResponse<ProjectFileDialogResult>> =>
      wrap(async () => {
        const opts: Electron.OpenDialogOptions = {
          properties: ["openDirectory", "createDirectory"],
        };
        const win = BrowserWindow.getFocusedWindow();
        const result = win
          ? await dialog.showOpenDialog(win, opts)
          : await dialog.showOpenDialog(opts);
        return { filePath: result.canceled ? null : (result.filePaths[0] ?? null) };
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SHOW_SAVE_DIALOG,
    async (): Promise<IpcResponse<ProjectFileDialogResult>> =>
      wrap(async () => {
        const opts: Electron.SaveDialogOptions = {
          filters: [NANGO_PROJECT_FILTER],
          defaultPath: "untitled.nango-project",
        };
        const win = BrowserWindow.getFocusedWindow();
        const result = win
          ? await dialog.showSaveDialog(win, opts)
          : await dialog.showSaveDialog(opts);
        return { filePath: result.canceled ? null : (result.filePath ?? null) };
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_READ_FILE,
    async (
      _event: IpcMainInvokeEvent,
      args: ProjectReadFileRequest
    ): Promise<IpcResponse<ProjectReadFileResult>> =>
      wrap(async () => {
        const data = await readFile(args.filePath, "utf-8");
        return { data };
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_WRITE_FILE,
    async (
      _event: IpcMainInvokeEvent,
      args: ProjectWriteFileRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        await writeFile(args.filePath, args.data, "utf-8");
      })
  );

  // ── Webhook listener handlers ───────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.WEBHOOK_START_SERVER,
    async (
      _event: IpcMainInvokeEvent,
      args?: WebhookStartServerRequest
    ): Promise<IpcResponse<WebhookStartServerResult>> =>
      wrap(async () => {
        const result = await webhookServer.start(args?.port);
        log.info(`[IPC] Webhook server started on port ${result.port}`);
        return result;
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.WEBHOOK_STOP_SERVER,
    async (): Promise<IpcResponse<void>> =>
      wrap(async () => {
        await webhookServer.stop();
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.WEBHOOK_GET_STATUS,
    async (): Promise<IpcResponse<WebhookServerStatus>> =>
      wrap(async () => ({
        running: webhookServer.isRunning,
        port: webhookServer.currentPort,
        url: webhookServer.currentPort
          ? `http://127.0.0.1:${webhookServer.currentPort}`
          : null,
        eventCount: webhookServer.eventCount,
      }))
  );

  ipcMain.handle(
    IPC_CHANNELS.WEBHOOK_GET_EVENTS,
    async (): Promise<IpcResponse<WebhookGetEventsResult>> =>
      wrap(async () => ({ events: webhookServer.getEvents() }))
  );

  ipcMain.handle(
    IPC_CHANNELS.WEBHOOK_CLEAR_EVENTS,
    async (): Promise<IpcResponse<void>> =>
      wrap(async () => {
        webhookServer.clearEvents();
      })
  );

  // ── Rate limit monitor handlers ─────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.RATE_LIMIT_GET_STATE,
    async (): Promise<IpcResponse<RateLimitGetStateResult>> =>
      wrap(async () => ({
        providers: rateLimitTracker.getState(),
      }))
  );

  // Broadcast rate-limit alerts to all renderer windows.
  rateLimitTracker.onAlert((alert) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.RATE_LIMIT_ALERT, alert);
      }
    }
  });

  // ── AI Integration Builder handlers ─────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_AI_GENERATE,
    async (
      _event: IpcMainInvokeEvent,
      args: AiGenerateRequest
    ): Promise<IpcResponse<AiGenerationResult>> =>
      wrap(async () => {
        if (!args?.provider || !args?.prompt) {
          throw new Error("provider and prompt are required");
        }
        return aiService.generate(args);
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_AI_REFINE,
    async (
      _event: IpcMainInvokeEvent,
      args: AiRefineRequest
    ): Promise<IpcResponse<AiGenerationResult>> =>
      wrap(async () => {
        if (!args?.provider || !args?.prompt || !args?.currentDefinition) {
          throw new Error("provider, prompt, and currentDefinition are required");
        }
        return aiService.refine(args);
      })
  );

  // ── AI Integration Builder v2 handlers (provider-backed tool-calling) ──

  ipcMain.handle(
    IPC_CHANNELS.AI_BUILDER_RUN,
    async (
      event: IpcMainInvokeEvent,
      args: AiBuilderRunRequest
    ): Promise<IpcResponse<AiBuilderRunResult>> =>
      wrap(async () => {
        if (!args?.aiProvider || !args?.prompt) {
          throw new Error("aiProvider and prompt are required");
        }

        const sender = event.sender;

        /** Fetch providers from the cached Nango catalog. */
        async function listProviders(search?: string) {
          const now = Date.now();
          if (!_providersCache || now - _providersCacheAt > PROVIDERS_TTL_MS) {
            const client = getNangoClient();
            const result = await client.listProviders(search ? { search } : {});
            _providersCache = (result.data as NangoProvider[]).map((p) => ({
              name: p.name,
              display_name: p.display_name,
              logo_url: p.logo_url,
              auth_mode: p.auth_mode,
              categories: (p as { categories?: string[] }).categories,
              docs: (p as { docs?: string }).docs,
            }));
            _providersCacheAt = now;
          }
          if (!search) return _providersCache;
          const q = search.toLowerCase().trim();
          return _providersCache.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.display_name.toLowerCase().includes(q) ||
              p.categories?.some((c) => c.toLowerCase().includes(q))
          );
        }

        return runAiBuilder(
          args,
          (toolCallEvent) => {
            if (!sender.isDestroyed()) {
              sender.send(IPC_CHANNELS.AI_BUILDER_TOOL_CALL, toolCallEvent);
            }
          },
          (text, done) => {
            if (!sender.isDestroyed()) {
              sender.send(IPC_CHANNELS.AI_BUILDER_MESSAGE, { text, done });
            }
          },
          listProviders,
        );
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_SAVE_KEY,
    async (
      _event: IpcMainInvokeEvent,
      args: AiProviderSaveKeyRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        if (!args?.provider || !args?.apiKey) {
          throw new Error("provider and apiKey are required");
        }
        credentialStore.saveAiProviderKey(args.provider, args.apiKey);
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_LOAD_KEY,
    async (
      _event: IpcMainInvokeEvent,
      args: AiProviderLoadKeyRequest
    ): Promise<IpcResponse<AiProviderLoadKeyResult>> =>
      wrap(async () => {
        if (!args?.provider) throw new Error("provider is required");
        const maskedKey = credentialStore.loadMaskedAiProviderKey(args.provider);
        return { exists: maskedKey !== null, maskedKey };
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.AI_PROVIDER_CLEAR_KEY,
    async (
      _event: IpcMainInvokeEvent,
      args: AiProviderClearKeyRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        if (!args?.provider) throw new Error("provider is required");
        credentialStore.clearAiProviderKey(args.provider);
      })
  );

  // ── MCP server management handlers ──────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.MCP_LIST_CONFIGS,
    async (): Promise<IpcResponse<McpListConfigsResult>> =>
      wrap(async () => {
        await mcpManager.loadConfigs();
        return {
          servers: mcpManager.getState(),
          configFiles: mcpManager.getConfigPaths(),
        };
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.MCP_ADD_CONFIG,
    async (
      _event: IpcMainInvokeEvent,
      args: McpAddConfigRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        if (!args?.name || !args?.command) {
          throw new Error("name and command are required");
        }
        await mcpManager.addConfig(
          { name: args.name, command: args.command, args: args.args ?? [], env: args.env },
          args.targetFile
        );
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.MCP_REMOVE_CONFIG,
    async (
      _event: IpcMainInvokeEvent,
      args: McpRemoveConfigRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        if (!args?.name) throw new Error("name is required");
        await mcpManager.removeConfig(args.name);
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.MCP_START,
    async (
      _event: IpcMainInvokeEvent,
      args: McpStartRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        if (!args?.name) throw new Error("name is required");
        await mcpManager.start(args.name);
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.MCP_STOP,
    async (
      _event: IpcMainInvokeEvent,
      args: McpStopRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        if (!args?.name) throw new Error("name is required");
        mcpManager.stop(args.name);
      })
  );

  // Broadcast MCP status changes to all renderer windows.
  mcpManager.onStatusChange((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.MCP_STATUS_CHANGED, event);
      }
    }
  });

  // ── MCP tool configuration (Nango Actions as MCP tools) ─────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_GET_MCP_TOOLS,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoGetMcpToolsRequest
    ): Promise<IpcResponse<NangoGetMcpToolsResult>> =>
      wrap(async () => {
        if (!args?.provider) throw new Error("provider is required");
        const client = getNangoClient();
        const configs = (await client.getScriptsConfig()) as Array<{
          providerConfigKey: string;
          provider?: string;
          actions: Array<{
            id?: number;
            name: string;
            description?: string;
            enabled?: boolean;
            is_public?: boolean | null;
            pre_built?: boolean | null;
          }>;
        }>;

        // Find the integration matching this provider
        const match = configs.find(
          (c) => c.provider === args.provider || c.providerConfigKey === args.provider
        );

        const tools = (match?.actions ?? []).map((a) => ({
          id: a.id ?? 0,
          name: a.name,
          description: a.description ?? "",
          enabled: a.enabled ?? false,
          preBuilt: !!(a.is_public || a.pre_built),
        }));

        const mcpEndpoint = `${client.serverUrl}/mcp`;

        return {
          tools,
          mcpEndpoint,
          providerConfigKey: match?.providerConfigKey ?? args.provider,
        };
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_SET_MCP_TOOL_ENABLED,
    async (
      _event: IpcMainInvokeEvent,
      args: NangoSetMcpToolEnabledRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        if (!args?.flowId || !args?.provider || !args?.providerConfigKey || !args?.scriptName) {
          throw new Error("flowId, provider, providerConfigKey, and scriptName are required");
        }
        const client = getNangoClient();
        const action = args.enabled ? "enable" : "disable";
        await client.http.patch(
          `${client.serverUrl}/api/v1/flows/${args.flowId}/${action}`,
          {
            provider: args.provider,
            providerConfigKey: args.providerConfigKey,
            scriptName: args.scriptName,
            type: "action",
          },
          { headers: { Authorization: `Bearer ${client.secretKey}` } }
        );
      })
  );

  // ── List MCP-capable integrations (batch summary) ─────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_LIST_MCP_INTEGRATIONS,
    async (
      _event: IpcMainInvokeEvent
    ): Promise<IpcResponse<NangoListMcpIntegrationsResult>> =>
      wrap(async () => {
        const client = getNangoClient();
        const configs = (await client.getScriptsConfig()) as Array<{
          providerConfigKey: string;
          provider?: string;
          actions: Array<{
            enabled?: boolean;
          }>;
        }>;

        const integrations = configs
          .filter((c) => c.actions && c.actions.length > 0)
          .map((c) => ({
            providerConfigKey: c.providerConfigKey,
            provider: c.provider ?? c.providerConfigKey,
            toolCount: c.actions.length,
            enabledCount: c.actions.filter((a) => a.enabled).length,
          }));

        return {
          integrations,
          mcpEndpoint: `${client.serverUrl}/mcp`,
        };
      })
  );
}
