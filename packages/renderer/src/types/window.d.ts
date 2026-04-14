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
  NangoListSyncsRequest,
  NangoGetSyncStatusRequest,
  NangoTriggerSyncRequest,
  NangoPauseSyncRequest,
  NangoStartSyncRequest,
  NangoSyncRecord,
  NangoListRecordsRequest,
  NangoListRecordsResult,
  NangoTriggerActionRequest,
  NangoTriggerActionResult,
  NangoProxyRequest,
  NangoProxyResult,
  NangoDashboardData,
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
      listSyncs(
        args: NangoListSyncsRequest
      ): Promise<IpcResponse<NangoSyncRecord[]>>;
      getSyncStatus(
        args: NangoGetSyncStatusRequest
      ): Promise<IpcResponse<NangoSyncRecord[]>>;
      triggerSync(
        args: NangoTriggerSyncRequest
      ): Promise<IpcResponse<void>>;
      pauseSync(
        args: NangoPauseSyncRequest
      ): Promise<IpcResponse<void>>;
      startSync(
        args: NangoStartSyncRequest
      ): Promise<IpcResponse<void>>;
      listRecords(
        args: NangoListRecordsRequest
      ): Promise<IpcResponse<NangoListRecordsResult>>;
      triggerAction(
        args: NangoTriggerActionRequest
      ): Promise<IpcResponse<NangoTriggerActionResult>>;
      proxyRequest(
        args: NangoProxyRequest
      ): Promise<IpcResponse<NangoProxyResult>>;
      getDashboard(): Promise<IpcResponse<NangoDashboardData>>;
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
