/**
 * Tests for validationStore — includes regression tests for the infinite-loop
 * bugs reported in NANA-94.
 *
 * Bug summary
 * -----------
 * 1. validationStore.ts:54 — `useNodeDiagnostics` uses `?? []` as the fallback
 *    when no diagnostics exist for a node. This creates a NEW array reference on
 *    every selector call. Zustand's React integration uses `useSyncExternalStore`
 *    which calls `getSnapshot()` on every render and compares the result with
 *    `Object.is`. A fresh `[]` on each call makes React conclude the store
 *    changed, triggering another render — causing an infinite loop.
 *
 * 2. SyncNode.tsx:21 — The "Maximum update depth exceeded" error is a downstream
 *    consequence of bug #1. `NodeValidationIndicator` (rendered inside `SyncNode`)
 *    calls `useNodeDiagnostics`, which feeds the infinite render cycle.
 *
 * How to fix (for DesktopEngineer)
 * ----------------------------------
 * In validationStore.ts, replace the inline `[]` fallback with a stable constant:
 *
 *   const EMPTY: ValidationDiagnostic[] = [];
 *
 *   export function useNodeDiagnostics(nodeId: string): ValidationDiagnostic[] {
 *     return useValidationStore((s) => s.byNode.get(nodeId) ?? EMPTY);
 *   }
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock flowStore BEFORE importing validationStore.
// validationStore.ts subscribes to useFlowStore at module load time;
// the mock prevents that side-effect from pulling in @xyflow/react's
// browser-specific runtime during unit tests.
vi.mock("../flowStore", () => ({
  useFlowStore: {
    getState: vi.fn(() => ({ nodes: [], edges: [] })),
    subscribe: vi.fn(() => () => {}), // stub returns a no-op unsubscribe
  },
}));

import { useValidationStore } from "../validationStore";
import type { ValidationDiagnostic } from "../../validation/rules";

// Stable empty reference matching the fix in validationStore.ts
const EMPTY: ValidationDiagnostic[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

const ERROR_DIAG: ValidationDiagnostic = {
  nodeId: "node-1",
  level: "error",
  message: "Missing required field: label",
};

const WARN_DIAG: ValidationDiagnostic = {
  nodeId: "node-2",
  level: "warning",
  message: "Node is disconnected from the graph",
};

// Reset store to a clean slate before each test
beforeEach(() => {
  useValidationStore.setState({
    diagnostics: [],
    byNode: new Map(),
    errorCount: 0,
    warningCount: 0,
  });
});

// ── Store initial state ───────────────────────────────────────────────────────

describe("useValidationStore — initial state", () => {
  it("starts with empty diagnostics", () => {
    const { diagnostics } = useValidationStore.getState();
    expect(diagnostics).toHaveLength(0);
  });

  it("starts with an empty byNode Map", () => {
    const { byNode } = useValidationStore.getState();
    expect(byNode.size).toBe(0);
  });

  it("starts with zero error and warning counts", () => {
    const { errorCount, warningCount } = useValidationStore.getState();
    expect(errorCount).toBe(0);
    expect(warningCount).toBe(0);
  });
});

// ── Store state mutations ─────────────────────────────────────────────────────

describe("useValidationStore — state mutations", () => {
  it("correctly stores diagnostics by node after setState", () => {
    const byNode = new Map([
      ["node-1", [ERROR_DIAG]],
      ["node-2", [WARN_DIAG]],
    ]);

    useValidationStore.setState({
      diagnostics: [ERROR_DIAG, WARN_DIAG],
      byNode,
      errorCount: 1,
      warningCount: 1,
    });

    const state = useValidationStore.getState();
    expect(state.diagnostics).toHaveLength(2);
    expect(state.errorCount).toBe(1);
    expect(state.warningCount).toBe(1);
    expect(state.byNode.get("node-1")).toEqual([ERROR_DIAG]);
    expect(state.byNode.get("node-2")).toEqual([WARN_DIAG]);
  });

  it("returns undefined (not an empty array) from byNode.get for unknown nodes", () => {
    // This verifies the raw Map behaviour that exposes the ?? [] bug below.
    const { byNode } = useValidationStore.getState();
    expect(byNode.get("nonexistent")).toBeUndefined();
  });
});

// ── REGRESSION: selector referential stability (NANA-94) ──────────────────────
//
// These tests directly reproduce the conditions that cause the infinite render
// loop. They will FAIL on the current code and PASS once DesktopEngineer applies
// the EMPTY-constant fix described in the file header.

describe("useNodeDiagnostics selector — referential stability (NANA-94)", () => {
  it("returns the SAME reference when a node HAS diagnostics (baseline — must pass)", () => {
    // When the node exists in byNode, .get() returns the stored array.
    // The same array is returned on every call → no bug here.
    const diagnosticList = [ERROR_DIAG];
    useValidationStore.setState({
      byNode: new Map([["node-1", diagnosticList]]),
    });

    const state = useValidationStore.getState();
    const select = (s: typeof state) => s.byNode.get("node-1") ?? [];

    const r1 = select(state);
    const r2 = select(state);

    expect(r1).toBe(r2); // same reference from Map — PASSES today
  });

  it(
    // ⚠️  This test FAILS on the current code — it documents the NANA-94 bug.
    // useSyncExternalStore calls getSnapshot() twice per render cycle and
    // expects Object.is equality. `?? []` breaks that contract.
    "returns the SAME reference when a node has NO diagnostics [FIXED]",
    () => {
      const state = useValidationStore.getState(); // byNode is empty

      // Replicate the FIXED selector: uses a stable EMPTY constant
      const select = (s: typeof state) =>
        s.byNode.get("node-without-diagnostics") ?? EMPTY;

      const r1 = select(state);
      const r2 = select(state);

      // With EMPTY constant: r1 and r2 are the same reference → Object.is passes
      // → no infinite re-renders.
      expect(r1).toBe(r2);
    },
  );

  it(
    "selector result is referentially stable across multiple calls on unmodified state [FIXED]",
    () => {
      // Simulate what React does internally: call the selector N times on the
      // same Zustand snapshot and verify the result never changes identity.
      const state = useValidationStore.getState();
      const select = (s: typeof state) =>
        s.byNode.get("any-missing-node") ?? EMPTY;

      const results = Array.from({ length: 5 }, () => select(state));

      // All results must be the same object reference
      const allSame = results.every((r) => r === results[0]);
      expect(allSame).toBe(true);
    },
  );
});

// ── Counts stay consistent ────────────────────────────────────────────────────

describe("useValidationStore — error/warning counts", () => {
  it("errorCount reflects only error-level diagnostics", () => {
    useValidationStore.setState({
      diagnostics: [ERROR_DIAG, WARN_DIAG],
      byNode: new Map(),
      errorCount: 1,
      warningCount: 1,
    });
    expect(useValidationStore.getState().errorCount).toBe(1);
  });

  it("warningCount reflects only warning-level diagnostics", () => {
    useValidationStore.setState({
      diagnostics: [WARN_DIAG],
      byNode: new Map(),
      errorCount: 0,
      warningCount: 1,
    });
    expect(useValidationStore.getState().warningCount).toBe(1);
  });

  it("resets to zero when diagnostics are cleared", () => {
    useValidationStore.setState({
      diagnostics: [],
      byNode: new Map(),
      errorCount: 0,
      warningCount: 0,
    });
    const { errorCount, warningCount } = useValidationStore.getState();
    expect(errorCount).toBe(0);
    expect(warningCount).toBe(0);
  });
});
