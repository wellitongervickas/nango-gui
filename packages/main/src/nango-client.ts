import type { Nango } from "@nangohq/node";

// Lazily-initialized singleton. The secret key is injected at runtime by the
// credential store (M1.3) — never hard-coded.
let _instance: Nango | null = null;
let _secretKey: string | null = null;

/**
 * Initialize (or re-initialize) the Nango SDK client with a secret key.
 * Safe to call multiple times; replaces the existing instance.
 */
export async function initNangoClient(secretKey: string): Promise<Nango> {
  const { Nango } = await import("@nangohq/node");
  _instance = new Nango({ secretKey });
  _secretKey = secretKey;
  return _instance;
}

/**
 * Return the current Nango client. Throws if not yet initialized.
 */
export function getNangoClient(): Nango {
  if (!_instance) {
    throw new Error(
      "Nango client not initialized. Call initNangoClient() first."
    );
  }
  return _instance;
}

/**
 * Check whether the client is ready to use.
 */
export function isNangoClientReady(): boolean {
  return _instance !== null;
}

/**
 * Dispose the current client (used on credentials:clear).
 */
export function resetNangoClient(): void {
  _instance = null;
  _secretKey = null;
}

/**
 * Validate a secret key by making a lightweight Nango API call.
 * Returns true when the key is accepted; false on 401/403; throws on network error.
 */
export async function validateNangoKey(secretKey: string): Promise<boolean> {
  const { Nango } = await import("@nangohq/node");
  const client = new Nango({ secretKey });
  try {
    await client.listConnections();
    return true;
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) return false;
    throw err;
  }
}
