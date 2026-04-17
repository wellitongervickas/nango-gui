import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAIN_JS = resolve(__dirname, "../apps/desktop/dist/main.js");

// ── Navigation routes under test ─────────────────────────────────────────────
// Each entry: [navButtonLabel, expectedHash, pageH1]
// Dashboard: navigate("/") sets hash to "#/" (not "#/dashboard") per Toolbar.tsx
const NAV_CASES: [string, string, string][] = [
  ["Connections",  "#/connections",  "Connections"],
  ["Syncs",        "#/syncs",        "Syncs"],
  ["Records",      "#/records",      "Records"],
  ["Actions",      "#/actions",      "Actions"],
  ["Integrations", "#/integrations", "Integrations"],
  ["Settings",     "#/settings",     "Settings"],
  ["Dashboard",    "#/",             "Dashboard"],
];

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // NANGO_E2E=true tells the main process to skip the credential gate and
  // start directly on the main route, so we never land on the setup wizard.
  app = await electron.launch({
    args: [MAIN_JS],
    env: { ...process.env, NODE_ENV: "production", NANGO_E2E: "true" },
  });
  page = await app.firstWindow();

  // Capture renderer console errors and uncaught exceptions so CI logs show
  // the root cause when the page fails to hydrate.
  const rendererErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") rendererErrors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    rendererErrors.push(`pageerror: ${err.message}`);
  });

  // Wait for React to mount and the Toolbar (<header>) to appear.
  // 10 s is generous; in practice the renderer is ready in well under 5 s.
  try {
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10000 });
  } catch (e) {
    // Dump debug info so the CI log shows exactly what the renderer contains.
    let url = "<unavailable>";
    let dom = "<unavailable>";
    try { url = page.url(); } catch { /* noop */ }
    try { dom = await page.content(); } catch { /* noop */ }
    console.error("[E2E] Renderer URL:", url);
    console.error("[E2E] Renderer errors:", rendererErrors.join(" | ") || "none");
    console.error("[E2E] DOM excerpt:", dom.slice(0, 800));
    throw e;
  }
});

test.afterAll(async () => {
  await app.close();
});

// ── Regression: hash changes update the view without page reload ─────────────
//
// This test suite reproduces NANA-80: clicking a navigation button changes
// window.location.hash internally, but the React view must re-render
// automatically — the user must NOT need to press F5.

test("each nav button updates the view without a page reload", async () => {
  for (const [label, expectedHash, expectedHeading] of NAV_CASES) {
    // Click the toolbar nav button
    await page.click(`button:has-text("${label}")`);

    // React must re-render synchronously from the hashchange event.
    // Allow up to 2 s for the DOM to reflect the new route.
    await expect(async () => {
      const hash = await page.evaluate(() => window.location.hash);
      expect(hash).toBe(expectedHash);
    }).toPass({ timeout: 2000 });

    // The page heading must switch without F5.
    await expect(page.locator(`h1:has-text("${expectedHeading}")`)).toBeVisible({
      timeout: 2000,
    });
  }
});

// ── Active nav button styling updates on navigation ──────────────────────────
//
// The Toolbar reads currentRoute to apply the active style class.
// After clicking a nav item, that button must reflect the active state
// on the SAME render — it must not stay stale from a previous route.

test("active nav button reflects the current route after navigation", async () => {
  for (const [label, , ] of NAV_CASES) {
    await page.click(`button:has-text("${label}")`);
    await page.waitForTimeout(200);

    // The clicked button should carry the active background class.
    // Active buttons receive bg-[var(--color-bg)] per Toolbar.tsx NavButton.
    const activeButton = page.locator(`button:has-text("${label}")`).first();
    const classList = await activeButton.evaluate((el) =>
      Array.from(el.classList).join(" ")
    );
    expect(classList).toContain("bg-[var(--color-bg)]");
  }
});

// ── Back navigation via hash change ─────────────────────────────────────────
//
// Directly mutating window.location.hash (as navigate() does) must also
// trigger view updates — not just clicks.

test("direct hash mutation updates view without page reload", async () => {
  // Start on Connections
  await page.click('button:has-text("Connections")');
  await expect(page.locator('h1:has-text("Connections")')).toBeVisible({ timeout: 2000 });

  // Navigate programmatically to Syncs (mirrors what navigate() in Toolbar.tsx does)
  await page.evaluate(() => {
    window.location.hash = "/syncs";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

  // The view must update without F5
  await expect(page.locator('h1:has-text("Syncs")')).toBeVisible({ timeout: 2000 });
});

// ── Rapid sequential navigation ──────────────────────────────────────────────
//
// Clicking several nav items in quick succession must not leave the view
// on a stale route (no stuck/cached renders).

test("rapid sequential navigation always lands on the last clicked route", async () => {
  await page.click('button:has-text("Connections")');
  await page.click('button:has-text("Syncs")');
  await page.click('button:has-text("Records")');
  await page.click('button:has-text("Actions")');

  await expect(page.locator('h1:has-text("Actions")')).toBeVisible({ timeout: 2000 });

  // Previous route must NOT still be visible
  await expect(page.locator('h1:has-text("Records")')).not.toBeVisible();
  await expect(page.locator('h1:has-text("Syncs")')).not.toBeVisible();
  await expect(page.locator('h1:has-text("Connections")')).not.toBeVisible();
});

// ── Settings navigation via gear icon ────────────────────────────────────────

test("gear icon button navigates to settings", async () => {
  // Go somewhere else first
  await page.click('button:has-text("Dashboard")');
  await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 2000 });

  // Click the gear icon (aria-label="Settings")
  await page.click('[aria-label="Settings"]');
  await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 2000 });
});

// ── Canvas route navigation ──────────────────────────────────────────────────
//
// The "Canvas" nav button is a first-class route; it renders the ReactFlow
// editor (no page h1) with the Toolbar and Sidebar still present.

test("Canvas nav button navigates to the canvas editor", async () => {
  // Start on a known non-canvas page
  await page.click('button:has-text("Dashboard")');
  await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 2000 });

  // Click Canvas
  await page.click('button:has-text("Canvas")');

  // Hash must update to /canvas
  await expect(async () => {
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe("#/canvas");
  }).toPass({ timeout: 2000 });

  // ReactFlow container must be present — it is the canvas editor surface
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 3000 });
});

test("Canvas nav button receives active styling after navigation", async () => {
  await page.click('button:has-text("Canvas")');
  await page.waitForTimeout(200);

  const canvasBtn = page.locator('button:has-text("Canvas")').first();
  const classList = await canvasBtn.evaluate((el) =>
    Array.from(el.classList).join(" ")
  );
  expect(classList).toContain("bg-[var(--color-bg)]");
});

// ── Toolbar structure ────────────────────────────────────────────────────────
//
// The Toolbar must render its title and the Open-project icon on every route.

test("Toolbar title and Open-project button are visible on all routes", async () => {
  const routes = [
    { button: "Dashboard", hash: "#/" },
    { button: "Connections", hash: "#/connections" },
    { button: "Settings", hash: "#/settings" },
  ];

  for (const { button, hash } of routes) {
    if (button === "Dashboard") {
      await page.evaluate(() => { window.location.hash = "/"; window.dispatchEvent(new HashChangeEvent("hashchange")); });
    } else {
      await page.click(`button:has-text("${button}")`);
    }

    await expect(async () => {
      const h = await page.evaluate(() => window.location.hash);
      expect(h).toBe(hash);
    }).toPass({ timeout: 2000 });

    await expect(page.locator('header h1:has-text("Nango Builder")')).toBeVisible({
      timeout: 2000,
    });
    await expect(page.locator('[aria-label="Open project"]')).toBeVisible({
      timeout: 2000,
    });
  }
});

// ── Unknown route falls back to Canvas ───────────────────────────────────────
//
// App.tsx default branch renders the Canvas + Sidebar for any unrecognised hash.
// This is the expected catch-all; the user should see the editor, not a blank screen.

test("unknown hash falls back to the canvas editor", async () => {
  await page.evaluate(() => {
    window.location.hash = "/does-not-exist";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

  // The default branch in App.tsx renders the ReactFlow canvas
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 3000 });

  // Toolbar must still be present
  await expect(page.locator('header h1:has-text("Nango Builder")')).toBeVisible({
    timeout: 2000,
  });
});
