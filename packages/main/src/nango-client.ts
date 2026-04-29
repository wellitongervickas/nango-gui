import type { Nango } from "@nangohq/node";
import type { NangoEnvironment } from "@nango-gui/shared";

/**
 * Environment-scoped Nango client factory.
 *
 * Architectural mandate (NANA-263): every Nango call/IPC channel must be
 * parameterized by the active environment id. The renderer never imports
 * `@nangohq/node` or hits `api.nango.dev` directly — every call goes through
 * the IPC bridge, which resolves a client via this factory using the
 * currently active environment.
 *
 * Per-environment instances are cached so that switching back to a previously
 * used environment is instant. Re-registering a key for the same environment
 * replaces the cached client.
 */

interface EnvironmentEntry {
  client: Nango;
  secretKey: string;
}

const _clients = new Map<NangoEnvironment, EnvironmentEntry>();
let _activeEnvironment: NangoEnvironment | null = null;

/**
 * Register (or replace) the Nango secret key for a specific environment and
 * build a client for it. Marks that environment as the active one.
 */
export async function registerEnvironmentClient(
  environment: NangoEnvironment,
  secretKey: string
): Promise<Nango> {
  const { Nango } = await import("@nangohq/node");
  const client = new Nango({ secretKey });
  _clients.set(environment, { client, secretKey });
  _activeEnvironment = environment;
  return client;
}

/**
 * Set the active environment without changing its credentials. Throws if no
 * client has been registered for the environment yet — callers should
 * register a key first via `registerEnvironmentClient`.
 */
export function setActiveEnvironment(environment: NangoEnvironment): void {
  if (!_clients.has(environment)) {
    throw new Error(
      `No Nango client registered for environment "${environment}". Register a secret key first.`
    );
  }
  _activeEnvironment = environment;
}

/**
 * Return the currently active environment id, or null if none is active.
 */
export function getActiveEnvironment(): NangoEnvironment | null {
  return _activeEnvironment;
}

/**
 * Return the Nango client for a given environment, throwing if not registered.
 */
export function getClientForEnvironment(environment: NangoEnvironment): Nango {
  const entry = _clients.get(environment);
  if (!entry) {
    throw new Error(
      `Nango client not initialized for environment "${environment}". Please configure your API key in Settings.`
    );
  }
  return entry.client;
}

/**
 * Return the Nango client bound to the currently active environment.
 * This is the canonical accessor used by IPC handlers — every Nango call is
 * implicitly scoped to whichever environment was last activated.
 */
export function getActiveClient(): Nango {
  if (!_activeEnvironment) {
    throw new Error(
      "Nango client not initialized. Please configure your API key in Settings."
    );
  }
  return getClientForEnvironment(_activeEnvironment);
}

/**
 * Whether a client is currently usable for the active environment.
 */
export function isActiveClientReady(): boolean {
  return _activeEnvironment !== null && _clients.has(_activeEnvironment);
}

/**
 * Drop the cached client for a single environment.
 */
export function clearEnvironmentClient(environment: NangoEnvironment): void {
  _clients.delete(environment);
  if (_activeEnvironment === environment) {
    _activeEnvironment = null;
  }
}

/**
 * Drop every cached client and unset the active environment.
 * Used on credentials:clear.
 */
export function clearAllEnvironmentClients(): void {
  _clients.clear();
  _activeEnvironment = null;
}

/**
 * Validate a secret key by making a lightweight Nango API call.
 * Returns true when the key is accepted; false on 401/403; throws on network error.
 *
 * This intentionally does NOT cache the constructed client — validation is a
 * pre-flight check that must not pollute the per-environment cache.
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

// ── Reachability heuristic (Feature 7 offline detection) ─────────────────────

/**
 * The classification returned by the reachability probe. `online` means the
 * Nango API answered (even with a 4xx/5xx); `offline` means the request never
 * left the device or DNS/socket failed before any response.
 */
export type ReachabilityState = "online" | "offline" | "degraded";

export interface ReachabilityResult {
  state: ReachabilityState;
  /** Round-trip latency in ms when state is online/degraded. Null if offline. */
  latencyMs: number | null;
  /** HTTP status returned by the probe, when state is online/degraded. */
  httpStatus: number | null;
  /** Underlying error message when state is offline. */
  error: string | null;
  /** ISO timestamp of the probe. */
  checkedAt: string;
}

const DEFAULT_REACHABILITY_TIMEOUT_MS = 4000;

/**
 * Probe the Nango control plane to distinguish "offline" (no network / DNS)
 * from "API unreachable but online" (server returned an error).
 *
 * Used by Feature 7 to render the correct banner: a true offline indicator
 * vs. a "Nango is having issues" message.
 *
 * The probe is unauthenticated and hits a known lightweight endpoint
 * (`/health`) so it works regardless of whether a key is configured.
 */
export async function probeReachability(
  baseUrl: string = "https://api.nango.dev",
  timeoutMs: number = DEFAULT_REACHABILITY_TIMEOUT_MS
): Promise<ReachabilityResult> {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;
    // Any HTTP response — even 5xx — proves the network reached Nango.
    return {
      state: res.ok ? "online" : "degraded",
      latencyMs,
      httpStatus: res.status,
      error: null,
      checkedAt,
    };
  } catch (err: unknown) {
    // AbortError, ENOTFOUND, ECONNREFUSED, EAI_AGAIN, fetch failed → no connectivity.
    const message = err instanceof Error ? err.message : String(err);
    return {
      state: "offline",
      latencyMs: null,
      httpStatus: null,
      error: message,
      checkedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

