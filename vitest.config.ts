import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/renderer", "packages/main", "packages/shared"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["packages/main/src/**/*.ts", "packages/renderer/src/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.test.ts", "**/types/**"],
      thresholds: {
        "packages/main/src": { lines: 80 },
        "packages/renderer/src": { lines: 60 },
      },
    },
  },
});
