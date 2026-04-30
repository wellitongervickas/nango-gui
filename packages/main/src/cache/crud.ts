/**
 * cache/crud.ts — Typed CRUD operations for every cache table.
 *
 * All methods that read or write user-data columns apply AES-256-GCM
 * encryption/decryption transparently via cache/encryption.ts.
 * Integer columns (IDs, timestamps, status codes) are stored in plaintext
 * for query performance — they contain no sensitive data in isolation.
 */

import { randomUUID } from "node:crypto";
import { getCacheDb } from "./cache-db.js";
import {
  encrypt,
  decrypt,
  encryptNullable,
  decryptNullable,
  encryptJson,
  decryptJson,
} from "./encryption.js";

// ── Type definitions ─────────────────────────────────────────────────────────

export interface CachedConnection {
  id: string;
  integration_id: string;
  environment_id: string;
  display_name: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  synced_at: number;
  updated_at: number;
}

export interface CachedSync {
  id: string;
  connection_id: string;
  integration_id: string;
  name: string;
  status: string;
  frequency: string | null;
  last_sync_date: string | null;
  next_sync_date: string | null;
  synced_at: number;
}

export interface CachedRecord {
  id: string;
  sync_id: string;
  connection_id: string;
  model: string;
  data: Record<string, unknown>;
  external_id: string | null;
  synced_at: number;
}

export interface CachedLog {
  id: string;
  level: string;
  message: string;
  context: Record<string, unknown> | null;
  created_at: number;
}

export interface CachedWebhookEvent {
  id: string;
  received_at: number;
  type: string;
  integration: string | null;
  connection: string | null;
  payload: Record<string, unknown>;
  processed: number;
}

export interface CachedDryrunRun {
  id: string;
  integration_id: string;
  sync_name: string;
  connection_id: string;
  status: string;
  started_at: number;
  completed_at: number | null;
  result: unknown | null;
  error: string | null;
}

export interface CachedMcpToolCall {
  id: string;
  session_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  result: unknown | null;
  error: string | null;
  started_at: number;
  completed_at: number | null;
  duration_ms: number | null;
}

// ── Raw DB row types (encrypted columns are strings) ────────────────────────

type ConnectionRow = {
  id: string; integration_id: string; environment_id: string;
  display_name: string | null; status: string; metadata_enc: string | null;
  synced_at: number; updated_at: number;
};
type SyncRow = {
  id: string; connection_id: string; integration_id: string; name: string;
  status: string; frequency: string | null; last_sync_date: string | null;
  next_sync_date: string | null; synced_at: number;
};
type RecordRow = {
  id: string; sync_id: string; connection_id: string; model: string;
  data_enc: string; external_id: string | null; synced_at: number;
};
type LogRow = {
  id: string; level: string; message_enc: string; context_enc: string | null;
  created_at: number;
};
type WebhookEventRow = {
  id: string; received_at: number; type: string; integration: string | null;
  connection: string | null; payload_enc: string; processed: number;
};
type DryrunRunRow = {
  id: string; integration_id: string; sync_name: string; connection_id: string;
  status: string; started_at: number; completed_at: number | null;
  result_enc: string | null; error_enc: string | null;
};
type McpToolCallRow = {
  id: string; session_id: string; tool_name: string; arguments_enc: string;
  result_enc: string | null; error_enc: string | null; started_at: number;
  completed_at: number | null; duration_ms: number | null;
};

// ── Row decryptors ───────────────────────────────────────────────────────────

function decryptConnection(row: ConnectionRow, key: Buffer): CachedConnection {
  return {
    id: row.id,
    integration_id: row.integration_id,
    environment_id: row.environment_id,
    display_name: row.display_name,
    status: row.status,
    metadata: decryptJson(row.metadata_enc, key),
    synced_at: row.synced_at,
    updated_at: row.updated_at,
  };
}

function decryptSync(row: SyncRow): CachedSync {
  return { ...row }; // no encrypted columns in syncs
}

function decryptRecord(row: RecordRow, key: Buffer): CachedRecord {
  return {
    id: row.id,
    sync_id: row.sync_id,
    connection_id: row.connection_id,
    model: row.model,
    data: decryptJson<Record<string, unknown>>(row.data_enc, key) ?? {},
    external_id: row.external_id,
    synced_at: row.synced_at,
  };
}

function decryptLog(row: LogRow, key: Buffer): CachedLog {
  return {
    id: row.id,
    level: row.level,
    message: decrypt(row.message_enc, key),
    context: decryptJson(row.context_enc, key),
    created_at: row.created_at,
  };
}

function decryptWebhookEvent(row: WebhookEventRow, key: Buffer): CachedWebhookEvent {
  return {
    id: row.id,
    received_at: row.received_at,
    type: row.type,
    integration: row.integration,
    connection: row.connection,
    payload: decryptJson<Record<string, unknown>>(row.payload_enc, key) ?? {},
    processed: row.processed,
  };
}

function decryptDryrunRun(row: DryrunRunRow, key: Buffer): CachedDryrunRun {
  return {
    id: row.id,
    integration_id: row.integration_id,
    sync_name: row.sync_name,
    connection_id: row.connection_id,
    status: row.status,
    started_at: row.started_at,
    completed_at: row.completed_at,
    result: decryptJson(row.result_enc, key),
    error: decryptNullable(row.error_enc, key),
  };
}

function decryptMcpToolCall(row: McpToolCallRow, key: Buffer): CachedMcpToolCall {
  return {
    id: row.id,
    session_id: row.session_id,
    tool_name: row.tool_name,
    arguments: decryptJson<Record<string, unknown>>(row.arguments_enc, key) ?? {},
    result: decryptJson(row.result_enc, key),
    error: decryptNullable(row.error_enc, key),
    started_at: row.started_at,
    completed_at: row.completed_at,
    duration_ms: row.duration_ms,
  };
}

// ── connections ──────────────────────────────────────────────────────────────

export function listConnections(
  opts: { environment_id?: string; integration_id?: string; limit?: number; offset?: number } = {}
): CachedConnection[] {
  const { db, key } = getCacheDb();
  let sql = "SELECT * FROM connections";
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (opts.environment_id) { conditions.push("environment_id = ?"); params.push(opts.environment_id); }
  if (opts.integration_id) { conditions.push("integration_id = ?"); params.push(opts.integration_id); }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY updated_at DESC";
  if (opts.limit !== undefined) { sql += " LIMIT ?"; params.push(opts.limit); }
  if (opts.offset !== undefined) { sql += " OFFSET ?"; params.push(opts.offset); }
  return (db.prepare(sql).all(...params) as ConnectionRow[]).map((r) => decryptConnection(r, key));
}

export function getConnection(id: string): CachedConnection | null {
  const { db, key } = getCacheDb();
  const row = db.prepare("SELECT * FROM connections WHERE id = ?").get(id) as ConnectionRow | undefined;
  return row ? decryptConnection(row, key) : null;
}

export function upsertConnection(conn: CachedConnection): void {
  const { db, key } = getCacheDb();
  db.prepare(`
    INSERT INTO connections
      (id, integration_id, environment_id, display_name, status, metadata_enc, synced_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      integration_id  = excluded.integration_id,
      environment_id  = excluded.environment_id,
      display_name    = excluded.display_name,
      status          = excluded.status,
      metadata_enc    = excluded.metadata_enc,
      synced_at       = excluded.synced_at,
      updated_at      = excluded.updated_at
  `).run(
    conn.id,
    conn.integration_id,
    conn.environment_id,
    conn.display_name,
    conn.status,
    encryptJson(conn.metadata, key),
    conn.synced_at,
    conn.updated_at,
  );
}

export function deleteConnection(id: string): void {
  const { db } = getCacheDb();
  db.prepare("DELETE FROM connections WHERE id = ?").run(id);
}

// ── syncs ────────────────────────────────────────────────────────────────────

export function listSyncs(opts: { connection_id?: string; integration_id?: string } = {}): CachedSync[] {
  const { db } = getCacheDb();
  let sql = "SELECT * FROM syncs";
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (opts.connection_id) { conditions.push("connection_id = ?"); params.push(opts.connection_id); }
  if (opts.integration_id) { conditions.push("integration_id = ?"); params.push(opts.integration_id); }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY synced_at DESC";
  return (db.prepare(sql).all(...params) as SyncRow[]).map(decryptSync);
}

export function getSync(id: string): CachedSync | null {
  const { db } = getCacheDb();
  const row = db.prepare("SELECT * FROM syncs WHERE id = ?").get(id) as SyncRow | undefined;
  return row ? decryptSync(row) : null;
}

export function upsertSync(sync: CachedSync): void {
  const { db } = getCacheDb();
  db.prepare(`
    INSERT INTO syncs
      (id, connection_id, integration_id, name, status, frequency, last_sync_date, next_sync_date, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      connection_id  = excluded.connection_id,
      integration_id = excluded.integration_id,
      name           = excluded.name,
      status         = excluded.status,
      frequency      = excluded.frequency,
      last_sync_date = excluded.last_sync_date,
      next_sync_date = excluded.next_sync_date,
      synced_at      = excluded.synced_at
  `).run(
    sync.id, sync.connection_id, sync.integration_id, sync.name,
    sync.status, sync.frequency, sync.last_sync_date, sync.next_sync_date, sync.synced_at,
  );
}

export function deleteSync(id: string): void {
  const { db } = getCacheDb();
  db.prepare("DELETE FROM syncs WHERE id = ?").run(id);
}

// ── records ──────────────────────────────────────────────────────────────────

export function listRecords(
  opts: { sync_id?: string; connection_id?: string; model?: string; limit?: number; offset?: number } = {}
): CachedRecord[] {
  const { db, key } = getCacheDb();
  let sql = "SELECT * FROM records";
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (opts.sync_id) { conditions.push("sync_id = ?"); params.push(opts.sync_id); }
  if (opts.connection_id) { conditions.push("connection_id = ?"); params.push(opts.connection_id); }
  if (opts.model) { conditions.push("model = ?"); params.push(opts.model); }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY synced_at DESC";
  if (opts.limit !== undefined) { sql += " LIMIT ?"; params.push(opts.limit); }
  if (opts.offset !== undefined) { sql += " OFFSET ?"; params.push(opts.offset); }
  return (db.prepare(sql).all(...params) as RecordRow[]).map((r) => decryptRecord(r, key));
}

export function getRecord(id: string): CachedRecord | null {
  const { db, key } = getCacheDb();
  const row = db.prepare("SELECT * FROM records WHERE id = ?").get(id) as RecordRow | undefined;
  return row ? decryptRecord(row, key) : null;
}

export function upsertRecord(record: CachedRecord): void {
  const { db, key } = getCacheDb();
  db.prepare(`
    INSERT INTO records (id, sync_id, connection_id, model, data_enc, external_id, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sync_id       = excluded.sync_id,
      connection_id = excluded.connection_id,
      model         = excluded.model,
      data_enc      = excluded.data_enc,
      external_id   = excluded.external_id,
      synced_at     = excluded.synced_at
  `).run(
    record.id, record.sync_id, record.connection_id, record.model,
    encrypt(JSON.stringify(record.data), key), record.external_id, record.synced_at,
  );
}

export function deleteRecord(id: string): void {
  const { db } = getCacheDb();
  db.prepare("DELETE FROM records WHERE id = ?").run(id);
}

export function deleteRecordsBySync(sync_id: string): void {
  const { db } = getCacheDb();
  db.prepare("DELETE FROM records WHERE sync_id = ?").run(sync_id);
}

// ── logs ─────────────────────────────────────────────────────────────────────

export function listLogs(
  opts: { level?: string; limit?: number; offset?: number } = {}
): CachedLog[] {
  const { db, key } = getCacheDb();
  let sql = "SELECT * FROM logs";
  const params: unknown[] = [];
  if (opts.level) { sql += " WHERE level = ?"; params.push(opts.level); }
  sql += " ORDER BY created_at DESC";
  if (opts.limit !== undefined) { sql += " LIMIT ?"; params.push(opts.limit); }
  if (opts.offset !== undefined) { sql += " OFFSET ?"; params.push(opts.offset); }
  return (db.prepare(sql).all(...params) as LogRow[]).map((r) => decryptLog(r, key));
}

export function getLog(id: string): CachedLog | null {
  const { db, key } = getCacheDb();
  const row = db.prepare("SELECT * FROM logs WHERE id = ?").get(id) as LogRow | undefined;
  return row ? decryptLog(row, key) : null;
}

export function insertLog(entry: Omit<CachedLog, "id">): string {
  const { db, key } = getCacheDb();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO logs (id, level, message_enc, context_enc, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id, entry.level,
    encrypt(entry.message, key),
    encryptJson(entry.context, key),
    entry.created_at,
  );
  return id;
}

// ── webhook_events ───────────────────────────────────────────────────────────

export function listWebhookEvents(
  opts: { type?: string; processed?: number; limit?: number; offset?: number } = {}
): CachedWebhookEvent[] {
  const { db, key } = getCacheDb();
  let sql = "SELECT * FROM webhook_events";
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (opts.type) { conditions.push("type = ?"); params.push(opts.type); }
  if (opts.processed !== undefined) { conditions.push("processed = ?"); params.push(opts.processed); }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY received_at DESC";
  if (opts.limit !== undefined) { sql += " LIMIT ?"; params.push(opts.limit); }
  if (opts.offset !== undefined) { sql += " OFFSET ?"; params.push(opts.offset); }
  return (db.prepare(sql).all(...params) as WebhookEventRow[]).map((r) => decryptWebhookEvent(r, key));
}

export function getWebhookEvent(id: string): CachedWebhookEvent | null {
  const { db, key } = getCacheDb();
  const row = db.prepare("SELECT * FROM webhook_events WHERE id = ?").get(id) as WebhookEventRow | undefined;
  return row ? decryptWebhookEvent(row, key) : null;
}

export function insertWebhookEvent(event: Omit<CachedWebhookEvent, "processed">): void {
  const { db, key } = getCacheDb();
  db.prepare(`
    INSERT OR IGNORE INTO webhook_events
      (id, received_at, type, integration, connection, payload_enc, processed)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(
    event.id, event.received_at, event.type,
    event.integration, event.connection,
    encrypt(JSON.stringify(event.payload), key),
  );
}

export function markWebhookEventProcessed(id: string): void {
  const { db } = getCacheDb();
  db.prepare("UPDATE webhook_events SET processed = 1 WHERE id = ?").run(id);
}

export function deleteWebhookEvent(id: string): void {
  const { db } = getCacheDb();
  db.prepare("DELETE FROM webhook_events WHERE id = ?").run(id);
}

// ── dryrun_runs ──────────────────────────────────────────────────────────────

export function listDryrunRuns(
  opts: { integration_id?: string; connection_id?: string; limit?: number; offset?: number } = {}
): CachedDryrunRun[] {
  const { db, key } = getCacheDb();
  let sql = "SELECT * FROM dryrun_runs";
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (opts.integration_id) { conditions.push("integration_id = ?"); params.push(opts.integration_id); }
  if (opts.connection_id) { conditions.push("connection_id = ?"); params.push(opts.connection_id); }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY started_at DESC";
  if (opts.limit !== undefined) { sql += " LIMIT ?"; params.push(opts.limit); }
  if (opts.offset !== undefined) { sql += " OFFSET ?"; params.push(opts.offset); }
  return (db.prepare(sql).all(...params) as DryrunRunRow[]).map((r) => decryptDryrunRun(r, key));
}

export function getDryrunRun(id: string): CachedDryrunRun | null {
  const { db, key } = getCacheDb();
  const row = db.prepare("SELECT * FROM dryrun_runs WHERE id = ?").get(id) as DryrunRunRow | undefined;
  return row ? decryptDryrunRun(row, key) : null;
}

export function insertDryrunRun(run: CachedDryrunRun): void {
  const { db, key } = getCacheDb();
  db.prepare(`
    INSERT INTO dryrun_runs
      (id, integration_id, sync_name, connection_id, status, started_at, completed_at, result_enc, error_enc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status       = excluded.status,
      completed_at = excluded.completed_at,
      result_enc   = excluded.result_enc,
      error_enc    = excluded.error_enc
  `).run(
    run.id, run.integration_id, run.sync_name, run.connection_id,
    run.status, run.started_at, run.completed_at,
    encryptJson(run.result, key),
    encryptNullable(run.error, key),
  );
}

export function deleteDryrunRun(id: string): void {
  const { db } = getCacheDb();
  db.prepare("DELETE FROM dryrun_runs WHERE id = ?").run(id);
}

// ── mcp_tool_calls ───────────────────────────────────────────────────────────

export function listMcpToolCalls(
  opts: { session_id?: string; tool_name?: string; limit?: number; offset?: number } = {}
): CachedMcpToolCall[] {
  const { db, key } = getCacheDb();
  let sql = "SELECT * FROM mcp_tool_calls";
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (opts.session_id) { conditions.push("session_id = ?"); params.push(opts.session_id); }
  if (opts.tool_name) { conditions.push("tool_name = ?"); params.push(opts.tool_name); }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY started_at DESC";
  if (opts.limit !== undefined) { sql += " LIMIT ?"; params.push(opts.limit); }
  if (opts.offset !== undefined) { sql += " OFFSET ?"; params.push(opts.offset); }
  return (db.prepare(sql).all(...params) as McpToolCallRow[]).map((r) => decryptMcpToolCall(r, key));
}

export function getMcpToolCall(id: string): CachedMcpToolCall | null {
  const { db, key } = getCacheDb();
  const row = db.prepare("SELECT * FROM mcp_tool_calls WHERE id = ?").get(id) as McpToolCallRow | undefined;
  return row ? decryptMcpToolCall(row, key) : null;
}

export function insertMcpToolCall(call: CachedMcpToolCall): void {
  const { db, key } = getCacheDb();
  db.prepare(`
    INSERT INTO mcp_tool_calls
      (id, session_id, tool_name, arguments_enc, result_enc, error_enc,
       started_at, completed_at, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      result_enc   = excluded.result_enc,
      error_enc    = excluded.error_enc,
      completed_at = excluded.completed_at,
      duration_ms  = excluded.duration_ms
  `).run(
    call.id, call.session_id, call.tool_name,
    encrypt(JSON.stringify(call.arguments), key),
    encryptJson(call.result, key),
    encryptNullable(call.error, key),
    call.started_at, call.completed_at, call.duration_ms,
  );
}

export function deleteMcpToolCall(id: string): void {
  const { db } = getCacheDb();
  db.prepare("DELETE FROM mcp_tool_calls WHERE id = ?").run(id);
}
