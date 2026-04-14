import type {
  IpcResponse,
  NangoConnectionDetail,
  NangoConnectionSummary,
  NangoEnvironment,
  NangoGetConnectionRequest,
  NangoListConnectionsRequest,
  NangoValidateKeyRequest,
  NangoValidateKeyResult,
  CredentialsSaveRequest,
  CredentialsExistsResult,
  AppGetEnvironmentResult,
  AppSetEnvironmentRequest,
} from "./ipc-channels.js";

declare global {
  interface Window {
    nango: {
      listConnections(
        args?: NangoListConnectionsRequest
      ): Promise<IpcResponse<{ connections: NangoConnectionSummary[] }>>;
      getConnection(
        args: NangoGetConnectionRequest
      ): Promise<IpcResponse<NangoConnectionDetail>>;
      validateKey(
        args: NangoValidateKeyRequest
      ): Promise<IpcResponse<NangoValidateKeyResult>>;
    };
    credentials: {
      save(
        args: CredentialsSaveRequest
      ): Promise<IpcResponse<void>>;
      exists(): Promise<IpcResponse<CredentialsExistsResult>>;
      clear(): Promise<IpcResponse<void>>;
      validate(
        args: NangoValidateKeyRequest
      ): Promise<IpcResponse<NangoValidateKeyResult>>;
    };
    electronApp: {
      getEnvironment(): Promise<IpcResponse<AppGetEnvironmentResult>>;
      setEnvironment(
        args: AppSetEnvironmentRequest
      ): Promise<IpcResponse<void>>;
    };
  }
}
