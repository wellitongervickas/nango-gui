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
  type NangoListSyncsRequest,
  type NangoGetSyncStatusRequest,
  type NangoTriggerSyncRequest,
  type NangoPauseSyncRequest,
  type NangoStartSyncRequest,
  type NangoUpdateSyncFrequencyRequest,
  type NangoUpdateSyncFrequencyResult,
  type NangoSyncRecord,
  type NangoListRecordsRequest,
  type NangoListRecordsResult,
  type NangoDashboardData,
  type NangoTriggerActionRequest,
  type NangoTriggerActionResult,
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
} from "@nango-gui/shared";
import { webhookServer } from "./webhook-server.js";
import { deploySnapshotStore } from "./deploy-snapshot-store.js";
import { rateLimitTracker } from "./rate-limit-tracker.js";
import { aiService } from "./ai-service.js";
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

        // Fetch all connections
        const connResult = await client.listConnections();
        const connections =
          connResult.connections as unknown as Array<{
            id: number;
            connection_id: string;
            provider: string;
            provider_config_key: string;
            created: string;
          }>;

        const totalConnections = connections.length;
        let totalSyncs = 0;
        let runningSyncs = 0;
        let pausedSyncs = 0;
        let errorSyncs = 0;
        const recentErrors: NangoDashboardData["recentErrors"] = [];
        const connectionSyncCounts = new Map<
          string,
          { syncCount: number; lastActivity: string | null }
        >();

        // Fetch sync status per connection
        const activeConnectionIds = new Set<string>();
        for (const conn of connections) {
          const key = `${conn.provider_config_key}:${conn.connection_id}`;
          try {
            const result = await client.syncStatus(
              conn.provider_config_key,
              [],
              conn.connection_id
            );
            const syncs = ((result as { syncs?: unknown[] }).syncs ??
              []) as Array<{
              name?: string;
              status?: string;
              finishedAt?: string;
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
                recentErrors.push({
                  syncName: String(s.name ?? "unknown"),
                  connectionId: conn.connection_id,
                  providerConfigKey: conn.provider_config_key,
                  timestamp: s.finishedAt ?? null,
                });
              }
              if (
                s.finishedAt &&
                (!connLastActivity || s.finishedAt > connLastActivity)
              ) {
                connLastActivity = s.finishedAt;
              }
            }
            connectionSyncCounts.set(key, {
              syncCount: syncs.length,
              lastActivity: connLastActivity,
            });
          } catch {
            // Connection may not have syncs — skip silently
            connectionSyncCounts.set(key, {
              syncCount: 0,
              lastActivity: null,
            });
          }
        }

        // Sort errors by timestamp (most recent first), take top 5
        recentErrors.sort((a, b) => {
          if (!a.timestamp) return 1;
          if (!b.timestamp) return -1;
          return b.timestamp.localeCompare(a.timestamp);
        });
        const topErrors = recentErrors.slice(0, 5);

        // Top connections by sync count, then by most recent activity
        const topConnections: NangoDashboardData["topConnections"] = connections
          .map((conn) => {
            const key = `${conn.provider_config_key}:${conn.connection_id}`;
            const stats = connectionSyncCounts.get(key) ?? {
              syncCount: 0,
              lastActivity: null,
            };
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
          .slice(0, 5);

        return {
          totalConnections,
          activeConnections: activeConnectionIds.size,
          totalSyncs,
          runningSyncs,
          pausedSyncs,
          errorSyncs,
          recentErrors: topErrors,
          topConnections,
        };
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
        credentialStore.save(args.secretKey);
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
      wrap(async () => ({
        environment: credentialStore.loadEnvironment(),
        theme: credentialStore.loadTheme(),
        maskedKey: credentialStore.loadMaskedKey(),
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron ?? "unknown",
        nangoSdkVersion: "0.69.49",
      }))
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
}
