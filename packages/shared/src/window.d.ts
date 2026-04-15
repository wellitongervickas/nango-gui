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
  }
}
