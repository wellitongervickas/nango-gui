import { ipcMain, app } from "electron";
import {
  IPC_CHANNELS,
  type IpcResponse,
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
} from "@nango-gui/shared";
import {
  getNangoClient,
  initNangoClient,
  resetNangoClient,
  validateNangoKey,
} from "./nango-client.js";
import { credentialStore } from "./credential-store.js";

/** Wrap a handler body in the standard IpcResponse envelope. */
async function wrap<T>(fn: () => Promise<T>): Promise<IpcResponse<T>> {
  try {
    const data = await fn();
    return { status: "ok", data, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    return { status: "error", data: null, error: message };
  }
}

/** Map a raw Nango sync status object to our typed record. */
function mapSyncRecord(raw: unknown): NangoSyncRecord {
  const s = raw as Record<string, unknown>;
  const result = s.latestResult as Record<string, unknown> | null | undefined;
  return {
    id: String(s.id ?? ""),
    name: String(s.name ?? ""),
    status: String(s.status ?? "STOPPED") as NangoSyncRecord["status"],
    type: String(s.type ?? "INCREMENTAL"),
    frequency: s.frequency != null ? String(s.frequency) : null,
    finishedAt: s.finishedAt != null ? String(s.finishedAt) : null,
    nextScheduledSyncAt:
      s.nextScheduledSyncAt != null ? String(s.nextScheduledSyncAt) : null,
    latestResult: result
      ? {
          added: Number(result.added ?? 0),
          updated: Number(result.updated ?? 0),
          deleted: Number(result.deleted ?? 0),
        }
      : null,
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
      _event,
      args?: NangoListConnectionsRequest
    ): Promise<IpcResponse<NangoConnectionSummary[]>> =>
      wrap(async () => {
        const client = getNangoClient();
        const result = await client.listConnections(
          args?.integrationId
            ? { integrationId: args.integrationId }
            : undefined
        );
        return result.connections as unknown as NangoConnectionSummary[];
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_GET_CONNECTION,
    async (
      _event,
      args: NangoGetConnectionRequest
    ): Promise<IpcResponse<NangoConnectionDetail>> =>
      wrap(async () => {
        const client = getNangoClient();
        const result = await client.getConnection(
          args.providerConfigKey,
          args.connectionId
        );
        return result as unknown as NangoConnectionDetail;
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.NANGO_DELETE_CONNECTION,
    async (
      _event,
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
      _event,
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
      _event,
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
      _event,
      args?: NangoListProvidersRequest
    ): Promise<IpcResponse<NangoProvider[]>> =>
      wrap(async () => {
        const now = Date.now();
        // Refresh cache if stale or forced by a search term.
        if (!_providersCache || now - _providersCacheAt > PROVIDERS_TTL_MS) {
          const client = getNangoClient();
          const result = await client.listProviders({ search: args?.search ?? "" });
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
      _event,
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
      _event,
      args: NangoListSyncsRequest
    ): Promise<IpcResponse<NangoSyncRecord[]>> =>
      wrap(async () => {
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
      _event,
      args: NangoGetSyncStatusRequest
    ): Promise<IpcResponse<NangoSyncRecord[]>> =>
      wrap(async () => {
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
      _event,
      args: NangoTriggerSyncRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
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
      _event,
      args: NangoPauseSyncRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
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
      _event,
      args: NangoStartSyncRequest
    ): Promise<IpcResponse<void>> =>
      wrap(async () => {
        const client = getNangoClient();
        await client.startSync(
          args.providerConfigKey,
          args.syncs,
          args.connectionId
        );
      })
  );

  // ── Records handler ──────────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.NANGO_LIST_RECORDS,
    async (
      _event,
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
      _event,
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
      _event,
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
      _event,
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
      _event,
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
      _event,
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
      _event,
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
}
