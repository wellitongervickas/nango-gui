/**
 * Scope discovery helpers for the "Suggest scopes" OAuth2 UX (NANA-221).
 *
 * The IPC backend (`window.nango.suggestScopes`) is implemented in NANA-202.
 * Until that lands, `discoverScopes` returns `{ supported: false }` as a safe
 * fallback so the UI degrades gracefully without throwing.
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

  // Guard until NANA-202 ships the IPC implementation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suggestFn = (window.nango as any).suggestScopes;
  if (typeof suggestFn !== "function") {
    return { supported: false };
  }

  const res = await suggestFn(providerKey);
  if (res.status === "error") {
    throw new Error(res.error ?? "Scope discovery failed");
  }

  return res.data as DiscoverScopesResult;
}
