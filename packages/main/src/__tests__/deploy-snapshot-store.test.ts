import { describe, it, expect, vi, beforeEach } from "vitest";

const { fileSystem, mockRandomUUID } = vi.hoisted(() => ({
  fileSystem: {} as Record<string, string>,
  mockRandomUUID: vi.fn<[], string>(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}));

vi.mock("fs", () => ({
  readFileSync: vi.fn((path: string, _encoding: string) => {
    const data = fileSystem[path];
    if (data === undefined)
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
    return data;
  }),
  writeFileSync: vi.fn((path: string, data: string) => {
    fileSystem[path] = data;
  }),
  existsSync: vi.fn((path: string) => path in fileSystem),
}));

vi.mock("node:crypto", () => ({
  randomUUID: mockRandomUUID,
}));

import { join } from "path";
import { deploySnapshotStore } from "../deploy-snapshot-store.js";

const SNAPSHOTS_PATH = join("/mock/userData", "deploy-snapshots.json");

const BASE_CONFIG = {
  command: "nango",
  args: ["deploy"],
  cwd: "/project",
};

describe("deploySnapshotStore", () => {
  beforeEach(() => {
    for (const key of Object.keys(fileSystem)) delete fileSystem[key];
    mockRandomUUID
      .mockReset()
      .mockReturnValueOnce("uuid-1")
      .mockReturnValueOnce("uuid-2")
      .mockReturnValueOnce("uuid-3");
  });

  describe("load", () => {
    it("returns empty array when no file exists", () => {
      expect(deploySnapshotStore.load()).toEqual([]);
    });

    it("returns empty array when file is corrupt", () => {
      fileSystem[SNAPSHOTS_PATH] = "not valid json{{{";
      expect(deploySnapshotStore.load()).toEqual([]);
    });

    it("returns empty array when file contains non-array JSON", () => {
      fileSystem[SNAPSHOTS_PATH] = JSON.stringify({ not: "an array" });
      expect(deploySnapshotStore.load()).toEqual([]);
    });
  });

  describe("save", () => {
    it("creates a snapshot with a uuid and ISO timestamp", () => {
      const snapshot = deploySnapshotStore.save({
        environment: "development",
        cliConfig: BASE_CONFIG,
      });

      expect(snapshot.id).toBe("uuid-1");
      expect(snapshot.environment).toBe("development");
      expect(snapshot.cliConfig).toEqual(BASE_CONFIG);
      expect(snapshot.label).toBeUndefined();
      expect(typeof snapshot.timestamp).toBe("string");
      expect(() => new Date(snapshot.timestamp)).not.toThrow();
    });

    it("includes label when provided", () => {
      const snapshot = deploySnapshotStore.save({
        environment: "production",
        cliConfig: BASE_CONFIG,
        label: "v1.2.3",
      });
      expect(snapshot.label).toBe("v1.2.3");
    });

    it("persists to disk in newest-first order", () => {
      deploySnapshotStore.save({ environment: "development", cliConfig: BASE_CONFIG });
      deploySnapshotStore.save({ environment: "production", cliConfig: BASE_CONFIG });

      const stored = JSON.parse(fileSystem[SNAPSHOTS_PATH]) as { id: string }[];
      expect(stored[0].id).toBe("uuid-2");
      expect(stored[1].id).toBe("uuid-1");
    });

    it("caps at 20 snapshots, removing the oldest", () => {
      // Pre-seed 20 entries
      const existing = Array.from({ length: 20 }, (_, i) => ({
        id: `old-${i}`,
        timestamp: new Date().toISOString(),
        environment: "development" as const,
        cliConfig: BASE_CONFIG,
      }));
      fileSystem[SNAPSHOTS_PATH] = JSON.stringify(existing);

      deploySnapshotStore.save({ environment: "development", cliConfig: BASE_CONFIG });

      const stored = JSON.parse(fileSystem[SNAPSHOTS_PATH]) as { id: string }[];
      expect(stored).toHaveLength(20);
      expect(stored[0].id).toBe("uuid-1");
      expect(stored.find((s) => s.id === "old-19")).toBeUndefined();
    });
  });

  describe("get", () => {
    it("returns the snapshot by id", () => {
      deploySnapshotStore.save({ environment: "development", cliConfig: BASE_CONFIG });
      const found = deploySnapshotStore.get("uuid-1");
      expect(found?.id).toBe("uuid-1");
    });

    it("returns undefined for unknown id", () => {
      expect(deploySnapshotStore.get("does-not-exist")).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("removes the snapshot from disk", () => {
      deploySnapshotStore.save({ environment: "development", cliConfig: BASE_CONFIG });
      deploySnapshotStore.delete("uuid-1");

      const stored = JSON.parse(fileSystem[SNAPSHOTS_PATH]) as { id: string }[];
      expect(stored).toHaveLength(0);
    });

    it("is a no-op for unknown id", () => {
      deploySnapshotStore.save({ environment: "development", cliConfig: BASE_CONFIG });
      deploySnapshotStore.delete("no-such-id");

      const stored = JSON.parse(fileSystem[SNAPSHOTS_PATH]) as { id: string }[];
      expect(stored).toHaveLength(1);
    });
  });
});
