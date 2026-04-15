import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { validateGraph, groupByNode } from "../validation/engine";
import {
  validateRequiredFields,
  validateModelRefs,
  validateModelFields,
  validateOrphans,
  validateRequiredConnections,
  validateTransformMappings,
} from "../validation/rules";

// ── Helpers ──────────────────────────────────────────────────────────────

function makeNode(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
): Node {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}

// ── Required field tests ─────────────────────────────────────────────────

describe("validateRequiredFields", () => {
  it("reports missing fields on sync node", () => {
    const node = makeNode("s1", "sync", { label: "" });
    const diags = validateRequiredFields(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].level).toBe("error");
    expect(diags[0].message).toContain("label");
    expect(diags[0].message).toContain("endpoint");
    expect(diags[0].message).toContain("frequency");
  });

  it("passes when all required fields are present", () => {
    const node = makeNode("s1", "sync", {
      label: "Users",
      endpoint: "/users",
      frequency: "every 1h",
    });
    expect(validateRequiredFields(node)).toHaveLength(0);
  });

  it("reports missing fields on action node", () => {
    const node = makeNode("a1", "action", {});
    const diags = validateRequiredFields(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("label");
    expect(diags[0].message).toContain("endpoint");
  });

  it("reports missing label on model node", () => {
    const node = makeNode("m1", "model", {});
    const diags = validateRequiredFields(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("label");
  });

  it("reports missing fields on trigger node", () => {
    const node = makeNode("t1", "trigger", { label: "Cron" });
    const diags = validateRequiredFields(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("frequency");
  });

  it("reports missing fields on webhook node", () => {
    const node = makeNode("w1", "webhook", {});
    const diags = validateRequiredFields(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("label");
    expect(diags[0].message).toContain("endpoint");
  });

  it("passes for transform with just a label", () => {
    const node = makeNode("tr1", "transform", { label: "Map fields" });
    expect(validateRequiredFields(node)).toHaveLength(0);
  });
});

// ── Model ref tests ──────────────────────────────────────────────────────

describe("validateModelRefs", () => {
  it("warns when modelRef does not match any model node", () => {
    const sync = makeNode("s1", "sync", { modelRef: "Ghost" });
    const model = makeNode("m1", "model", { label: "User" });
    const diags = validateModelRefs(sync, [sync, model]);
    expect(diags).toHaveLength(1);
    expect(diags[0].level).toBe("warning");
    expect(diags[0].message).toContain("Ghost");
  });

  it("passes when modelRef matches a model node", () => {
    const sync = makeNode("s1", "sync", { modelRef: "User" });
    const model = makeNode("m1", "model", { label: "User" });
    expect(validateModelRefs(sync, [sync, model])).toHaveLength(0);
  });

  it("checks both inputModelRef and outputModelRef on action nodes", () => {
    const action = makeNode("a1", "action", {
      inputModelRef: "Req",
      outputModelRef: "Resp",
    });
    const diags = validateModelRefs(action, [action]);
    expect(diags).toHaveLength(2);
  });
});

// ── Model fields tests ───────────────────────────────────────────────────

describe("validateModelFields", () => {
  it("warns when model has no fields", () => {
    const node = makeNode("m1", "model", { label: "Empty", fields: [] });
    const diags = validateModelFields(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].level).toBe("warning");
  });

  it("passes when model has fields", () => {
    const node = makeNode("m1", "model", {
      label: "User",
      fields: [{ name: "id", type: "string", optional: false }],
    });
    expect(validateModelFields(node)).toHaveLength(0);
  });

  it("ignores non-model nodes", () => {
    const node = makeNode("s1", "sync", {});
    expect(validateModelFields(node)).toHaveLength(0);
  });
});

// ── Orphan tests ─────────────────────────────────────────────────────────

describe("validateOrphans", () => {
  it("detects disconnected nodes", () => {
    const nodes = [
      makeNode("a", "sync"),
      makeNode("b", "model"),
      makeNode("c", "action"),
    ];
    const edges = [makeEdge("a", "b")];
    const diags = validateOrphans(nodes, edges);
    expect(diags).toHaveLength(1);
    expect(diags[0].nodeId).toBe("c");
    expect(diags[0].level).toBe("warning");
  });

  it("returns nothing when all nodes are connected", () => {
    const nodes = [makeNode("a", "sync"), makeNode("b", "model")];
    const edges = [makeEdge("a", "b")];
    expect(validateOrphans(nodes, edges)).toHaveLength(0);
  });

  it("skips orphan check for single-node graphs", () => {
    expect(validateOrphans([makeNode("a", "sync")], [])).toHaveLength(0);
  });
});

// ── Required connections tests ───────────────────────────────────────────

describe("validateRequiredConnections", () => {
  it("warns when sync has no model connection", () => {
    const sync = makeNode("s1", "sync");
    const diags = validateRequiredConnections(sync, [], [sync]);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("Model");
  });

  it("passes when sync is connected to model", () => {
    const sync = makeNode("s1", "sync");
    const model = makeNode("m1", "model");
    const edge = makeEdge("s1", "m1");
    expect(
      validateRequiredConnections(sync, [edge], [sync, model]),
    ).toHaveLength(0);
  });

  it("ignores model nodes", () => {
    const model = makeNode("m1", "model");
    expect(validateRequiredConnections(model, [], [model])).toHaveLength(0);
  });
});

// ── Transform mapping tests ──────────────────────────────────────────────

describe("validateTransformMappings", () => {
  it("warns when transform has models but no mappings", () => {
    const node = makeNode("tr1", "transform", {
      inputModelRef: "A",
      outputModelRef: "B",
      mappings: [],
    });
    const diags = validateTransformMappings(node);
    expect(diags).toHaveLength(1);
    expect(diags[0].level).toBe("warning");
  });

  it("passes when transform has mappings", () => {
    const node = makeNode("tr1", "transform", {
      inputModelRef: "A",
      outputModelRef: "B",
      mappings: [
        { sourceField: "id", targetField: "userId", transform: "rename" },
      ],
    });
    expect(validateTransformMappings(node)).toHaveLength(0);
  });
});

// ── Full engine tests ────────────────────────────────────────────────────

describe("validateGraph", () => {
  it("returns empty array for an empty graph", () => {
    expect(validateGraph([], [])).toHaveLength(0);
  });

  it("catches multiple issues in a real graph", () => {
    const nodes = [
      makeNode("s1", "sync", {}), // missing fields, no model connection, orphan
      makeNode("m1", "model", { label: "User", fields: [] }), // no fields
    ];
    const diags = validateGraph(nodes, []);
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((d) => d.level === "error")).toBe(true);
  });
});

describe("groupByNode", () => {
  it("groups diagnostics by nodeId", () => {
    const diags = [
      { nodeId: "a", level: "error" as const, message: "x" },
      { nodeId: "a", level: "warning" as const, message: "y" },
      { nodeId: "b", level: "error" as const, message: "z" },
    ];
    const map = groupByNode(diags);
    expect(map.get("a")).toHaveLength(2);
    expect(map.get("b")).toHaveLength(1);
  });
});
