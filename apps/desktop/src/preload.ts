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
  CredentialsSaveRequest,
  AppSetEnvironmentRequest,
  AppUpdateSettingsRequest,
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

export {};
