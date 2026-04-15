import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { graphToYaml, yamlToGraph } from "../codegen/yaml-serializer";
import type { NangoProject } from "../types/flow";

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

const baseProject: NangoProject = {
  name: "Test",
  provider: "github",
  authType: "oauth2",
  environment: "development",
  errorHandling: { retryOn: [], maxRetries: 3 },
  filePath: null,
  lastSaved: null,
};

// ── graphToYaml tests ───────────────────────────────────────────────────

describe("graphToYaml", () => {
  it("emits empty integrations for empty graph", () => {
    const result = graphToYaml(baseProject, [], []);
    expect(result).toContain("integrations:");
    expect(result).toContain("github:");
    expect(result).toContain("models:");
  });

  it("serializes a sync node", () => {
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
    const result = graphToYaml(baseProject, nodes, []);
    expect(result).toContain("syncs:");
    expect(result).toContain("Users:");
    expect(result).toContain("endpoint: /users");
    expect(result).toContain("frequency: every 1h");
    expect(result).toContain("output: User");
    expect(result).toContain("models:");
    expect(result).toContain("User:");
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
    const result = graphToYaml(baseProject, nodes, []);
    expect(result).toContain("actions:");
    expect(result).toContain("CreateUser:");
    expect(result).toContain("input: CreateUserInput");
    expect(result).toContain("output: User");
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
    const result = graphToYaml(baseProject, nodes, []);
    expect(result).toContain("webhooks:");
    expect(result).toContain("OnPush:");
    expect(result).toContain("output: PushEvent");
  });

  it("serializes model fields correctly", () => {
    const nodes = [
      makeNode("m1", "model", {
        label: "User",
        fields: [
          { name: "id", type: "string", optional: false },
          { name: "email", type: "string", optional: true },
          { name: "age", type: "number", optional: false },
        ],
      }),
    ];
    const result = graphToYaml(baseProject, nodes, []);
    expect(result).toContain("User:");
    expect(result).toContain("name: id");
    expect(result).toContain("type: string");
    expect(result).toContain("name: email");
    expect(result).toContain("optional: true");
  });

  it("omits default method for syncs (GET)", () => {
    const nodes = [
      makeNode("s1", "sync", {
        label: "Repos",
        endpoint: "/repos",
        frequency: "every 6h",
        modelRef: "Repo",
        method: "GET",
      }),
    ];
    const result = graphToYaml(baseProject, nodes, []);
    expect(result).not.toContain("method:");
  });

  it("includes non-default method for syncs", () => {
    const nodes = [
      makeNode("s1", "sync", {
        label: "Repos",
        endpoint: "/repos",
        frequency: "every 6h",
        modelRef: "Repo",
        method: "POST",
      }),
    ];
    const result = graphToYaml(baseProject, nodes, []);
    expect(result).toContain("method: POST");
  });

  it("includes description when provided", () => {
    const nodes = [
      makeNode("s1", "sync", {
        label: "Users",
        description: "Fetches all users",
        endpoint: "/users",
        frequency: "every 1h",
        modelRef: "User",
      }),
    ];
    const result = graphToYaml(baseProject, nodes, []);
    expect(result).toContain("description: Fetches all users");
  });
});

// ── yamlToGraph tests ───────────────────────────────────────────────────

describe("yamlToGraph", () => {
  it("parses empty YAML gracefully", () => {
    const result = yamlToGraph("");
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("parses a sync + model from YAML", () => {
    const yamlStr = `
integrations:
  github:
    syncs:
      Users:
        endpoint: /users
        frequency: every 1h
        output: User
models:
  User:
    - name: id
      type: string
    - name: email
      type: string
      optional: true
`;
    const result = yamlToGraph(yamlStr);
    expect(result.project.provider).toBe("github");
    expect(result.nodes.length).toBeGreaterThanOrEqual(2);

    const syncNode = result.nodes.find((n) => n.type === "sync");
    expect(syncNode).toBeDefined();
    expect(syncNode!.data.label).toBe("Users");
    expect(syncNode!.data.endpoint).toBe("/users");

    const modelNode = result.nodes.find((n) => n.type === "model");
    expect(modelNode).toBeDefined();
    expect(modelNode!.data.label).toBe("User");
    expect((modelNode!.data as { fields: unknown[] }).fields).toHaveLength(2);

    // Should create edge from sync to model
    expect(result.edges.length).toBeGreaterThanOrEqual(1);
  });

  it("parses actions from YAML", () => {
    const yamlStr = `
integrations:
  slack:
    actions:
      SendMessage:
        endpoint: /messages
        input: MessageInput
        output: MessageResult
models:
  MessageInput:
    - name: channel
      type: string
  MessageResult:
    - name: ok
      type: boolean
`;
    const result = yamlToGraph(yamlStr);
    const actionNode = result.nodes.find((n) => n.type === "action");
    expect(actionNode).toBeDefined();
    expect(actionNode!.data.label).toBe("SendMessage");
    expect(actionNode!.data.inputModelRef).toBe("MessageInput");
    expect(actionNode!.data.outputModelRef).toBe("MessageResult");
  });

  it("round-trips graph → YAML → graph", () => {
    const originalNodes = [
      makeNode("s1", "sync", {
        label: "Issues",
        endpoint: "/issues",
        frequency: "every 30m",
        modelRef: "Issue",
        method: "GET",
      }),
      makeNode("m1", "model", {
        label: "Issue",
        fields: [
          { name: "id", type: "number", optional: false },
          { name: "title", type: "string", optional: false },
        ],
      }),
    ];
    const yamlStr = graphToYaml(baseProject, originalNodes, []);
    const parsed = yamlToGraph(yamlStr);

    const syncNode = parsed.nodes.find((n) => n.type === "sync");
    expect(syncNode!.data.label).toBe("Issues");
    expect(syncNode!.data.endpoint).toBe("/issues");
    expect(syncNode!.data.frequency).toBe("every 30m");

    const modelNode = parsed.nodes.find((n) => n.type === "model");
    expect(modelNode!.data.label).toBe("Issue");
    expect((modelNode!.data as { fields: unknown[] }).fields).toHaveLength(2);
  });
});
