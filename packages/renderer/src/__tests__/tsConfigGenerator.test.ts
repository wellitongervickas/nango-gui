import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { graphToTsConfig } from "../codegen/ts-config-generator";
import type { NangoProject } from "../types/flow";

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

const baseProject: NangoProject = {
  name: "Test",
  provider: "github",
  authType: "oauth2",
  environment: "development",
  errorHandling: { retryOn: [], maxRetries: 3 },
  filePath: null,
  lastSaved: null,
};

describe("graphToTsConfig", () => {
  it("generates valid TypeScript config skeleton for empty graph", () => {
    const result = graphToTsConfig(baseProject, [], []);
    expect(result).toContain("import type { NangoYAMLConfig }");
    expect(result).toContain("'github'");
    expect(result).toContain("satisfies NangoYAMLConfig");
    expect(result).toContain("export default");
  });

  it("serializes a sync node with endpoint and frequency", () => {
    const nodes = [
      makeNode("s1", "sync", {
        label: "Users",
        endpoint: "/users",
        frequency: "every 1h",
        modelRef: "User",
        method: "GET",
      }),
      makeNode("m1", "model", {
        label: "User",
        fields: [{ name: "id", type: "string", optional: false }],
      }),
    ];
    const result = graphToTsConfig(baseProject, nodes, []);
    expect(result).toContain("syncs:");
    expect(result).toContain("'Users'");
    expect(result).toContain("runs: 'every 1h'");
    expect(result).toContain("output: 'User'");
    expect(result).toContain("'User':");
    expect(result).toContain("id: 'string'");
  });

  it("serializes an action node with input/output models", () => {
    const nodes = [
      makeNode("a1", "action", {
        label: "CreateUser",
        endpoint: "/users",
        method: "POST",
        inputModelRef: "CreateUserInput",
        outputModelRef: "User",
      }),
    ];
    const result = graphToTsConfig(baseProject, nodes, []);
    expect(result).toContain("actions:");
    expect(result).toContain("'CreateUser'");
    expect(result).toContain("input: 'CreateUserInput'");
    expect(result).toContain("output: 'User'");
  });

  it("serializes a webhook node", () => {
    const nodes = [
      makeNode("w1", "webhook", {
        label: "OnPush",
        endpoint: "/webhooks/push",
        method: "POST",
        modelRef: "PushEvent",
      }),
    ];
    const result = graphToTsConfig(baseProject, nodes, []);
    expect(result).toContain("webhooks:");
    expect(result).toContain("'OnPush'");
    expect(result).toContain("output: 'PushEvent'");
  });

  it("marks optional fields with ? suffix", () => {
    const nodes = [
      makeNode("m1", "model", {
        label: "User",
        fields: [
          { name: "id", type: "string", optional: false },
          { name: "email", type: "string", optional: true },
        ],
      }),
    ];
    const result = graphToTsConfig(baseProject, nodes, []);
    expect(result).toContain("id: 'string'");
    expect(result).toContain("'email?': 'string'");
  });

  it("includes endpoint method in endpoint string", () => {
    const nodes = [
      makeNode("a1", "action", {
        label: "Delete",
        endpoint: "/users/1",
        method: "DELETE",
        outputModelRef: "Result",
      }),
    ];
    const result = graphToTsConfig(baseProject, nodes, []);
    expect(result).toContain("endpoint: 'DELETE /users/1'");
  });

  it("resolves sync output model from edge when modelRef is empty", () => {
    const nodes = [
      makeNode("s1", "sync", {
        label: "Users",
        endpoint: "/users",
        frequency: "every 1h",
        modelRef: "",
      }),
      makeNode("m1", "model", {
        label: "User",
        fields: [{ name: "id", type: "string", optional: false }],
      }),
    ];
    const edges = [makeEdge("s1", "m1")];
    const result = graphToTsConfig(baseProject, nodes, edges);
    expect(result).toContain("output: 'User'");
    expect(result).not.toContain("output: 'Unknown'");
  });

  it("overrides sync frequency from connected trigger node", () => {
    const nodes = [
      makeNode("t1", "trigger", {
        label: "Fast",
        frequency: "every 5m",
      }),
      makeNode("s1", "sync", {
        label: "Users",
        endpoint: "/users",
        frequency: "every 1h",
        modelRef: "User",
      }),
    ];
    const edges = [makeEdge("t1", "s1")];
    const result = graphToTsConfig(baseProject, nodes, edges);
    expect(result).toContain("runs: 'every 5m'");
    expect(result).not.toContain("runs: 'every 1h'");
  });

  it("does not include nango.yaml references", () => {
    const result = graphToTsConfig(baseProject, [], []);
    expect(result).not.toContain("nango.yaml");
    expect(result).not.toContain("yaml");
  });
});
