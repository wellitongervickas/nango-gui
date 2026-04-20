import type {
  IpcResponse,
  NangoConnectionDetail,
  NangoConnectionSummary,
  NangoGetConnectionRequest,
  NangoDeleteConnectionRequest,
  NangoListConnectionsRequest,
  NangoValidateKeyRequest,
  NangoValidateKeyResult,
  NangoCreateConnectSessionRequest,
  NangoCreateConnectSessionResult,
  NangoListProvidersRequest,
  NangoProvider,
  NangoGetProviderRequest,
  NangoListSyncsRequest,
  NangoGetSyncStatusRequest,
  NangoTriggerSyncRequest,
  NangoPauseSyncRequest,
  NangoStartSyncRequest,
  NangoUpdateSyncFrequencyRequest,
  NangoUpdateSyncFrequencyResult,
  NangoSyncRecord,
  NangoGetConnectionHealthRequest,
  NangoConnectionHealthData,
  CredentialsSaveRequest,
  CredentialsExistsResult,
  AppGetEnvironmentResult,
  AppSetEnvironmentRequest,
  AppSettings,
  AppUpdateSettingsRequest,
  CliRunRequest,
  CliRunResult,
  CliAbortRequest,
  CliOutputEvent,
  CliExitEvent,
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
  NangoSuggestScopesResult,
  NangoLogsSearchRequest,
  NangoLogsSearchResult,
  NangoLogsMessagesRequest,
  NangoLogsMessagesResult,
} from "./ipc-channels.js";

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
      /** Fetch current Nango outgoing webhook settings. */
      getWebhookSettings(): Promise<IpcResponse<NangoWebhookSettings>>;
      /** Update Nango outgoing webhook settings (partial patch). */
      updateWebhookSettings(args: NangoUpdateWebhookSettingsRequest): Promise<IpcResponse<NangoWebhookSettings>>;
      getConnectionHealth(
        args: NangoGetConnectionHealthRequest
      ): Promise<IpcResponse<NangoConnectionHealthData>>;
      /** Discover OAuth2 scopes for a provider using Nango's scope catalog. */
      suggestScopes(providerKey: string): Promise<IpcResponse<NangoSuggestScopesResult>>;
      /** Search Nango operation logs (syncs, actions, webhooks, etc.). */
      searchLogs(args: NangoLogsSearchRequest): Promise<IpcResponse<NangoLogsSearchResult>>;
      /** Get detailed messages for a specific log operation. */
      getLogMessages(args: NangoLogsMessagesRequest): Promise<IpcResponse<NangoLogsMessagesResult>>;
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
      getSettings(): Promise<IpcResponse<AppSettings>>;
      updateSettings(args: AppUpdateSettingsRequest): Promise<IpcResponse<void>>;
    };
    cli: {
      /** Spawn a CLI subprocess. Returns a runId to correlate streamed events. */
      run(args: CliRunRequest): Promise<IpcResponse<CliRunResult>>;
      /** Kill a running subprocess by runId. No-op if already exited. */
      abort(args: CliAbortRequest): Promise<IpcResponse<void>>;
      /** Register a listener for stdout/stderr lines from any active CLI run. */
      onOutput(listener: (event: CliOutputEvent) => void): void;
      /** Register a listener for process exit events. */
      onExit(listener: (event: CliExitEvent) => void): void;
      /** Remove all output listeners (call on component unmount to prevent leaks). */
      removeAllOutputListeners(): void;
      /** Remove all exit listeners (call on component unmount to prevent leaks). */
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
      /** Fetch the current per-provider rate-limit state from the main process. */
      getState(): Promise<IpcResponse<RateLimitGetStateResult>>;
      /** Register a listener for threshold-crossing alert events. */
      onAlert(listener: (alert: RateLimitAlert) => void): void;
      /** Remove all alert listeners (call on component unmount to prevent leaks). */
      removeAllAlertListeners(): void;
    };
    mcp: {
      /** Discover and list all MCP server configs and their runtime state. */
      listConfigs(): Promise<IpcResponse<McpListConfigsResult>>;
      /** Add a new MCP server config entry. */
      addConfig(args: McpAddConfigRequest): Promise<IpcResponse<void>>;
      /** Remove an MCP server config entry. */
      removeConfig(args: McpRemoveConfigRequest): Promise<IpcResponse<void>>;
      /** Start an MCP server by name. */
      start(args: McpStartRequest): Promise<IpcResponse<void>>;
      /** Stop an MCP server by name. */
      stop(args: McpStopRequest): Promise<IpcResponse<void>>;
      /** Register a listener for MCP server status change events. */
      onStatusChange(listener: (event: McpStatusChangedEvent) => void): void;
      /** Remove all status change listeners (call on component unmount). */
      removeAllStatusChangeListeners(): void;
    };
    aiBuilder: {
      /** Run the AI builder conversation loop with tool-calling. */
      run(args: AiBuilderRunRequest): Promise<IpcResponse<AiBuilderRunResult>>;
      /** Register a listener for AI canvas tool call events. */
      onToolCall(listener: (event: AiBuilderToolCallEvent) => void): void;
      /** Register a listener for AI text message events. */
      onMessage(listener: (event: AiBuilderMessageEvent) => void): void;
      /** Remove all AI builder event listeners. */
      removeAllListeners(): void;
      /** Save an AI provider API key. */
      saveProviderKey(args: AiProviderSaveKeyRequest): Promise<IpcResponse<void>>;
      /** Load (masked) AI provider API key info. */
      loadProviderKey(args: AiProviderLoadKeyRequest): Promise<IpcResponse<AiProviderLoadKeyResult>>;
      /** Clear an AI provider API key. */
      clearProviderKey(args: AiProviderClearKeyRequest): Promise<IpcResponse<void>>;
    };
  }
}
