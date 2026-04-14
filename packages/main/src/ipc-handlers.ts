import { ipcMain } from "electron";
import {
  IPC_CHANNELS,
  type IpcResponse,
  type NangoListConnectionsRequest,
  type NangoGetConnectionRequest,
  type NangoValidateKeyRequest,
  type NangoConnectionSummary,
  type NangoConnectionDetail,
  type NangoValidateKeyResult,
  type NangoCreateConnectSessionRequest,
  type NangoCreateConnectSessionResult,
  type CredentialsSaveRequest,
  type CredentialsExistsResult,
  type AppGetEnvironmentResult,
  type AppSetEnvironmentRequest,
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
}
