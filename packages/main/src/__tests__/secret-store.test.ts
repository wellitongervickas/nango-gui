import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist shared state so vi.mock factories can close over it ────────────────
const { fileSystem, mockEncryptionAvailable } = vi.hoisted(() => ({
  fileSystem: {} as Record<string, Buffer | string>,
  mockEncryptionAvailable: { value: true },
}));

// ── Mock electron ────────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  safeStorage: {
    encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn((b: Buffer) => b.toString().replace(/^enc:/, "")),
    isEncryptionAvailable: vi.fn(() => mockEncryptionAvailable.value),
  },
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}));

// ── Mock logger ──────────────────────────────────────────────────────────────
vi.mock("../logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn() },
}));

// ── Mock fs ──────────────────────────────────────────────────────────────────
vi.mock("fs", () => ({
  existsSync: vi.fn((path: string) => path in fileSystem),
  readFileSync: vi.fn((path: string, encoding?: string) => {
    const data = fileSystem[path];
    if (data === undefined) {
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
    }
    return encoding ? data.toString() : data;
  }),
  writeFileSync: vi.fn((path: string, data: Buffer | string) => {
    fileSystem[path] = data;
  }),
  unlinkSync: vi.fn((path: string) => {
    delete fileSystem[path];
  }),
  mkdirSync: vi.fn(),
}));

import { join } from "path";
import {
  getSecret,
  setSecret,
  deleteSecret,
  listByNamespace,
  isEncryptionAvailable,
  SecretStore,
  SecretKeys,
  _migrateFromLegacyCredentialStoreInDir,
} from "../secrets/secret-store.js";
import { safeStorage } from "electron";

const SECRETS_DIR = join("/mock/userData", "secrets");
const INDEX_PATH = join(SECRETS_DIR, "_index.json");

function secretPath(key: string): string {
  const safe = key.replace(/[<>:"/\\|?*]/g, "_");
  return join(SECRETS_DIR, `${safe}.enc`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function seedIndex(index: Record<string, string[]>): void {
  fileSystem[INDEX_PATH] = JSON.stringify(index);
}

function readIndex(): Record<string, string[]> {
  const raw = fileSystem[INDEX_PATH];
  if (!raw) return {};
  return JSON.parse(raw.toString()) as Record<string, string[]>;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("SecretStore", () => {
  beforeEach(() => {
    // Clear virtual filesystem
    for (const k of Object.keys(fileSystem)) delete fileSystem[k];
    mockEncryptionAvailable.value = true;
    vi.mocked(safeStorage.encryptString).mockImplementation(
      (s: string) => Buffer.from(`enc:${s}`)
    );
    vi.mocked(safeStorage.decryptString).mockImplementation(
      (b: Buffer) => b.toString().replace(/^enc:/, "")
    );
    vi.mocked(safeStorage.isEncryptionAvailable).mockImplementation(
      () => mockEncryptionAvailable.value
    );
  });

  // ── isAvailable ────────────────────────────────────────────────────────────
  describe("isAvailable / isEncryptionAvailable", () => {
    it("returns true when safeStorage is available", () => {
      expect(isEncryptionAvailable()).toBe(true);
      expect(SecretStore.isAvailable()).toBe(true);
    });

    it("returns false when safeStorage is unavailable", () => {
      mockEncryptionAvailable.value = false;
      expect(isEncryptionAvailable()).toBe(false);
    });
  });

  // ── setSecret / getSecret ──────────────────────────────────────────────────
  describe("setSecret + getSecret", () => {
    it("encrypts and persists a secret", () => {
      setSecret("env:prod:secretKey", "sk-super-secret");
      expect(safeStorage.encryptString).toHaveBeenCalledWith("sk-super-secret");
      expect(fileSystem[secretPath("env:prod:secretKey")]).toBeDefined();
    });

    it("retrieves and decrypts a stored secret", () => {
      setSecret("env:prod:secretKey", "sk-super-secret");
      expect(getSecret("env:prod:secretKey")).toBe("sk-super-secret");
    });

    it("returns null for a key that does not exist", () => {
      expect(getSecret("env:missing:secretKey")).toBeNull();
    });

    it("returns null when decryption fails", () => {
      setSecret("env:prod:secretKey", "sk-super-secret");
      vi.mocked(safeStorage.decryptString).mockImplementation(() => {
        throw new Error("decrypt error");
      });
      expect(getSecret("env:prod:secretKey")).toBeNull();
    });

    it("throws when OS encryption is unavailable", () => {
      mockEncryptionAvailable.value = false;
      expect(() => setSecret("env:prod:secretKey", "value")).toThrow(
        "OS-level encryption is not available"
      );
    });

    it("indexes the key under its namespace after set", () => {
      setSecret("env:prod:secretKey", "sk-1");
      setSecret("env:staging:secretKey", "sk-2");
      const index = readIndex();
      expect(index["env"]).toEqual(
        expect.arrayContaining(["env:prod:secretKey", "env:staging:secretKey"])
      );
    });

    it("does not duplicate an existing key in the index on repeated set", () => {
      setSecret("env:prod:secretKey", "v1");
      setSecret("env:prod:secretKey", "v2");
      const index = readIndex();
      expect(index["env"]?.filter((k) => k === "env:prod:secretKey")).toHaveLength(1);
    });
  });

  // ── deleteSecret ───────────────────────────────────────────────────────────
  describe("deleteSecret", () => {
    it("returns false when the key does not exist", () => {
      expect(deleteSecret("env:ghost:secretKey")).toBe(false);
    });

    it("removes the encrypted file and returns true", () => {
      setSecret("env:prod:secretKey", "sk-1");
      const result = deleteSecret("env:prod:secretKey");
      expect(result).toBe(true);
      expect(getSecret("env:prod:secretKey")).toBeNull();
    });

    it("removes the key from the namespace index", () => {
      setSecret("env:prod:secretKey", "sk-1");
      setSecret("env:staging:secretKey", "sk-2");
      deleteSecret("env:prod:secretKey");
      const index = readIndex();
      expect(index["env"]).not.toContain("env:prod:secretKey");
      expect(index["env"]).toContain("env:staging:secretKey");
    });

    it("removes the namespace from the index when the last key is deleted", () => {
      setSecret("env:prod:secretKey", "sk-1");
      deleteSecret("env:prod:secretKey");
      const index = readIndex();
      expect(index["env"]).toBeUndefined();
    });
  });

  // ── listByNamespace ────────────────────────────────────────────────────────
  describe("listByNamespace", () => {
    it("returns an empty array when namespace has no keys", () => {
      expect(listByNamespace("env")).toEqual([]);
    });

    it("returns all key/value pairs for a namespace", () => {
      setSecret("env:prod:secretKey", "sk-prod");
      setSecret("env:staging:secretKey", "sk-staging");
      setSecret("oauth-app:github:clientSecret", "gh-secret");

      const envEntries = listByNamespace("env");
      expect(envEntries).toHaveLength(2);
      expect(envEntries).toEqual(
        expect.arrayContaining([
          { key: "env:prod:secretKey", value: "sk-prod" },
          { key: "env:staging:secretKey", value: "sk-staging" },
        ])
      );
    });

    it("does not include keys from other namespaces", () => {
      setSecret("env:prod:secretKey", "sk-prod");
      setSecret("cache:encryptionKey", "cache-key");
      const envEntries = listByNamespace("env");
      expect(envEntries.map((e) => e.key)).not.toContain("cache:encryptionKey");
    });

    it("skips keys whose decryption fails gracefully", () => {
      setSecret("env:prod:secretKey", "sk-prod");
      setSecret("env:staging:secretKey", "sk-staging");

      vi.mocked(safeStorage.decryptString).mockImplementationOnce(() => {
        throw new Error("corrupt");
      });

      const entries = listByNamespace("env");
      // One entry decryption failed, so only one should be returned
      expect(entries).toHaveLength(1);
    });
  });

  // ── SecretKeys helpers ─────────────────────────────────────────────────────
  describe("SecretKeys", () => {
    it("generates the correct env secret key", () => {
      expect(SecretKeys.envSecretKey("prod")).toBe("env:prod:secretKey");
    });

    it("generates the correct cache encryption key", () => {
      expect(SecretKeys.cacheEncryptionKey()).toBe("cache:encryptionKey");
    });

    it("generates the correct OAuth client secret key", () => {
      expect(SecretKeys.oauthClientSecret("github")).toBe(
        "oauth-app:github:clientSecret"
      );
    });
  });

  // ── SecretStore facade ─────────────────────────────────────────────────────
  describe("SecretStore facade", () => {
    it("exposes get, set, delete, listByNamespace, isAvailable, keys", () => {
      expect(typeof SecretStore.get).toBe("function");
      expect(typeof SecretStore.set).toBe("function");
      expect(typeof SecretStore.delete).toBe("function");
      expect(typeof SecretStore.listByNamespace).toBe("function");
      expect(typeof SecretStore.isAvailable).toBe("function");
      expect(SecretStore.keys).toBe(SecretKeys);
    });

    it("round-trips a secret through the facade", () => {
      SecretStore.set("cache:encryptionKey", "aes-key-128");
      expect(SecretStore.get("cache:encryptionKey")).toBe("aes-key-128");
      SecretStore.delete("cache:encryptionKey");
      expect(SecretStore.get("cache:encryptionKey")).toBeNull();
    });
  });
});

// ── Migration ──────────────────────────────────────────────────────────────
describe("migrateFromLegacyCredentialStore", () => {
  const MOCK_USER_DATA = "/mock/userData";

  beforeEach(() => {
    for (const k of Object.keys(fileSystem)) delete fileSystem[k];
    mockEncryptionAvailable.value = true;
    vi.mocked(safeStorage.encryptString).mockImplementation(
      (s: string) => Buffer.from(`enc:${s}`)
    );
    vi.mocked(safeStorage.decryptString).mockImplementation(
      (b: Buffer) => b.toString().replace(/^enc:/, "")
    );
    vi.mocked(safeStorage.isEncryptionAvailable).mockImplementation(
      () => mockEncryptionAvailable.value
    );
  });

  it("is a no-op when no legacy files exist", async () => {
    await _migrateFromLegacyCredentialStoreInDir(MOCK_USER_DATA);
    expect(Object.keys(fileSystem).filter((k) => !k.includes("_index"))).toHaveLength(0);
  });

  it("migrates credentials.enc to env:default:secretKey", async () => {
    const legacyPath = join(MOCK_USER_DATA, "credentials.enc");
    fileSystem[legacyPath] = Buffer.from("enc:sk-legacy");

    await _migrateFromLegacyCredentialStoreInDir(MOCK_USER_DATA);

    expect(getSecret("env:default:secretKey")).toBe("sk-legacy");
    expect(fileSystem[legacyPath]).toBeUndefined();
  });

  it("migrates ai-key-openai.enc to ai-provider:openai:apiKey", async () => {
    const legacyPath = join(MOCK_USER_DATA, "ai-key-openai.enc");
    fileSystem[legacyPath] = Buffer.from("enc:openai-key");

    await _migrateFromLegacyCredentialStoreInDir(MOCK_USER_DATA);

    expect(getSecret("ai-provider:openai:apiKey")).toBe("openai-key");
    expect(fileSystem[legacyPath]).toBeUndefined();
  });

  it("migrates ai-key-anthropic.enc to ai-provider:anthropic:apiKey", async () => {
    const legacyPath = join(MOCK_USER_DATA, "ai-key-anthropic.enc");
    fileSystem[legacyPath] = Buffer.from("enc:anthropic-key");

    await _migrateFromLegacyCredentialStoreInDir(MOCK_USER_DATA);

    expect(getSecret("ai-provider:anthropic:apiKey")).toBe("anthropic-key");
    expect(fileSystem[legacyPath]).toBeUndefined();
  });

  it("deletes the legacy file when the secret is already in SecretStore", async () => {
    const legacyPath = join(MOCK_USER_DATA, "credentials.enc");
    fileSystem[legacyPath] = Buffer.from("enc:sk-legacy");
    // Pre-seed the new store
    setSecret("env:default:secretKey", "sk-already-migrated");

    await _migrateFromLegacyCredentialStoreInDir(MOCK_USER_DATA);

    // Legacy file should be deleted; existing value preserved
    expect(fileSystem[legacyPath]).toBeUndefined();
    expect(getSecret("env:default:secretKey")).toBe("sk-already-migrated");
  });

  it("logs a warning and continues when migration of one file fails", async () => {
    const openaiPath = join(MOCK_USER_DATA, "ai-key-openai.enc");
    const anthropicPath = join(MOCK_USER_DATA, "ai-key-anthropic.enc");
    fileSystem[openaiPath] = Buffer.from("enc:openai-key");
    fileSystem[anthropicPath] = Buffer.from("enc:anthropic-key");

    // Make the first decrypt fail
    vi.mocked(safeStorage.decryptString)
      .mockImplementationOnce(() => { throw new Error("corrupt"); })
      .mockImplementation((b: Buffer) => b.toString().replace(/^enc:/, ""));

    await expect(
      _migrateFromLegacyCredentialStoreInDir(MOCK_USER_DATA)
    ).resolves.not.toThrow();

    // The second file should still be migrated
    expect(getSecret("ai-provider:anthropic:apiKey")).toBe("anthropic-key");
  });
});
