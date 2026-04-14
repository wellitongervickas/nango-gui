import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAIN_JS = resolve(__dirname, "../apps/desktop/dist/main.js");

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  app = await electron.launch({
    args: [MAIN_JS],
    env: { ...process.env, NODE_ENV: "production" },
  });
  page = await app.firstWindow();
  // Give the renderer time to fully paint
  await page.waitForTimeout(3000);
});

test.afterAll(async () => {
  await app.close();
});

// ── E2E 1: App launches with a window ───────────────────────────────────────

test("app launches and has a visible window", async () => {
  const isVisible = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win?.isVisible() ?? false;
  });
  expect(isVisible).toBe(true);
});

// ── E2E 2: Window dimensions are correct ────────────────────────────────────

test("window has correct minimum dimensions", async () => {
  const { width, height } = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const [w, h] = win.getMinimumSize();
    return { width: w, height: h };
  });
  expect(width).toBe(900);
  expect(height).toBe(600);
});

// ── E2E 3: Window size is at least minimum ──────────────────────────────────

test("window size meets minimum requirements", async () => {
  const { width, height } = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const [w, h] = win.getSize();
    return { width: w, height: h };
  });
  expect(width).toBeGreaterThanOrEqual(900);
  expect(height).toBeGreaterThanOrEqual(600);
});

// ── E2E 4: Security — context isolation is enabled ──────────────────────────

test("context isolation is enabled", async () => {
  const contextIsolation = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win.webContents.getLastWebPreferences()?.contextIsolation;
  });
  expect(contextIsolation).toBe(true);
});

// ── E2E 5: Security — node integration is disabled ──────────────────────────

test("node integration is disabled", async () => {
  const nodeIntegration = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win.webContents.getLastWebPreferences()?.nodeIntegration;
  });
  expect(nodeIntegration).toBe(false);
});
