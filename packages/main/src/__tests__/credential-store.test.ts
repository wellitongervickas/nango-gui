import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist the virtual filesystem so it's available inside the vi.mock factory
// (vi.mock factories are hoisted to the top of the file by Vitest).
const { fileSystem } = vi.hoisted(() => ({
  fileSystem: {} as Record<string, Buffer | string>,
}));

// Mock electron
vi.mock("electron", () => ({
  safeStorage: {
    encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn((b: Buffer) => b.toString().replace(/^enc:/, "")),
    isEncryptionAvailable: vi.fn(() => true),
  },
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}));

// Mock fs — uses fileSystem from vi.hoisted above
vi.mock("fs", () => ({
  readFileSync: vi.fn((path: string, encoding?: string) => {
    const data = fileSystem[path];
    if (data === undefined)
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
    return encoding ? data.toString() : data;
  }),
  writeFileSync: vi.fn((path: string, data: Buffer | string) => {
    fileSystem[path] = typeof data === "string" ? Buffer.from(data) : data;
  }),
  unlinkSync: vi.fn((path: string) => {
    delete fileSystem[path];
  }),
  existsSync: vi.fn((path: string) => path in fileSystem),
}));

import { join } from "path";
import { credentialStore } from "../credential-store.js";
import { safeStorage } from "electron";

// Use path.join so paths are correct on all platforms (backslash on Windows)
const CREDS_PATH = join("/mock/userData", "credentials.enc");
const ENV_PATH = join("/mock/userData", "environment.json");

describe("credentialStore", () => {
  beforeEach(() => {
    for (const key of Object.keys(fileSystem)) delete fileSystem[key];
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
    vi.mocked(safeStorage.encryptString).mockImplementation(
      (s: string) => Buffer.from(`enc:${s}`)
    );
    vi.mocked(safeStorage.decryptString).mockImplementation(
      (b: Buffer) => b.toString().replace(/^enc:/, "")
    );
  });

  describe("isAvailable", () => {
    it("returns true when safeStorage is available", () => {
      expect(credentialStore.isAvailable()).toBe(true);
    });

    it("returns false when safeStorage is unavailable", () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
      expect(credentialStore.isAvailable()).toBe(false);
    });
  });

  describe("save + load", () => {
    it("encrypts and writes the key to disk", () => {
      credentialStore.save("my-secret-key");
      expect(safeStorage.encryptString).toHaveBeenCalledWith("my-secret-key");
      expect(fileSystem[CREDS_PATH]).toBeDefined();
    });

    it("loads and decrypts the key", () => {
      credentialStore.save("my-secret-key");
      const loaded = credentialStore.load();
      expect(loaded).toBe("my-secret-key");
    });

    it("returns null when no credentials file exists", () => {
      expect(credentialStore.load()).toBeNull();
    });

    it("throws when encryption is unavailable on save", () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
      expect(() => credentialStore.save("key")).toThrow(
        "Secure storage is not available"
      );
    });

    it("returns null if decryption fails", () => {
      credentialStore.save("key");
      vi.mocked(safeStorage.decryptString).mockImplementation(() => {
        throw new Error("decrypt error");
      });
      expect(credentialStore.load()).toBeNull();
    });
  });

  describe("clear", () => {
    it("removes credentials and environment files", () => {
      credentialStore.save("key");
      credentialStore.saveEnvironment("production");
      credentialStore.clear();
      expect(credentialStore.load()).toBeNull();
      expect(fileSystem[CREDS_PATH]).toBeUndefined();
      expect(fileSystem[ENV_PATH]).toBeUndefined();
    });

    it("does not throw when files do not exist", () => {
      expect(() => credentialStore.clear()).not.toThrow();
    });
  });

  describe("saveEnvironment + loadEnvironment", () => {
    it("defaults to development when no file exists", () => {
      expect(credentialStore.loadEnvironment()).toBe("development");
    });

    it("persists and loads production", () => {
      credentialStore.saveEnvironment("production");
      expect(credentialStore.loadEnvironment()).toBe("production");
    });

    it("persists and loads development", () => {
      credentialStore.saveEnvironment("development");
      expect(credentialStore.loadEnvironment()).toBe("development");
    });
  });
});
