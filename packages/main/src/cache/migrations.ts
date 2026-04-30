/**
 * cache/migrations.ts — versioned, idempotent migration runner.
 *
 * Contract:
 * - Migrations are applied in ascending version order inside a single transaction.
 * - Each applied version is recorded in `schema_migrations`.
 * - Re-running on a database that is already up-to-date is a no-op (idempotent).
 * - Only up-migrations are supported (no rollbacks — up-only as required).
 * - The runner is called once at startup before any other cache access.
 */

import type Database from "better-sqlite3";
import log from "../logger.js";
import { MIGRATIONS } from "./schema.js";

/**
 * Returns the set of migration versions already applied to the given database.
 * Returns an empty Set if the schema_migrations table does not yet exist.
 */
function appliedVersions(db: Database.Database): Set<number> {
  const tableExists = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name = 'schema_migrations'`
    )
    .get();

  if (!tableExists) return new Set<number>();

  const rows = db
    .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
    .all() as Array<{ version: number }>;

  return new Set(rows.map((r) => r.version));
}

/**
 * Apply all pending migrations in a single atomic transaction.
 * Already-applied versions are skipped.
 *
 * @param db - An open better-sqlite3 Database instance.
 * @returns The number of new migrations applied.
 */
export function runMigrations(db: Database.Database): number {
  const applied = appliedVersions(db);
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version));

  if (pending.length === 0) {
    log.info("[CacheDB] Migrations: schema is up to date.");
    return 0;
  }

  log.info(`[CacheDB] Migrations: applying ${pending.length} migration(s)…`);

  const applyAll = db.transaction(() => {
    for (const migration of pending) {
      log.info(`[CacheDB] Applying migration v${migration.version}: ${migration.description}`);
      db.exec(migration.sql);
      db.prepare(
        "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)"
      ).run(migration.version, Date.now());
    }
  });

  applyAll();

  log.info(`[CacheDB] Migrations: ${pending.length} migration(s) applied.`);
  return pending.length;
}
