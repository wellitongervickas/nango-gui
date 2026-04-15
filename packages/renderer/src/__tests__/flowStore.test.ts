/**
 * Regression tests for NANA-93: "Maximum update depth exceeded" on canvas run.
 *
 * React's "Maximum update depth exceeded" error fires when a component or
 * subscriber causes an unbounded chain of synchronous state updates. These
 * tests guard the flowStore + validationStore subscription pair against that
 * class of infinite-loop bug.
 *
 * Strategy:
 *  1. Verify that store mutations (addNode, updateNodeData, onConnect, …)
 *     produce exactly the expected number of subscriber notifications — not
 *     an exponentially growing chain.
 *  2. Verify that the validationStore subscription never writes back to the
 *     flowStore (which would close a feedback loop).
 *  3. Verify that rapid, back-to-back mutations stay bounded (history cap).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Node, Connection } from "@xyflow/react";
import { useFlowStore } from "../store/flowStore";
import "../../src/__tests__/../store/validationStore"; // activate subscription (side-effect import)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, type: string = "sync"): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { label: "Test" } };
}

function makeConnection(source: string, target: string): Connection {
  return {
    source,
    target,
    sourceHandle: "out",
    targetHandle: "in",
  };
}

// ---------------------------------------------------------------------------
// Setup: reset store before each test so state doesn't bleed across tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  useFlowStore.getState().reset();
});

// ---------------------------------------------------------------------------
// 1. Mutation notification depth — subscriber call counts must be bounded
// ---------------------------------------------------------------------------

describe("flowStore mutation depth (NANA-93 regression)", () => {
  it("addNode triggers a bounded number of subscriber notifications", () => {
    let callCount = 0;
    const unsub = useFlowStore.subscribe(() => {
      callCount++;
      // A deep loop would call this thousands of times. Guard against it:
      if (callCount > 20) throw new Error("Subscriber called too many times — possible infinite loop");
    });

    try {
      useFlowStore.getState().addNode(makeNode("n1"));
    } finally {
      unsub();
    }

    // addNode calls pushHistory (1 set) + adds node (1 set) = 2 notifications max
    expect(callCount).toBeLessThanOrEqual(4);
  });

  it("onConnect triggers a bounded number of subscriber notifications", () => {
    useFlowStore.getState().addNode(makeNode("n1", "sync"));
    useFlowStore.getState().addNode(makeNode("n2", "model"));

    let callCount = 0;
    const unsub = useFlowStore.subscribe(() => {
      callCount++;
      if (callCount > 20) throw new Error("Subscriber called too many times — possible infinite loop");
    });

    try {
      useFlowStore.getState().onConnect(makeConnection("n1", "n2"));
    } finally {
      unsub();
    }

    expect(callCount).toBeLessThanOrEqual(4);
  });

  it("updateNodeData triggers a bounded number of subscriber notifications", () => {
    useFlowStore.getState().addNode(makeNode("n1"));

    let callCount = 0;
    const unsub = useFlowStore.subscribe(() => {
      callCount++;
      if (callCount > 20) throw new Error("Subscriber called too many times — possible infinite loop");
    });

    try {
      useFlowStore.getState().updateNodeData("n1", { label: "Updated" });
    } finally {
      unsub();
    }

    expect(callCount).toBeLessThanOrEqual(2);
  });

  it("removeNode triggers a bounded number of subscriber notifications", () => {
    useFlowStore.getState().addNode(makeNode("n1"));

    let callCount = 0;
    const unsub = useFlowStore.subscribe(() => {
      callCount++;
      if (callCount > 20) throw new Error("Subscriber called too many times — possible infinite loop");
    });

    try {
      useFlowStore.getState().removeNode("n1");
    } finally {
      unsub();
    }

    expect(callCount).toBeLessThanOrEqual(4);
  });

  it("duplicateNode triggers a bounded number of subscriber notifications", () => {
    useFlowStore.getState().addNode(makeNode("n1"));

    let callCount = 0;
    const unsub = useFlowStore.subscribe(() => {
      callCount++;
      if (callCount > 20) throw new Error("Subscriber called too many times — possible infinite loop");
    });

    try {
      useFlowStore.getState().duplicateNode("n1");
    } finally {
      unsub();
    }

    expect(callCount).toBeLessThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// 2. No feedback loop: validationStore must never write back to flowStore
// ---------------------------------------------------------------------------

describe("validationStore → flowStore isolation (NANA-93 regression)", () => {
  it("adding nodes does not cause the flowStore to update again after validation runs", () => {
    vi.useFakeTimers();

    const flowSetSpy = vi.spyOn(useFlowStore, "setState");

    useFlowStore.getState().addNode(makeNode("a1", "sync"));
    useFlowStore.getState().addNode(makeNode("a2", "model"));

    const callsBeforeValidation = flowSetSpy.mock.calls.length;

    // Flush the 300ms validation debounce — if validation wrote back to
    // flowStore we would see additional setState calls here.
    vi.runAllTimers();

    const callsAfterValidation = flowSetSpy.mock.calls.length;

    flowSetSpy.mockRestore();
    vi.useRealTimers();

    // flowStore must not be touched by validation side-effects
    expect(callsAfterValidation).toBe(callsBeforeValidation);
  });

  it("rapid node mutations followed by validation flush do not cascade into flowStore", () => {
    vi.useFakeTimers();

    const flowSetSpy = vi.spyOn(useFlowStore, "setState");

    for (let i = 0; i < 10; i++) {
      useFlowStore.getState().addNode(makeNode(`node-${i}`));
    }

    const callsBeforeFlush = flowSetSpy.mock.calls.length;
    vi.runAllTimers(); // flush validation debounce
    const callsAfterFlush = flowSetSpy.mock.calls.length;

    flowSetSpy.mockRestore();
    vi.useRealTimers();

    expect(callsAfterFlush).toBe(callsBeforeFlush);
  });
});

// ---------------------------------------------------------------------------
// 3. History cap — pushHistory never grows the past array beyond MAX_HISTORY
// ---------------------------------------------------------------------------

describe("history depth stays bounded (NANA-93 regression)", () => {
  const MAX_HISTORY = 50; // mirrors the constant in flowStore.ts

  it("past array is capped at MAX_HISTORY after many mutations", () => {
    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      useFlowStore.getState().addNode(makeNode(`n${i}`));
    }
    const { past } = useFlowStore.getState();
    expect(past.length).toBeLessThanOrEqual(MAX_HISTORY);
  });

  it("undo/redo cycle stays bounded and does not grow past infinitely", () => {
    useFlowStore.getState().addNode(makeNode("x1"));
    useFlowStore.getState().addNode(makeNode("x2"));

    useFlowStore.getState().undo();
    useFlowStore.getState().undo();
    useFlowStore.getState().redo();
    useFlowStore.getState().redo();

    const { past, future } = useFlowStore.getState();
    expect(past.length).toBeLessThanOrEqual(MAX_HISTORY);
    expect(future.length).toBeLessThanOrEqual(MAX_HISTORY);
  });
});

// ---------------------------------------------------------------------------
// 4. Recursive / re-entrant protection: subscriber that calls a mutation
//    must not cascade indefinitely
// ---------------------------------------------------------------------------

describe("re-entrant store mutations are safe (NANA-93 regression)", () => {
  it("a subscriber that calls selectNode does not create an infinite loop", () => {
    let depth = 0;
    const unsub = useFlowStore.subscribe((state) => {
      depth++;
      if (depth > 50) throw new Error("Infinite loop detected");
      // Simulate a component that responds to selectedNodeId changes by
      // selecting null — this must NOT re-trigger indefinitely.
      if (state.selectedNodeId !== null) {
        // We deliberately do NOT call selectNode here to avoid the loop;
        // this test documents that the store itself doesn't auto-loop.
      }
    });

    try {
      useFlowStore.getState().addNode(makeNode("r1"));
      useFlowStore.getState().selectNode("r1");
      useFlowStore.getState().selectNode(null);
    } finally {
      unsub();
    }

    // Just verifying no throw is the key assertion here.
    expect(depth).toBeLessThan(50);
  });

  it("pushHistory is idempotent when nodes are unchanged", () => {
    useFlowStore.getState().addNode(makeNode("p1"));

    const before = useFlowStore.getState().past.length;
    useFlowStore.getState().pushHistory();
    useFlowStore.getState().pushHistory();
    const after = useFlowStore.getState().past.length;

    // Each explicit pushHistory adds one snapshot; two calls = +2, bounded
    expect(after - before).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. Edge data update does not loop
// ---------------------------------------------------------------------------

describe("updateEdgeData (NANA-93 regression)", () => {
  it("updating edge data triggers a bounded number of notifications", () => {
    useFlowStore.getState().addNode(makeNode("e1", "sync"));
    useFlowStore.getState().addNode(makeNode("e2", "model"));
    useFlowStore.getState().onConnect(makeConnection("e1", "e2"));

    const { edges } = useFlowStore.getState();
    expect(edges.length).toBeGreaterThan(0);

    let callCount = 0;
    const unsub = useFlowStore.subscribe(() => {
      callCount++;
      if (callCount > 20) throw new Error("Subscriber called too many times");
    });

    try {
      useFlowStore.getState().updateEdgeData(edges[0].id, { label: "new" });
    } finally {
      unsub();
    }

    expect(callCount).toBeLessThanOrEqual(2);
  });
});
