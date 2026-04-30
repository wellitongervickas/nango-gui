/**
 * cache/encryption.ts — AES-256-GCM application-layer encryption for the
 * SQLite cache.
 *
 * ## Encryption strategy decision
 *
 * SQLCipher (file-level encryption) was evaluated first. `@journeyapps/sqlcipher`
 * v6.0.0 provides pre-built binaries for Electron, but pre-built availability for
 * Electron 35.7.5 (the version in use) could not be verified without running
 * `electron-rebuild` on all three target OS platforms (Windows, macOS, Linux).
 * Build failures on any platform would produce a broken release binary with no
 * safe fallback at runtime.
 *
 * Decision: **AES-256-GCM application-layer encryption** as documented in the
 * NANA-265 risk-mitigation plan ("fall back to AES-encrypted SQLite via
 * app-layer crypto"). All columns that contain user data are encrypted before
 * INSERT and decrypted after SELECT using the key sourced exclusively from
 * `SecretStore` namespace `cache:encryptionKey`. The SQLite file itself is not
 * readable by any caller that does not hold the plaintext key.
 *
 * This satisfies Architectural Mandate #6: no code path may bypass the
 * encrypted handle — all reads/writes flow through `CacheEncryption`.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type RawKey = Buffer; // 32 bytes

/**
 * Encrypt a string value with AES-256-GCM.
 * Returns a compact string: `<iv_hex>:<tag_hex>:<ciphertext_hex>`.
 * Returns `null` for `null` / `undefined` inputs (preserves SQL NULLs).
 */
export function encrypt(value: string, key: RawKey): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypt a value previously produced by `encrypt`.
 * Returns the original string on success.
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 */
export function decrypt(encoded: string, key: RawKey): string {
  const parts = encoded.split(":");
  if (parts.length !== 3) {
    throw new Error("[CacheEncryption] Invalid ciphertext format");
  }
  const [ivHex, tagHex, ciphertextHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Encrypt a nullable string — returns `null` unchanged (maps to SQL NULL).
 */
export function encryptNullable(value: string | null | undefined, key: RawKey): string | null {
  if (value === null || value === undefined) return null;
  return encrypt(value, key);
}

/**
 * Decrypt a nullable string — returns `null` unchanged.
 */
export function decryptNullable(encoded: string | null | undefined, key: RawKey): string | null {
  if (encoded === null || encoded === undefined) return null;
  return decrypt(encoded, key);
}

/**
 * Serialize an object to JSON and encrypt it.
 * Returns `null` if the value is `null` / `undefined`.
 */
export function encryptJson(value: unknown, key: RawKey): string | null {
  if (value === null || value === undefined) return null;
  return encrypt(JSON.stringify(value), key);
}

/**
 * Decrypt and deserialize a JSON-encoded encrypted value.
 * Returns `null` if the encoded value is `null` / `undefined`.
 */
export function decryptJson<T = unknown>(encoded: string | null | undefined, key: RawKey): T | null {
  if (encoded === null || encoded === undefined) return null;
  return JSON.parse(decrypt(encoded, key)) as T;
}
