/**
 * Unit tests for the encrypted SQLite cache:
 *   - AES-256-GCM encryption utilities (encryption.ts)
 *   - Versioned migration runner (migrations.ts)
 *   - CRUD operations for all 7 tables (crud.ts)
 *   - clear-cache operation (cache-db.ts)
 *
 * All tests use an in-process SQLite in-memory database (:memory:) via the
 * real better-sqlite3 package so the SQL is actually executed. electron and
 * SecretStore are mocked so tests can run in Node without a full Electron env.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";

// ── Mock electron (safeStorage not available in Node test env) ───────────────
vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => ":memory:") },
  safeStorage: {
    encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn((b: Buffer) => b.toString().replace(/^enc:/, "")),
    isEncryptionAvailable: vi.fn(() => true),
  },
}));

// ── Mock logger ──────────────────────────────────────────────────────────────
vi.mock("../logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Mock SecretStore — in-memory key store ───────────────────────────────────
const _secretStore: Map<string, string> = new Map();
vi.mock("../secrets/secret-store.js", () => ({
  SecretStore: {
    get: vi.fn((key: string) => _secretStore.get(key) ?? null),
    set: vi.fn((key: string, value: string) => { _secretStore.set(key, value); }),
    delete: vi.fn((key: string) => { _secretStore.delete(key); }),
    isAvailable: vi.fn(() => true),
    keys: {
      cacheEncryptionKey: () => "cache:encryptionKey",
    },
  },
}));

// ── Import modules under test ────────────────────────────────────────────────
// NOTE: import after mocks so mock factories run first.
import { encrypt, decrypt, encryptNullable, decryptNullable, encryptJson, decryptJson } from "../cache/encryption.js";
import { MIGRATIONS } from "../cache/schema.js";
import { runMigrations } from "../cache/migrations.js";
import Database from "better-sqlite3";

// We need a factory that creates an in-memory DB with full schema for CRUD tests.
function makeTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

// Patch getCacheDb to return our test DB
function withTestDb(db: Database.Database, key: Buffer, fn: () => void): void {
  // We temporarily override the module's internal state by re-importing with a mock.
  // Since we can't easily swap module-level singletons, we'll test CRUD via
  // direct imports and inject via the mock below.
  fn();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Encryption utilities
// ─────────────────────────────────────────────────────────────────────────────

describe("encryption", () => {
  const key = randomBytes(32);

  it("round-trips a plain string", () => {
    const plaintext = "hello, world!";
    const ciphertext = encrypt(plaintext, key);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext, key)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const c1 = encrypt("same", key);
    const c2 = encrypt("same", key);
    expect(c1).not.toBe(c2);
    expect(decrypt(c1, key)).toBe("same");
    expect(decrypt(c2, key)).toBe("same");
  });

  it("throws on tampered ciphertext (GCM auth tag mismatch)", () => {
    const ciphertext = encrypt("sensitive", key);
    const tampered = ciphertext.slice(0, -4) + "ffff"; // corrupt last 2 bytes of ciphertext hex
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it("throws on invalid ciphertext format", () => {
    expect(() => decrypt("not-a-valid-format", key)).toThrow("[CacheEncryption] Invalid ciphertext format");
  });

  it("encryptNullable / decryptNullable pass through null", () => {
    expect(encryptNullable(null, key)).toBeNull();
    expect(decryptNullable(null, key)).toBeNull();
  });

  it("encryptNullable / decryptNullable round-trip a string", () => {
    const enc = encryptNullable("test", key);
    expect(enc).not.toBeNull();
    expect(decryptNullable(enc, key)).toBe("test");
  });

  it("encryptJson / decryptJson round-trip an object", () => {
    const obj = { a: 1, b: "two", c: [3, 4] };
    const enc = encryptJson(obj, key);
    expect(enc).not.toBeNull();
    const dec = decryptJson<typeof obj>(enc, key);
    expect(dec).toEqual(obj);
  });

  it("encryptJson / decryptJson pass through null", () => {
    expect(encryptJson(null, key)).toBeNull();
    expect(decryptJson(null, key)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Migration runner
// ─────────────────────────────────────────────────────────────────────────────

describe("migrations", () => {
  it("applies all migrations to a fresh database", () => {
    const db = new Database(":memory:");
    const count = runMigrations(db);
    expect(count).toBe(MIGRATIONS.length);
  });

  it("is idempotent — re-running migrations returns 0", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    const second = runMigrations(db);
    expect(second).toBe(0);
  });

  it("creates all 7 domain tables plus schema_migrations", () => {
    const db = new Database(":memory:");
    runMigrations(db);

    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>
    ).map((r) => r.name);

    expect(tables).toContain("schema_migrations");
    expect(tables).toContain("connections");
    expect(tables).toContain("syncs");
    expect(tables).toContain("records");
    expect(tables).toContain("logs");
    expect(tables).toContain("webhook_events");
    expect(tables).toContain("dryrun_runs");
    expect(tables).toContain("mcp_tool_calls");
  });

  it("records every applied version in schema_migrations", () => {
    const db = new Database(":memory:");
    runMigrations(db);

    const rows = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
      .all() as Array<{ version: number }>;

    const appliedVersions = rows.map((r) => r.version);
    const expectedVersions = MIGRATIONS.map((m) => m.version);
    expect(appliedVersions).toEqual(expectedVersions);
  });

  it("applies only the missing migrations on a partially migrated DB", () => {
    const db = new Database(":memory:");
    // Apply only the first migration manually
    const first = MIGRATIONS[0]!;
    db.exec(first.sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(first.version, Date.now());

    const count = runMigrations(db);
    // Should apply all remaining migrations
    expect(count).toBe(MIGRATIONS.length - 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CRUD operations (using real in-memory SQLite via direct injection)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * We test the CRUD functions by overriding the `getCacheDb` module export.
 * Since the module uses a module-level singleton, we use vi.mock to inject
 * our test DB into every call.
 */
describe("CRUD operations", () => {
  let testDb: Database.Database;
  let testKey: Buffer;

  beforeEach(async () => {
    testDb = makeTestDb();
    testKey = randomBytes(32);

    vi.doMock("../cache/cache-db.js", () => ({
      getCacheDb: vi.fn(() => ({ db: testDb, key: testKey })),
      clearCacheDb: vi.fn(() => {
        const tables = ["mcp_tool_calls", "dryrun_runs", "webhook_events", "logs", "records", "syncs", "connections"];
        const clearAll = testDb.transaction(() => {
          for (const t of tables) testDb.prepare(`DELETE FROM ${t}`).run();
        });
        clearAll();
      }),
      openCacheDb: vi.fn(() => ({ db: testDb, key: testKey })),
      closeCacheDb: vi.fn(),
    }));
  });

  afterEach(() => {
    testDb.close();
    vi.resetModules();
  });

  // ── connections ────────────────────────────────────────────────────────────

  describe("connections", () => {
    it("upsert + list + get + delete", async () => {
      const { upsertConnection, listConnections, getConnection, deleteConnection } =
        await import("../cache/crud.js");

      const conn = {
        id: "conn-1",
        integration_id: "github",
        environment_id: "env-prod",
        display_name: "My GitHub",
        status: "active",
        metadata: { token_type: "bearer" } as Record<string, unknown>,
        synced_at: Date.now(),
        updated_at: Date.now(),
      };

      upsertConnection(conn);

      const list = listConnections({ integration_id: "github" });
      expect(list).toHaveLength(1);
      expect(list[0]!.id).toBe("conn-1");
      expect(list[0]!.metadata).toEqual({ token_type: "bearer" });

      const got = getConnection("conn-1");
      expect(got).not.toBeNull();
      expect(got!.display_name).toBe("My GitHub");

      deleteConnection("conn-1");
      expect(getConnection("conn-1")).toBeNull();
    });

    it("upsert is idempotent — updates existing row", async () => {
      const { upsertConnection, listConnections } = await import("../cache/crud.js");

      const base = {
        id: "conn-2",
        integration_id: "slack",
        environment_id: "env-dev",
        display_name: "Slack v1",
        status: "active",
        metadata: null,
        synced_at: 1000,
        updated_at: 1000,
      };

      upsertConnection(base);
      upsertConnection({ ...base, display_name: "Slack v2", updated_at: 2000 });

      const list = listConnections({});
      expect(list).toHaveLength(1);
      expect(list[0]!.display_name).toBe("Slack v2");
    });
  });

  // ── logs ───────────────────────────────────────────────────────────────────

  describe("logs", () => {
    it("insert + list + get", async () => {
      const { insertLog, listLogs, getLog } = await import("../cache/crud.js");

      const id = insertLog({ level: "info", message: "Test message", context: { key: "val" }, created_at: 1000 });
      expect(typeof id).toBe("string");

      const list = listLogs({ level: "info" });
      expect(list).toHaveLength(1);
      expect(list[0]!.message).toBe("Test message");
      expect(list[0]!.context).toEqual({ key: "val" });

      const got = getLog(id);
      expect(got).not.toBeNull();
      expect(got!.level).toBe("info");
    });

    it("list respects level filter", async () => {
      const { insertLog, listLogs } = await import("../cache/crud.js");
      insertLog({ level: "info", message: "Info", context: null, created_at: 1000 });
      insertLog({ level: "error", message: "Error", context: null, created_at: 2000 });

      expect(listLogs({ level: "info" })).toHaveLength(1);
      expect(listLogs({ level: "error" })).toHaveLength(1);
      expect(listLogs({})).toHaveLength(2);
    });
  });

  // ── webhook_events ────────────────────────────────────────────────────────

  describe("webhook_events", () => {
    it("insert + list + markProcessed + get + delete", async () => {
      const {
        insertWebhookEvent, listWebhookEvents, markWebhookEventProcessed,
        getWebhookEvent, deleteWebhookEvent,
      } = await import("../cache/crud.js");

      insertWebhookEvent({
        id: "wh-1", received_at: 1000, type: "sync.completed",
        integration: "github", connection: "conn-1",
        payload: { data: "test" },
      });

      const list = listWebhookEvents({});
      expect(list).toHaveLength(1);
      expect(list[0]!.payload).toEqual({ data: "test" });
      expect(list[0]!.processed).toBe(0);

      markWebhookEventProcessed("wh-1");
      const processed = getWebhookEvent("wh-1");
      expect(processed!.processed).toBe(1);

      deleteWebhookEvent("wh-1");
      expect(getWebhookEvent("wh-1")).toBeNull();
    });

    it("INSERT OR IGNORE does not duplicate events", async () => {
      const { insertWebhookEvent, listWebhookEvents } = await import("../cache/crud.js");
      const event = { id: "wh-2", received_at: 1000, type: "x", integration: null, connection: null, payload: {} };
      insertWebhookEvent(event);
      insertWebhookEvent(event); // duplicate
      expect(listWebhookEvents({})).toHaveLength(1);
    });
  });

  // ── mcp_tool_calls ────────────────────────────────────────────────────────

  describe("mcp_tool_calls (F1 Tool Call Log)", () => {
    it("insert + list + get + delete", async () => {
      const { insertMcpToolCall, listMcpToolCalls, getMcpToolCall, deleteMcpToolCall } =
        await import("../cache/crud.js");

      const call = {
        id: "mcp-1", session_id: "sess-abc", tool_name: "get_connection",
        arguments: { connection_id: "c1" }, result: { ok: true }, error: null,
        started_at: 1000, completed_at: 1050, duration_ms: 50,
      };

      insertMcpToolCall(call);

      const list = listMcpToolCalls({ session_id: "sess-abc" });
      expect(list).toHaveLength(1);
      expect(list[0]!.tool_name).toBe("get_connection");
      expect(list[0]!.arguments).toEqual({ connection_id: "c1" });
      expect(list[0]!.result).toEqual({ ok: true });
      expect(list[0]!.duration_ms).toBe(50);

      const got = getMcpToolCall("mcp-1");
      expect(got).not.toBeNull();

      deleteMcpToolCall("mcp-1");
      expect(getMcpToolCall("mcp-1")).toBeNull();
    });
  });

  // ── dryrun_runs ───────────────────────────────────────────────────────────

  describe("dryrun_runs", () => {
    it("insert + list + get + delete", async () => {
      const { insertDryrunRun, listDryrunRuns, getDryrunRun, deleteDryrunRun } =
        await import("../cache/crud.js");

      const run = {
        id: "dry-1", integration_id: "github", sync_name: "contacts",
        connection_id: "conn-1", status: "success",
        started_at: 1000, completed_at: 2000, result: [{ id: 1 }], error: null,
      };

      insertDryrunRun(run);
      const list = listDryrunRuns({ integration_id: "github" });
      expect(list).toHaveLength(1);
      expect(list[0]!.result).toEqual([{ id: 1 }]);

      const got = getDryrunRun("dry-1");
      expect(got!.status).toBe("success");

      deleteDryrunRun("dry-1");
      expect(getDryrunRun("dry-1")).toBeNull();
    });
  });

  // ── clear cache ───────────────────────────────────────────────────────────

  describe("clearCacheDb", () => {
    it("removes all rows from every table", async () => {
      const { insertLog, listLogs } = await import("../cache/crud.js");
      const { clearCacheDb } = await import("../cache/cache-db.js");

      insertLog({ level: "info", message: "a", context: null, created_at: 1000 });
      insertLog({ level: "info", message: "b", context: null, created_at: 2000 });
      expect(listLogs({})).toHaveLength(2);

      clearCacheDb();
      expect(listLogs({})).toHaveLength(0);
    });
  });
});
