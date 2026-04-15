import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { validateGraph, groupByNode } from "../engine";
import type { ValidationDiagnostic } from "../rules";

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

// ── groupByNode ───────────────────────────────────────────────────────────────

describe("groupByNode", () => {
  it("returns an empty Map for no diagnostics", () => {
    const result = groupByNode([]);
    expect(result.size).toBe(0);
  });

  it("groups diagnostics by nodeId", () => {
    const diags: ValidationDiagnostic[] = [
      { nodeId: "n1", level: "error", message: "Missing label" },
      { nodeId: "n1", level: "warning", message: "No fields" },
      { nodeId: "n2", level: "error", message: "Missing endpoint" },
    ];
    const result = groupByNode(diags);
    expect(result.get("n1")).toHaveLength(2);
    expect(result.get("n2")).toHaveLength(1);
  });

  it("falls back to edgeId when nodeId is absent", () => {
    const diags: ValidationDiagnostic[] = [
      { edgeId: "e1", level: "warning", message: "Unused edge" },
    ];
    const result = groupByNode(diags);
    expect(result.get("e1")).toHaveLength(1);
  });

  it("falls back to __graph__ when both nodeId and edgeId are absent", () => {
    const diags: ValidationDiagnostic[] = [
      { level: "warning", message: "No root trigger" },
    ];
    const result = groupByNode(diags);
    expect(result.get("__graph__")).toHaveLength(1);
  });

  it("preserves insertion order within each group", () => {
    const diags: ValidationDiagnostic[] = [
      { nodeId: "n1", level: "error", message: "First" },
      { nodeId: "n1", level: "warning", message: "Second" },
    ];
    const result = groupByNode(diags);
    const group = result.get("n1")!;
    expect(group[0].message).toBe("First");
    expect(group[1].message).toBe("Second");
  });
});

// ── validateGraph ─────────────────────────────────────────────────────────────

describe("validateGraph", () => {
  it("returns no diagnostics for an empty graph", () => {
    expect(validateGraph([], [])).toHaveLength(0);
  });

  it("detects missing required fields on a sync node", () => {
    const nodes = [makeNode("s1", "sync", {})]; // missing label, endpoint, frequency
    const diags = validateGraph(nodes, []);
    const forS1 = diags.filter((d) => d.nodeId === "s1");
    expect(forS1.length).toBeGreaterThan(0);
    const errors = forS1.filter((d) => d.level === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((d) => d.message.includes("Missing required field"))).toBe(true);
  });

  it("returns no errors for a fully valid, connected sync+model graph", () => {
    const sync = makeNode("s1", "sync", {
      label: "Contacts",
      endpoint: "/contacts",
      frequency: "30m",
      modelRef: "Contact",
    });
    const model = makeNode("m1", "model", {
      label: "Contact",
      fields: [{ name: "id", type: "string" }],
    });
    const edge = makeEdge("e1", "s1", "m1");
    const diags = validateGraph([sync, model], [edge]);
    expect(diags.filter((d) => d.level === "error")).toHaveLength(0);
  });

  it("detects orphaned nodes in a multi-node graph", () => {
    const nodes = [
      makeNode("s1", "sync", { label: "S", endpoint: "/e", frequency: "1h" }),
      makeNode("m1", "model", { label: "M", fields: [{ name: "id" }] }),
    ];
    // No edges — both are orphans
    const diags = validateGraph(nodes, []);
    const orphanDiags = diags.filter((d) => d.message.includes("disconnected"));
    expect(orphanDiags).toHaveLength(2);
  });

  it("flags a broken modelRef as a warning, not error", () => {
    const sync = makeNode("s1", "sync", {
      label: "S",
      endpoint: "/e",
      frequency: "1h",
      modelRef: "DoesNotExist",
    });
    const diags = validateGraph([sync], []);
    const refDiags = diags.filter((d) => d.message.includes("DoesNotExist"));
    expect(refDiags).toHaveLength(1);
    expect(refDiags[0].level).toBe("warning");
  });

  it("accumulates diagnostics from multiple rules for the same node", () => {
    // sync node: missing fields AND not connected to a model
    const nodes = [makeNode("s1", "sync", {})];
    const diags = validateGraph(nodes, []);
    const forS1 = diags.filter((d) => d.nodeId === "s1");
    // At minimum: required fields error + connection warning
    expect(forS1.length).toBeGreaterThanOrEqual(2);
  });
});
