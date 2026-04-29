/**
 * SecretStore — OS-keychain abstraction for all secret material in nango-gui.
 *
 * All secrets flow through this module. No plaintext is ever written to disk.
 * Secrets are encrypted with Electron's safeStorage (OS-backed: macOS Keychain,
 * Windows DPAPI, Linux libsecret) and stored under the userData directory.
 *
 * ## Namespace contract
 * Keys follow the pattern `<namespace>:<id>:<field>` (colon-delimited):
 *   - `env:{envId}:secretKey`          – Nango environment secret key
 *   - `cache:encryptionKey`            – local cache encryption key
 *   - `oauth-app:{integrationId}:clientSecret` – OAuth app client secret
 *
 * See README.md for the full namespace reference.
 */

import { safeStorage, app } from "electron";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
} from "fs";
import { join } from "path";
import log from "../logger.js";

/** Directory inside userData that holds all secret blobs. */
function secretsDir(): string {
  return join(app.getPath("userData"), "secrets");
}

/** Stable file path for a given fully-qualified key. */
function secretPath(key: string): string {
  // Replace path-unsafe chars so the key can be used as a filename.
  const safe = key.replace(/[<>:"/\\|?*]/g, "_");
  return join(secretsDir(), `${safe}.enc`);
}

/** Path to the namespace index that enables listByNamespace(). */
function indexPath(): string {
  return join(secretsDir(), "_index.json");
}

function ensureDir(): void {
  const dir = secretsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readIndex(): Record<string, string[]> {
  const path = indexPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function writeIndex(index: Record<string, string[]>): void {
  writeFileSync(indexPath(), JSON.stringify(index));
}

function namespaceOf(key: string): string {
  // The namespace is everything up to (and not including) the first segment
  // that differs between keys in the same logical group.
  // Concretely: the namespace is the first colon-delimited segment.
  return key.split(":")[0] ?? key;
}

function addToIndex(key: string): void {
  const ns = namespaceOf(key);
  const index = readIndex();
  const existing = index[ns] ?? [];
  if (!existing.includes(key)) {
    index[ns] = [...existing, key];
    writeIndex(index);
  }
}

function removeFromIndex(key: string): void {
  const ns = namespaceOf(key);
  const index = readIndex();
  if (!index[ns]) return;
  index[ns] = index[ns].filter((k) => k !== key);
  if (index[ns].length === 0) delete index[ns];
  writeIndex(index);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve the secret stored under `key`, or `null` if not present.
 */
export function getSecret(key: string): string | null {
  const path = secretPath(key);
  if (!existsSync(path)) return null;
  try {
    const encrypted = readFileSync(path);
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

/**
 * Encrypt and persist a secret under `key`.
 * Throws if OS-level encryption is unavailable.
 */
export function setSecret(key: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "OS-level encryption is not available on this system. Cannot store secrets."
    );
  }
  ensureDir();
  const encrypted = safeStorage.encryptString(value);
  writeFileSync(secretPath(key), encrypted);
  addToIndex(key);
}

/**
 * Delete the secret stored under `key`.
 * Returns `true` if a secret was removed, `false` if it did not exist.
 */
export function deleteSecret(key: string): boolean {
  const path = secretPath(key);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  removeFromIndex(key);
  return true;
}

/**
 * List all keys (and their decrypted values) for a given namespace prefix.
 *
 * @example
 *   listByNamespace("env")
 *   // → [{ key: "env:prod:secretKey", value: "sk-..." }, ...]
 */
export function listByNamespace(
  namespace: string
): Array<{ key: string; value: string }> {
  const index = readIndex();
  const keys = index[namespace] ?? [];
  return keys.flatMap((key) => {
    const value = getSecret(key);
    return value !== null ? [{ key, value }] : [];
  });
}

/**
 * Whether OS-level encryption is available on this system.
 * Always check before calling `setSecret()` in contexts where it may not be.
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

// ── Named key helpers ────────────────────────────────────────────────────────
// These are thin wrappers that enforce the namespace contract at the type level.

export const SecretKeys = {
  envSecretKey: (envId: string) => `env:${envId}:secretKey`,
  cacheEncryptionKey: () => `cache:encryptionKey`,
  oauthClientSecret: (integrationId: string) =>
    `oauth-app:${integrationId}:clientSecret`,
} as const;

export const SecretStore = {
  get: getSecret,
  set: setSecret,
  delete: deleteSecret,
  listByNamespace,
  isAvailable: isEncryptionAvailable,
  keys: SecretKeys,
} as const;

export type { SecretStore };

/**
 * Run the one-time migration: read any legacy credential-store files, write
 * the secrets into SecretStore, then delete the legacy files.
 *
 * Safe to call on every startup — it is a no-op if migration has already run.
 */
export async function migrateFromLegacyCredentialStore(): Promise<void> {
  const userData = app.getPath("userData");
  await _migrateFromLegacyCredentialStoreInDir(userData);
}

/**
 * Testable inner implementation (accepts an injectable userData path).
 * @internal
 */
export async function _migrateFromLegacyCredentialStoreInDir(
  userData: string
): Promise<void> {
  const legacyFiles: Array<{
    file: string;
    secretKey: string;
    label: string;
  }> = [
    {
      file: "credentials.enc",
      secretKey: "env:default:secretKey",
      label: "Nango secret key",
    },
    {
      file: "ai-key-openai.enc",
      secretKey: "ai-provider:openai:apiKey",
      label: "OpenAI API key",
    },
    {
      file: "ai-key-anthropic.enc",
      secretKey: "ai-provider:anthropic:apiKey",
      label: "Anthropic API key",
    },
  ];

  let migrated = 0;
  for (const { file, secretKey, label } of legacyFiles) {
    const legacyPath = join(userData, file);
    if (!existsSync(legacyPath)) continue;

    // Skip if already migrated
    if (getSecret(secretKey) !== null) {
      log.info(`[SecretStore] migration: ${label} already in SecretStore, removing legacy file`);
      unlinkSync(legacyPath);
      migrated++;
      continue;
    }

    try {
      const encrypted = readFileSync(legacyPath);
      const plaintext = safeStorage.decryptString(encrypted);
      setSecret(secretKey, plaintext);
      unlinkSync(legacyPath);
      log.info(`[SecretStore] migration: migrated ${label} to SecretStore, deleted legacy file`);
      migrated++;
    } catch (err) {
      log.warn(`[SecretStore] migration: failed to migrate ${label} — ${String(err)}`);
    }
  }

  if (migrated > 0) {
    log.info(`[SecretStore] migration complete: ${migrated} secret(s) moved to OS keychain`);
  }
}
