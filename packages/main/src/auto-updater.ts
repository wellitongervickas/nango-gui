import { autoUpdater, type UpdateInfo } from "electron-updater";
import type { BrowserWindow } from "electron";
import log from "./logger.js";

autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

/**
 * Initialize the auto-updater. Call once after the main window is created.
 * Sends IPC messages to the renderer when an update is available.
 */
export function initAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    log.info(`[AutoUpdater] Update available: v${info.version}`);
    mainWindow.webContents.send("app:update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on("update-not-available", () => {
    log.info("[AutoUpdater] App is up to date");
  });

  autoUpdater.on("error", (err: Error) => {
    log.error("[AutoUpdater] Error:", err.message);
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow.webContents.send("app:update-progress", {
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    log.info(`[AutoUpdater] Update downloaded: v${info.version}`);
    mainWindow.webContents.send("app:update-downloaded", {
      version: info.version,
    });
  });

  // Check for updates after a short delay to avoid slowing startup
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn("[AutoUpdater] Initial check failed:", err.message);
    });
  }, 5000);
}

/** Download the available update. */
export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((err) => {
    log.error("[AutoUpdater] Download failed:", err.message);
  });
}

/** Install the downloaded update and restart. */
export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}
