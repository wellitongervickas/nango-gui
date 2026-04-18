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
  NangoUpdateSyncFrequencyRequest,
  NangoUpdateSyncFrequencyResult,
  NangoSyncRecord,
  NangoListRecordsRequest,
  NangoListRecordsResult,
  NangoTriggerActionRequest,
  NangoTriggerActionResult,
  NangoProxyRequest,
  NangoProxyResult,
  NangoDashboardData,
  NangoGetConnectionHealthRequest,
  NangoConnectionHealthData,
  CredentialsSaveRequest,
  CredentialsExistsResult,
  AppGetEnvironmentResult,
  AppSetEnvironmentRequest,
  AppSettings,
  AppUpdateSettingsRequest,
  DeploySnapshot,
  DeploySaveSnapshotRequest,
  DeployListSnapshotsResult,
  DeployDeleteSnapshotRequest,
  DeployRollbackRequest,
  DeployRollbackResult,
  ProjectFileDialogResult,
  ProjectReadFileRequest,
  ProjectReadFileResult,
  ProjectWriteFileRequest,
  CliRunRequest,
  CliRunResult,
  CliAbortRequest,
  CliOutputEvent,
  CliExitEvent,
  WebhookStartServerRequest,
  WebhookStartServerResult,
  WebhookServerStatus,
  WebhookGetEventsResult,
  WebhookEvent,
  RateLimitGetStateResult,
  RateLimitAlert,
  AiGenerateRequest,
  AiRefineRequest,
  AiGenerationResult,
  AiStreamTokenEvent,
  McpListConfigsResult,
  McpAddConfigRequest,
  McpRemoveConfigRequest,
  McpStartRequest,
  McpStopRequest,
  McpStatusChangedEvent,
  NangoWebhookSettings,
  NangoUpdateWebhookSettingsRequest,
  AiBuilderRunRequest,
  AiBuilderRunResult,
  AiBuilderToolCallEvent,
  AiBuilderMessageEvent,
  AiProviderSaveKeyRequest,
  AiProviderLoadKeyRequest,
  AiProviderLoadKeyResult,
  AiProviderClearKeyRequest,
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
      updateSyncFrequency(
        args: NangoUpdateSyncFrequencyRequest
      ): Promise<IpcResponse<NangoUpdateSyncFrequencyResult>>;
      /** Generate a new integration from a plain-English prompt. */
      aiGenerateIntegration(
        args: AiGenerateRequest
      ): Promise<IpcResponse<AiGenerationResult>>;
      /** Refine an existing generated integration with a follow-up prompt. */
      aiRefineIntegration(
        args: AiRefineRequest
      ): Promise<IpcResponse<AiGenerationResult>>;
      /** Register a listener for streaming AI token events. */
      onAiStreamToken(listener: (event: AiStreamTokenEvent) => void): void;
      /** Remove all AI stream token listeners. */
      removeAllAiStreamListeners(): void;
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
      getWebhookSettings(): Promise<IpcResponse<NangoWebhookSettings>>;
      updateWebhookSettings(args: NangoUpdateWebhookSettingsRequest): Promise<IpcResponse<NangoWebhookSettings>>;
      getConnectionHealth(
        args: NangoGetConnectionHealthRequest
      ): Promise<IpcResponse<NangoConnectionHealthData>>;
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
    cli: {
      run(args: CliRunRequest): Promise<IpcResponse<CliRunResult>>;
      abort(args: CliAbortRequest): Promise<IpcResponse<void>>;
      onOutput(listener: (event: CliOutputEvent) => void): void;
      onExit(listener: (event: CliExitEvent) => void): void;
      removeAllOutputListeners(): void;
      removeAllExitListeners(): void;
    };
    deploy: {
      saveSnapshot(args: DeploySaveSnapshotRequest): Promise<IpcResponse<DeploySnapshot>>;
      listSnapshots(): Promise<IpcResponse<DeployListSnapshotsResult>>;
      deleteSnapshot(args: DeployDeleteSnapshotRequest): Promise<IpcResponse<void>>;
      rollback(args: DeployRollbackRequest): Promise<IpcResponse<DeployRollbackResult>>;
    };
    project: {
      showOpenDialog(): Promise<IpcResponse<ProjectFileDialogResult>>;
      showSaveDialog(): Promise<IpcResponse<ProjectFileDialogResult>>;
      showDirectoryDialog(): Promise<IpcResponse<ProjectFileDialogResult>>;
      readFile(args: ProjectReadFileRequest): Promise<IpcResponse<ProjectReadFileResult>>;
      writeFile(args: ProjectWriteFileRequest): Promise<IpcResponse<void>>;
    };
    webhook: {
      startServer(args?: WebhookStartServerRequest): Promise<IpcResponse<WebhookStartServerResult>>;
      stopServer(): Promise<IpcResponse<void>>;
      getStatus(): Promise<IpcResponse<WebhookServerStatus>>;
      getEvents(): Promise<IpcResponse<WebhookGetEventsResult>>;
      clearEvents(): Promise<IpcResponse<void>>;
      onEvent(listener: (event: WebhookEvent) => void): void;
      removeAllEventListeners(): void;
    };
    rateLimit: {
      getState(): Promise<IpcResponse<RateLimitGetStateResult>>;
      onAlert(listener: (alert: RateLimitAlert) => void): void;
      removeAllAlertListeners(): void;
    };
    mcp: {
      listConfigs(): Promise<IpcResponse<McpListConfigsResult>>;
      addConfig(args: McpAddConfigRequest): Promise<IpcResponse<void>>;
      removeConfig(args: McpRemoveConfigRequest): Promise<IpcResponse<void>>;
      start(args: McpStartRequest): Promise<IpcResponse<void>>;
      stop(args: McpStopRequest): Promise<IpcResponse<void>>;
      onStatusChange(listener: (event: McpStatusChangedEvent) => void): void;
      removeAllStatusChangeListeners(): void;
    };
    aiBuilder: {
      run(args: AiBuilderRunRequest): Promise<IpcResponse<AiBuilderRunResult>>;
      onToolCall(listener: (event: AiBuilderToolCallEvent) => void): void;
      onMessage(listener: (event: AiBuilderMessageEvent) => void): void;
      removeAllListeners(): void;
      saveProviderKey(args: AiProviderSaveKeyRequest): Promise<IpcResponse<void>>;
      loadProviderKey(args: AiProviderLoadKeyRequest): Promise<IpcResponse<AiProviderLoadKeyResult>>;
      clearProviderKey(args: AiProviderClearKeyRequest): Promise<IpcResponse<void>>;
    };
  }
}
