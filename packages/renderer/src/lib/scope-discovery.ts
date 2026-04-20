/**
 * Scope discovery helpers for the "Suggest scopes" OAuth2 UX (NANA-202).
 *
 * Calls `window.nango.suggestScopes(providerKey)` which proxies through the
 * Electron IPC to the main process, fetches provider scope data from the
 * Nango API, and returns it in the renderer-friendly format below.
 */

/** A single scope entry returned by the scope discovery API. */
export interface SuggestedScope {
  /** The scope string (e.g. "read:user", "repo", "openid"). */
  scope: string;
  /** Human-readable description of what this scope grants. */
  description?: string;
  /**
   * When true this scope is pre-checked in the suggestion panel.
   * Recommended scopes cover the most common integration needs.
   */
  recommended: boolean;
}

/**
 * Result returned by the backend scope discovery API.
 * - `supported: true`  — scopes were discovered successfully.
 * - `supported: false` — this provider does not support auto-discovery yet.
 */
export type DiscoverScopesResult =
  | { supported: true; scopes: SuggestedScope[] }
  | { supported: false; docsUrl?: string };

/**
 * Ask Nango to auto-discover OAuth2 scopes for the given provider.
 *
 * @param providerKey - The Nango provider key (e.g. "github", "slack").
 * @returns A `DiscoverScopesResult` — either a list of scopes or a
 *   `{ supported: false }` signal when the provider is not yet supported.
 * @throws When the Nango API is unavailable or returns a server error.
 */
export async function discoverScopes(
  providerKey: string
): Promise<DiscoverScopesResult> {
  if (!window.nango) {
    throw new Error("Nango API not available");
  }

  const res = await window.nango.suggestScopes(providerKey);
  if (res.status === "error") {
    throw new Error(res.error ?? "Scope discovery failed");
  }

  return res.data as DiscoverScopesResult;
}
