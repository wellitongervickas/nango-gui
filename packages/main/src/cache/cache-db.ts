/**
 * cache/cache-db.ts — Encrypted SQLite cache initialisation.
 *
 * ## Key sourcing (Architectural Mandate #3)
 * The encryption key is sourced EXCLUSIVELY from SecretStore namespace
 * `cache:encryptionKey`. On first run, a 32-byte random key is generated
 * and stored there. All subsequent runs load the same key from the OS
 * keychain (macOS Keychain / Windows DPAPI / Linux libsecret).
 *
 * No plaintext key ever touches disk.
 *
 * ## Encryption mandate (#6)
 * All reads and writes to the database flow through the CRUD layer in
 * crud.ts, which enforces AES-256-GCM encryption of all user-data columns
 * (those suffixed `_enc`). Bypassing the CRUD layer exposes only ciphertext.
 */

import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { app } from "electron";
import Database from "better-sqlite3";
import log from "../logger.js";
import { SecretStore } from "../secrets/secret-store.js";
import { runMigrations } from "./migrations.js";
import type { RawKey } from "./encryption.js";

let _db: Database.Database | null = null;
let _key: RawKey | null = null;

function dbPath(): string {
  return join(app.getPath("userData"), "cache.sqlite");
}

/**
 * Resolve or generate the 32-byte AES key for the cache.
 *
 * Key lifecycle:
 * 1. Read from SecretStore key `cache:encryptionKey`.
 * 2. If absent: generate `crypto.randomBytes(32)`, hex-encode, store in SecretStore.
 * 3. Return the raw 32-byte Buffer.
 */
function resolveEncryptionKey(): RawKey {
  const storedHex = SecretStore.get(SecretStore.keys.cacheEncryptionKey());

  if (storedHex) {
    const key = Buffer.from(storedHex, "hex");
    if (key.length !== 32) {
      throw new Error(
        `[CacheDB] Stored cache:encryptionKey has unexpected length ${key.length} (want 32)`
      );
    }
    log.info("[CacheDB] Loaded encryption key from SecretStore.");
    return key;
  }

  // First run — generate and persist.
  const newKey = randomBytes(32);
  SecretStore.set(SecretStore.keys.cacheEncryptionKey(), newKey.toString("hex"));
  log.info("[CacheDB] Generated and stored new encryption key in SecretStore.");
  return newKey;
}

/**
 * Open (or return the cached) encrypted SQLite database.
 *
 * - Key is resolved from SecretStore on first call.
 * - Migrations are run on first open.
 * - WAL mode + foreign keys are always enabled.
 *
 * Must NOT be called before `app.whenReady()` resolves, because safeStorage
 * requires the app to be ready.
 */
export function openCacheDb(): { db: Database.Database; key: RawKey } {
  if (_db && _key) return { db: _db, key: _key };

  _key = resolveEncryptionKey();

  const path = dbPath();
  _db = new Database(path);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  log.info(`[CacheDB] Opened database at ${path}`);

  runMigrations(_db);

  return { db: _db, key: _key };
}

/**
 * Return the open DB and key, throwing if `openCacheDb` has not been called yet.
 * All CRUD operations call this to enforce the "open with key first" invariant.
 */
export function getCacheDb(): { db: Database.Database; key: RawKey } {
  if (!_db || !_key) {
    throw new Error("[CacheDB] Database not initialised — call openCacheDb() first.");
  }
  return { db: _db, key: _key };
}

/**
 * Delete all rows from every cache table.
 * The schema and encryption key are preserved; only data is removed.
 */
export function clearCacheDb(): void {
  const { db } = getCacheDb();
  const tables = [
    "mcp_tool_calls",
    "dryrun_runs",
    "webhook_events",
    "logs",
    "records",
    "syncs",
    "connections",
  ] as const;

  const clearAll = db.transaction(() => {
    for (const table of tables) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
  });

  clearAll();
  log.info("[CacheDB] Cache cleared.");
}

/**
 * Close the database connection.
 * After calling this, `openCacheDb` must be called again before any DB access.
 */
export function closeCacheDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    _key = null;
    log.info("[CacheDB] Database closed.");
  }
}
