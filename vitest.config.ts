import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/renderer", "packages/main", "packages/shared"],
    passWithNoTests: true,
  },
});
