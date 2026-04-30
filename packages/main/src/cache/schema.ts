/**
 * cache/schema.ts — v0 schema definition and ordered migration steps.
 *
 * Each migration is an immutable SQL string. The migrations runner in
 * migrations.ts applies them in version order inside a single transaction,
 * records the version in `schema_migrations`, and skips already-applied
 * versions — making repeated runs a no-op.
 *
 * Columns suffixed `_enc` hold AES-256-GCM ciphertext produced by
 * cache/encryption.ts. Integer columns (IDs, timestamps, counts) are stored
 * in plaintext for query performance; they carry no sensitive data on their own.
 */

export interface Migration {
  version: number;
  description: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: "v0 schema — schema_migrations table",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     INTEGER PRIMARY KEY,
        applied_at  INTEGER NOT NULL
      );
    `,
  },
  {
    version: 2,
    description: "v0 schema — connections table",
    sql: `
      CREATE TABLE IF NOT EXISTS connections (
        id              TEXT    PRIMARY KEY,
        integration_id  TEXT    NOT NULL,
        environment_id  TEXT    NOT NULL,
        display_name    TEXT,
        status          TEXT    NOT NULL,
        metadata_enc    TEXT,
        synced_at       INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_connections_integration
        ON connections(integration_id);
      CREATE INDEX IF NOT EXISTS idx_connections_environment
        ON connections(environment_id);
    `,
  },
  {
    version: 3,
    description: "v0 schema — syncs table",
    sql: `
      CREATE TABLE IF NOT EXISTS syncs (
        id              TEXT    PRIMARY KEY,
        connection_id   TEXT    NOT NULL,
        integration_id  TEXT    NOT NULL,
        name            TEXT    NOT NULL,
        status          TEXT    NOT NULL,
        frequency       TEXT,
        last_sync_date  TEXT,
        next_sync_date  TEXT,
        synced_at       INTEGER NOT NULL,
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_syncs_connection
        ON syncs(connection_id);
    `,
  },
  {
    version: 4,
    description: "v0 schema — records table",
    sql: `
      CREATE TABLE IF NOT EXISTS records (
        id            TEXT    PRIMARY KEY,
        sync_id       TEXT    NOT NULL,
        connection_id TEXT    NOT NULL,
        model         TEXT    NOT NULL,
        data_enc      TEXT    NOT NULL,
        external_id   TEXT,
        synced_at     INTEGER NOT NULL,
        FOREIGN KEY (sync_id) REFERENCES syncs(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_records_sync
        ON records(sync_id);
      CREATE INDEX IF NOT EXISTS idx_records_connection_model
        ON records(connection_id, model);
    `,
  },
  {
    version: 5,
    description: "v0 schema — logs table",
    sql: `
      CREATE TABLE IF NOT EXISTS logs (
        id          TEXT    PRIMARY KEY,
        level       TEXT    NOT NULL,
        message_enc TEXT    NOT NULL,
        context_enc TEXT,
        created_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_logs_created_at
        ON logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_logs_level
        ON logs(level);
    `,
  },
  {
    version: 6,
    description: "v0 schema — webhook_events table",
    sql: `
      CREATE TABLE IF NOT EXISTS webhook_events (
        id          TEXT    PRIMARY KEY,
        received_at INTEGER NOT NULL,
        type        TEXT    NOT NULL,
        integration TEXT,
        connection  TEXT,
        payload_enc TEXT    NOT NULL,
        processed   INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
        ON webhook_events(received_at);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_type
        ON webhook_events(type);
    `,
  },
  {
    version: 7,
    description: "v0 schema — dryrun_runs table",
    sql: `
      CREATE TABLE IF NOT EXISTS dryrun_runs (
        id              TEXT    PRIMARY KEY,
        integration_id  TEXT    NOT NULL,
        sync_name       TEXT    NOT NULL,
        connection_id   TEXT    NOT NULL,
        status          TEXT    NOT NULL,
        started_at      INTEGER NOT NULL,
        completed_at    INTEGER,
        result_enc      TEXT,
        error_enc       TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_dryrun_runs_integration
        ON dryrun_runs(integration_id);
      CREATE INDEX IF NOT EXISTS idx_dryrun_runs_started_at
        ON dryrun_runs(started_at);
    `,
  },
  {
    version: 8,
    description: "v0 schema — mcp_tool_calls table (F1 Tool Call Log)",
    sql: `
      CREATE TABLE IF NOT EXISTS mcp_tool_calls (
        id             TEXT    PRIMARY KEY,
        session_id     TEXT    NOT NULL,
        tool_name      TEXT    NOT NULL,
        arguments_enc  TEXT    NOT NULL,
        result_enc     TEXT,
        error_enc      TEXT,
        started_at     INTEGER NOT NULL,
        completed_at   INTEGER,
        duration_ms    INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_session
        ON mcp_tool_calls(session_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_tool_name
        ON mcp_tool_calls(tool_name);
      CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_started_at
        ON mcp_tool_calls(started_at);
    `,
  },
] as const;
