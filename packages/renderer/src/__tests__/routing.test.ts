/**
 * Unit tests for hash-based routing logic (NANA-80 regression suite).
 *
 * These tests mirror the parseHash / subscribeToHash logic defined in App.tsx
 * and verify it in isolation, without needing to render the React tree.
 *
 * If the routing utilities are ever extracted to a dedicated module they can
 * be imported directly here. Until then, the functions are re-stated below to
 * precisely capture the expected contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Pure routing helpers (mirrors App.tsx) ───────────────────────────────────

function parseHash(hash: string): string {
  return hash.replace(/^#\/?/, "") || "/";
}

// ── parseHash ────────────────────────────────────────────────────────────────

describe("parseHash", () => {
  it("returns '/' for an empty hash", () => {
    expect(parseHash("")).toBe("/");
  });

  it("returns '/' for bare '#'", () => {
    expect(parseHash("#")).toBe("/");
  });

  it("returns '/' for '#/'", () => {
    expect(parseHash("#/")).toBe("/");
  });

  it("strips '#/' prefix for regular routes", () => {
    expect(parseHash("#/connections")).toBe("connections");
    expect(parseHash("#/syncs")).toBe("syncs");
    expect(parseHash("#/records")).toBe("records");
    expect(parseHash("#/actions")).toBe("actions");
    expect(parseHash("#/integrations")).toBe("integrations");
    expect(parseHash("#/settings")).toBe("settings");
    expect(parseHash("#/dashboard")).toBe("dashboard");
    expect(parseHash("#/canvas")).toBe("canvas");
    expect(parseHash("#/setup")).toBe("setup");
  });

  it("strips '#' without slash prefix", () => {
    // Defensive: some older hash formats omit the leading slash
    expect(parseHash("#connections")).toBe("connections");
  });

  it("preserves nested paths beyond the first segment", () => {
    // Future-proofing: deep routes must not be mangled
    expect(parseHash("#/connections/detail")).toBe("connections/detail");
  });
});

// ── navigate hash contract ────────────────────────────────────────────────────
//
// The navigate() function in Toolbar.tsx sets window.location.hash.
// This test suite validates what the resulting window.location.hash value
// should be for each route argument so we can confirm the assignment is
// consistent with what parseHash expects.

describe("navigate hash contract", () => {
  function navigate(route: string): string {
    // Mirrors Toolbar.tsx navigate()
    return route === "/" ? "/" : `/${route}`;
  }

  it("produces '/' for the root/dashboard route", () => {
    expect(navigate("/")).toBe("/");
  });

  it("produces '/<route>' for named routes", () => {
    const routes = [
      "connections",
      "syncs",
      "records",
      "actions",
      "integrations",
      "settings",
      "canvas",
      "setup",
      "dashboard",
    ];
    for (const route of routes) {
      expect(navigate(route)).toBe(`/${route}`);
    }
  });

  it("round-trips: parseHash(navigate(route)) === route", () => {
    // Any named route set via navigate() must be recovered by parseHash.
    const routes = [
      "connections",
      "syncs",
      "records",
      "actions",
      "integrations",
      "settings",
      "canvas",
      "dashboard",
    ];
    for (const route of routes) {
      const assigned = navigate(route);
      // Browser prefixes with '#'
      const browserHash = `#${assigned}`;
      expect(parseHash(browserHash)).toBe(route);
    }
  });

  it("round-trips: parseHash(navigate('/')) returns '/'", () => {
    const assigned = navigate("/");
    const browserHash = `#${assigned}`;
    expect(parseHash(browserHash)).toBe("/");
  });
});

// ── hashchange subscription ──────────────────────────────────────────────────
//
// subscribeToHash (App.tsx) must:
//   1. Register a 'hashchange' listener on window
//   2. Call the callback when the event fires
//   3. Remove the listener when unsubscribed

describe("subscribeToHash", () => {
  const listeners: Map<string, EventListenerOrEventListenerObject[]> = new Map();

  const mockWindow = {
    addEventListener: vi.fn((type: string, fn: EventListenerOrEventListenerObject) => {
      const bucket = listeners.get(type) ?? [];
      bucket.push(fn);
      listeners.set(type, bucket);
    }),
    removeEventListener: vi.fn((type: string, fn: EventListenerOrEventListenerObject) => {
      const bucket = listeners.get(type) ?? [];
      listeners.set(type, bucket.filter((l) => l !== fn));
    }),
  };

  // Mirrors App.tsx subscribeToHash
  function subscribeToHash(callback: () => void): () => void {
    mockWindow.addEventListener("hashchange", callback);
    return () => mockWindow.removeEventListener("hashchange", callback);
  }

  function fireHashchange() {
    const bucket = listeners.get("hashchange") ?? [];
    for (const fn of bucket) {
      if (typeof fn === "function") fn(new Event("hashchange"));
    }
  }

  beforeEach(() => {
    listeners.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    listeners.clear();
  });

  it("registers a hashchange listener on subscribe", () => {
    const callback = vi.fn();
    subscribeToHash(callback);
    expect(mockWindow.addEventListener).toHaveBeenCalledWith("hashchange", callback);
  });

  it("calls the callback when hashchange fires", () => {
    const callback = vi.fn();
    subscribeToHash(callback);
    fireHashchange();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not call the callback after unsubscribe", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToHash(callback);
    unsubscribe();
    fireHashchange();
    expect(callback).not.toHaveBeenCalled();
  });

  it("removes the listener on unsubscribe", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToHash(callback);
    unsubscribe();
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith("hashchange", callback);
  });

  it("multiple subscribers each receive the event independently", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    subscribeToHash(cb1);
    subscribeToHash(cb2);
    fireHashchange();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("unsubscribing one listener does not remove others", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = subscribeToHash(cb1);
    subscribeToHash(cb2);
    unsub1();
    fireHashchange();
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});
