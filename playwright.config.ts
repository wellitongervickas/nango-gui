import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Each spec file launches its own Electron process. Running multiple in
  // parallel causes window/display conflicts on CI (xvfb) and local runners,
  // so keep to a single worker to run spec files sequentially.
  workers: 1,
  timeout: 30_000,
  retries: 0,
  use: {
    trace: "on-first-retry",
  },
});
