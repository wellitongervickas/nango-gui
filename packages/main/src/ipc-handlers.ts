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
