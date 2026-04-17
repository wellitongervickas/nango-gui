import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "@nango-gui/shared";
import type {
  NangoListConnectionsRequest,
  NangoGetConnectionRequest,
  NangoDeleteConnectionRequest,
  NangoValidateKeyRequest,
  NangoCreateConnectSessionRequest,
  NangoListProvidersRequest,
  NangoGetProviderRequest,
  NangoListSyncsRequest,
  NangoGetSyncStatusRequest,
  NangoTriggerSyncRequest,
  NangoPauseSyncRequest,
  NangoStartSyncRequest,
  NangoUpdateSyncFrequencyRequest,
  NangoListRecordsRequest,
  NangoTriggerActionRequest,
  NangoProxyRequest,
  CredentialsSaveRequest,
  AppSetEnvironmentRequest,
  AppUpdateSettingsRequest,
  CliRunRequest,
  CliAbortRequest,
  CliOutputEvent,
  CliExitEvent,
  DeploySaveSnapshotRequest,
  DeployDeleteSnapshotRequest,
  DeployRollbackRequest,
  ProjectReadFileRequest,
  ProjectWriteFileRequest,
  WebhookStartServerRequest,
  WebhookEvent,
  RateLimitAlert,
} from "@nango-gui/shared";

// Expose window.nango — Nango SDK operations (proxied through main process)
contextBridge.exposeInMainWorld("nango", {
  listConnections: (args?: NangoListConnectionsRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_LIST_CONNECTIONS, args),
  getConnection: (args: NangoGetConnectionRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_GET_CONNECTION, args),
  deleteConnection: (args: NangoDeleteConnectionRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_DELETE_CONNECTION, args),
  validateKey: (args: NangoValidateKeyRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_VALIDATE_KEY, args),
  createConnectSession: (args: NangoCreateConnectSessionRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_CREATE_CONNECT_SESSION, args),
  listProviders: (args?: NangoListProvidersRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_LIST_PROVIDERS, args),
  getProvider: (args: NangoGetProviderRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_GET_PROVIDER, args),
  listSyncs: (args: NangoListSyncsRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_LIST_SYNCS, args),
  getSyncStatus: (args: NangoGetSyncStatusRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_GET_SYNC_STATUS, args),
  triggerSync: (args: NangoTriggerSyncRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_TRIGGER_SYNC, args),
  pauseSync: (args: NangoPauseSyncRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_PAUSE_SYNC, args),
  startSync: (args: NangoStartSyncRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_START_SYNC, args),
  updateSyncFrequency: (args: NangoUpdateSyncFrequencyRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_UPDATE_SYNC_FREQUENCY, args),
  listRecords: (args: NangoListRecordsRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_LIST_RECORDS, args),
  triggerAction: (args: NangoTriggerActionRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_TRIGGER_ACTION, args),
  proxyRequest: (args: NangoProxyRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_PROXY_REQUEST, args),
  getDashboard: () =>
    ipcRenderer.invoke(IPC_CHANNELS.NANGO_GET_DASHBOARD),
});

// Expose window.credentials — secure credential storage
contextBridge.exposeInMainWorld("credentials", {
  save: (args: CredentialsSaveRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS_SAVE, args),
  exists: () => ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS_EXISTS),
  clear: () => ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS_CLEAR),
  validate: (args: NangoValidateKeyRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREDENTIALS_VALIDATE, args),
});

// Expose window.electronApp — app-level settings
contextBridge.exposeInMainWorld("electronApp", {
  getEnvironment: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_ENVIRONMENT),
  setEnvironment: (args: AppSetEnvironmentRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_SET_ENVIRONMENT, args),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_SETTINGS),
  updateSettings: (args: AppUpdateSettingsRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_UPDATE_SETTINGS, args),
});

// Expose window.cli — Nango CLI subprocess (dryrun / deploy streaming)
contextBridge.exposeInMainWorld("cli", {
  run: (args: CliRunRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.CLI_RUN, args),
  abort: (args: CliAbortRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.CLI_ABORT, args),
  onOutput: (listener: (event: CliOutputEvent) => void) => {
    ipcRenderer.on(IPC_CHANNELS.CLI_OUTPUT, (_evt, data: CliOutputEvent) =>
      listener(data)
    );
  },
  onExit: (listener: (event: CliExitEvent) => void) => {
    ipcRenderer.on(IPC_CHANNELS.CLI_EXIT, (_evt, data: CliExitEvent) =>
      listener(data)
    );
  },
  /** Remove all registered CLI_OUTPUT listeners (call on component unmount). */
  removeAllOutputListeners: () =>
    ipcRenderer.removeAllListeners(IPC_CHANNELS.CLI_OUTPUT),
  /** Remove all registered CLI_EXIT listeners (call on component unmount). */
  removeAllExitListeners: () =>
    ipcRenderer.removeAllListeners(IPC_CHANNELS.CLI_EXIT),
});

// Expose window.deploy — deploy snapshot storage and rollback
contextBridge.exposeInMainWorld("deploy", {
  saveSnapshot: (args: DeploySaveSnapshotRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEPLOY_SAVE_SNAPSHOT, args),
  listSnapshots: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DEPLOY_LIST_SNAPSHOTS),
  deleteSnapshot: (args: DeployDeleteSnapshotRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEPLOY_DELETE_SNAPSHOT, args),
  rollback: (args: DeployRollbackRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEPLOY_ROLLBACK, args),
});

// Expose window.project — project file save/load dialogs and I/O
contextBridge.exposeInMainWorld("project", {
  showOpenDialog: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SHOW_OPEN_DIALOG),
  showSaveDialog: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SHOW_SAVE_DIALOG),
  showDirectoryDialog: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SHOW_DIRECTORY_DIALOG),
  readFile: (args: ProjectReadFileRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_READ_FILE, args),
  writeFile: (args: ProjectWriteFileRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_WRITE_FILE, args),
});

// Expose window.webhook — local HTTP webhook listener
contextBridge.exposeInMainWorld("webhook", {
  startServer: (args?: WebhookStartServerRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.WEBHOOK_START_SERVER, args),
  stopServer: () => ipcRenderer.invoke(IPC_CHANNELS.WEBHOOK_STOP_SERVER),
  getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.WEBHOOK_GET_STATUS),
  getEvents: () => ipcRenderer.invoke(IPC_CHANNELS.WEBHOOK_GET_EVENTS),
  clearEvents: () => ipcRenderer.invoke(IPC_CHANNELS.WEBHOOK_CLEAR_EVENTS),
  onEvent: (listener: (event: WebhookEvent) => void) => {
    ipcRenderer.on(IPC_CHANNELS.WEBHOOK_EVENT, (_evt, data: WebhookEvent) =>
      listener(data)
    );
  },
  removeAllEventListeners: () =>
    ipcRenderer.removeAllListeners(IPC_CHANNELS.WEBHOOK_EVENT),
});

// Expose window.rateLimit — rate-limit monitoring for API providers
contextBridge.exposeInMainWorld("rateLimit", {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.RATE_LIMIT_GET_STATE),
  onAlert: (listener: (alert: RateLimitAlert) => void) => {
    ipcRenderer.on(
      IPC_CHANNELS.RATE_LIMIT_ALERT,
      (_evt, data: RateLimitAlert) => listener(data)
    );
  },
  removeAllAlertListeners: () =>
    ipcRenderer.removeAllListeners(IPC_CHANNELS.RATE_LIMIT_ALERT),
});

export {};
