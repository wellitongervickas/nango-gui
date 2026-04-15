import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import {
  validateRequiredFields,
  validateModelRefs,
  validateModelFields,
  validateOrphans,
  validateRequiredConnections,
  validateTransformMappings,
} from "../rules";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeNode(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
): Node {
  return { id, type, data, position: { x: 0, y: 0 } } as Node;
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target } as Edge;
}

// ── validateRequiredFields ────────────────────────────────────────────────────

describe("validateRequiredFields", () => {
  it("returns no diagnostics for a valid sync node", () => {
    const node = makeNode("s1", "sync", {
      label: "My Sync",
      endpoint: "/contacts",
      frequency: "30m",
    });
    expect(validateRequiredFields(node)).toHaveLength(0);
  });

  it("returns error when sync node is missing required fields", () => {
    const node = makeNode("s1", "sync", { label: "Partial" });
    const diags = validateRequiredFields(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].level).toBe("error");
    expect(diags[0].nodeId).toBe("s1");
    expect(diags[0].message).toMatch(/endpoint/);
    expect(diags[0].message).toMatch(/frequency/);
  });

  it("returns no diagnostics for a valid action node", () => {
    const node = makeNode("a1", "action", { label: "Create", endpoint: "/contacts" });
    expect(validateRequiredFields(node)).toHaveLength(0);
  });

  it("returns error when action node is missing endpoint", () => {
    const node = makeNode("a1", "action", { label: "Create" });
    const diags = validateRequiredFields(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toMatch(/endpoint/);
  });

  it("returns no diagnostics for a valid model node", () => {
    const node = makeNode("m1", "model", { label: "Contact" });
    expect(validateRequiredFields(node)).toHaveLength(0);
  });

  it("returns error for model node missing label", () => {
    const node = makeNode("m1", "model", {});
    const diags = validateRequiredFields(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toMatch(/label/);
  });

  it("returns no diagnostics for unknown node types", () => {
    const node = makeNode("x1", "unknown-type", {});
    expect(validateRequiredFields(node)).toHaveLength(0);
  });

  it("treats empty string as a missing field", () => {
    const node = makeNode("s1", "sync", {
      label: "",
      endpoint: "/contacts",
      frequency: "30m",
    });
    const diags = validateRequiredFields(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toMatch(/label/);
  });
});

// ── validateModelRefs ─────────────────────────────────────────────────────────

describe("validateModelRefs", () => {
  it("returns no diagnostics when modelRef matches an existing model node", () => {
    const model = makeNode("m1", "model", { label: "Contact" });
    const sync = makeNode("s1", "sync", { modelRef: "Contact" });
    expect(validateModelRefs(sync, [model, sync])).toHaveLength(0);
  });

  it("returns warning when modelRef does not match any model node", () => {
    const sync = makeNode("s1", "sync", { modelRef: "Ghost" });
    const diags = validateModelRefs(sync, [sync]);
    expect(diags).toHaveLength(1);
    expect(diags[0].level).toBe("warning");
    expect(diags[0].message).toMatch(/Ghost/);
  });

  it("returns no diagnostics when modelRef is absent", () => {
    const sync = makeNode("s1", "sync", {});
    expect(validateModelRefs(sync, [sync])).toHaveLength(0);
  });

  it("checks inputModelRef and outputModelRef for action nodes", () => {
    const action = makeNode("a1", "action", {
      inputModelRef: "Missing",
      outputModelRef: "AlsoMissing",
    });
    const diags = validateModelRefs(action, [action]);
    expect(diags).toHaveLength(2);
  });
});

// ── validateModelFields ───────────────────────────────────────────────────────

describe("validateModelFields", () => {
  it("returns warning for model with no fields", () => {
    const node = makeNode("m1", "model", { label: "Empty", fields: [] });
    const diags = validateModelFields(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].level).toBe("warning");
    expect(diags[0].message).toMatch(/no fields/);
  });

  it("returns no diagnostics for model with at least one field", () => {
    const node = makeNode("m1", "model", {
      label: "Contact",
      fields: [{ name: "id", type: "string" }],
    });
    expect(validateModelFields(node)).toHaveLength(0);
  });

  it("returns no diagnostics for non-model nodes", () => {
    const node = makeNode("s1", "sync", {});
    expect(validateModelFields(node)).toHaveLength(0);
  });
});

// ── validateOrphans ───────────────────────────────────────────────────────────

describe("validateOrphans", () => {
  it("returns no diagnostics for a single node (graph with one node is not orphaned)", () => {
    const nodes = [makeNode("n1", "sync", {})];
    expect(validateOrphans(nodes, [])).toHaveLength(0);
  });

  it("returns warnings for disconnected nodes when there are multiple nodes", () => {
    const nodes = [
      makeNode("n1", "sync", {}),
      makeNode("n2", "model", {}),
    ];
    const diags = validateOrphans(nodes, []);
    expect(diags).toHaveLength(2);
    expect(diags.every((d) => d.level === "warning")).toBe(true);
    expect(diags.every((d) => d.message.includes("disconnected"))).toBe(true);
  });

  it("returns no diagnostics when all nodes are connected", () => {
    const nodes = [makeNode("n1", "sync", {}), makeNode("n2", "model", {})];
    const edges = [makeEdge("e1", "n1", "n2")];
    expect(validateOrphans(nodes, edges)).toHaveLength(0);
  });

  it("only flags nodes without any edge connection", () => {
    const nodes = [
      makeNode("n1", "sync", {}),
      makeNode("n2", "model", {}),
      makeNode("n3", "trigger", {}), // orphan
    ];
    const edges = [makeEdge("e1", "n1", "n2")];
    const diags = validateOrphans(nodes, edges);
    expect(diags).toHaveLength(1);
    expect(diags[0].nodeId).toBe("n3");
  });
});

// ── validateRequiredConnections ───────────────────────────────────────────────

describe("validateRequiredConnections", () => {
  it("returns warning for sync node not connected to a model", () => {
    const sync = makeNode("s1", "sync", {});
    const other = makeNode("t1", "trigger", {});
    const edges = [makeEdge("e1", "t1", "s1")];
    const diags = validateRequiredConnections(sync, edges, [sync, other]);
    expect(diags).toHaveLength(1);
    expect(diags[0].level).toBe("warning");
    expect(diags[0].message).toMatch(/Model node/);
  });

  it("returns no diagnostics for sync node connected to a model", () => {
    const sync = makeNode("s1", "sync", {});
    const model = makeNode("m1", "model", {});
    const edges = [makeEdge("e1", "s1", "m1")];
    expect(validateRequiredConnections(sync, edges, [sync, model])).toHaveLength(0);
  });

  it("returns no diagnostics for node types that have no connection requirement", () => {
    const trigger = makeNode("t1", "trigger", {});
    expect(validateRequiredConnections(trigger, [], [trigger])).toHaveLength(0);
  });
});

// ── validateTransformMappings ─────────────────────────────────────────────────

describe("validateTransformMappings", () => {
  it("returns no diagnostics for non-transform nodes", () => {
    const node = makeNode("s1", "sync", {});
    expect(validateTransformMappings(node)).toHaveLength(0);
  });

  it("returns no diagnostics when transform has no model refs", () => {
    const node = makeNode("tx1", "transform", { label: "Map" });
    expect(validateTransformMappings(node)).toHaveLength(0);
  });

  it("returns warning when transform has both model refs but no mappings", () => {
    const node = makeNode("tx1", "transform", {
      label: "Map",
      inputModelRef: "A",
      outputModelRef: "B",
      mappings: [],
    });
    const diags = validateTransformMappings(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].level).toBe("warning");
    expect(diags[0].message).toMatch(/mappings/);
  });

  it("returns no diagnostics when transform has both model refs and mappings", () => {
    const node = makeNode("tx1", "transform", {
      label: "Map",
      inputModelRef: "A",
      outputModelRef: "B",
      mappings: [{ from: "id", to: "contactId" }],
    });
    expect(validateTransformMappings(node)).toHaveLength(0);
  });
});
