import type {
  IpcResponse,
  NangoConnectionDetail,
  NangoConnectionSummary,
  NangoDeleteConnectionRequest,
  NangoGetConnectionRequest,
  NangoGetProviderRequest,
  NangoListConnectionsRequest,
  NangoListProvidersRequest,
  NangoProvider,
  NangoValidateKeyRequest,
  NangoValidateKeyResult,
  NangoCreateConnectSessionRequest,
  NangoCreateConnectSessionResult,
  CredentialsSaveRequest,
  CredentialsExistsResult,
  AppGetEnvironmentResult,
  AppSetEnvironmentRequest,
  AppSettings,
  AppUpdateSettingsRequest,
} from "@nango-gui/shared";

declare global {
  interface Window {
    nango: {
      listConnections(
        args?: NangoListConnectionsRequest
      ): Promise<IpcResponse<NangoConnectionSummary[]>>;
      getConnection(
        args: NangoGetConnectionRequest
      ): Promise<IpcResponse<NangoConnectionDetail>>;
      deleteConnection(
        args: NangoDeleteConnectionRequest
      ): Promise<IpcResponse<void>>;
      validateKey(
        args: NangoValidateKeyRequest
      ): Promise<IpcResponse<NangoValidateKeyResult>>;
      createConnectSession(
        args: NangoCreateConnectSessionRequest
      ): Promise<IpcResponse<NangoCreateConnectSessionResult>>;
      listProviders(
        args?: NangoListProvidersRequest
      ): Promise<IpcResponse<NangoProvider[]>>;
      getProvider(
        args: NangoGetProviderRequest
      ): Promise<IpcResponse<NangoProvider>>;
    };
    credentials: {
      save(args: CredentialsSaveRequest): Promise<IpcResponse<void>>;
      exists(): Promise<IpcResponse<CredentialsExistsResult>>;
      clear(): Promise<IpcResponse<void>>;
      validate(
        args: NangoValidateKeyRequest
      ): Promise<IpcResponse<NangoValidateKeyResult>>;
    };
    electronApp: {
      getEnvironment(): Promise<IpcResponse<AppGetEnvironmentResult>>;
      setEnvironment(args: AppSetEnvironmentRequest): Promise<IpcResponse<void>>;
      getSettings(): Promise<IpcResponse<AppSettings>>;
      updateSettings(args: AppUpdateSettingsRequest): Promise<IpcResponse<void>>;
    };
  }
}
