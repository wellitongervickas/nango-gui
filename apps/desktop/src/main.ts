import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { registerIpcHandlers } from "@nango-gui/main/ipc-handlers.js";
import { credentialStore } from "@nango-gui/main/credential-store.js";
import { initNangoClient } from "@nango-gui/main/nango-client.js";

const isDev = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;

function createWindow(startRoute: "/" | "/setup" = "/"): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    const url = `http://localhost:5173${startRoute === "/setup" ? "#/setup" : ""}`;
    mainWindow.loadURL(url);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      join(__dirname, "../../packages/renderer/dist/index.html"),
      startRoute === "/setup" ? { hash: "/setup" } : undefined
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function bootstrap(): Promise<void> {
  registerIpcHandlers();

  // Determine startup route based on stored credentials
  let startRoute: "/" | "/setup" = "/setup";

  if (credentialStore.isAvailable()) {
    const storedKey = credentialStore.load();
    if (storedKey) {
      try {
        await initNangoClient(storedKey);
        startRoute = "/";
      } catch {
        // Key exists but client failed to init — show setup so user can re-enter
        startRoute = "/setup";
      }
    }
  }

  createWindow(startRoute);
}

app.whenReady().then(bootstrap);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    bootstrap();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
