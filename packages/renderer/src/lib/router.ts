import { useSyncExternalStore } from "react";

// ── Hash parsing ────────────────────────────────────────────────────────────

export function parseHash(): string {
  return window.location.hash.replace(/^#\/?/, "") || "/";
}

// ── Subscription (useSyncExternalStore) ─────────────────────────────────────

function subscribeToHash(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

/**
 * Reactive hash-route hook.  Safe for both browser and Electron `file://`.
 *
 * Uses `useSyncExternalStore` so every component that calls this hook
 * re-renders when the hash changes.
 */
export function useHashRoute(): string {
  return useSyncExternalStore(subscribeToHash, parseHash);
}

// ── Navigation ──────────────────────────────────────────────────────────────

/**
 * Programmatic navigation.  Sets `window.location.hash` and explicitly
 * dispatches a `HashChangeEvent` so listeners fire reliably even in
 * Electron's `file://` origin (where the browser-native event can be
 * swallowed).
 */
export function navigate(route: string): void {
  window.location.hash = route === "/" ? "/" : `/${route}`;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
