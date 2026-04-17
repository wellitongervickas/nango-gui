import { describe, it, expect } from "vitest";
import type { AiGenerationResult } from "@nango-gui/shared";
import { definitionToFlow } from "../graph-converter";

const BASIC_YAML = `
integrations:
  github:
    syncs:
      list-repos:
        runs: every 6h
        description: Fetch all repos
        output: GithubRepo
        endpoint: /repos
    actions:
      create-issue:
        description: Create an issue
        input: CreateIssueInput
        output: GithubIssue
        endpoint:
          method: POST
          path: /issues
models:
  GithubRepo:
    id: string
    name: string
    full_name: string
    private: boolean
  GithubIssue:
    id: integer
    title: string
    body?: string
  CreateIssueInput:
    title: string
    body: string
`;

function makeDefinition(yamlStr: string): AiGenerationResult {
  return {
    provider: "github",
    description: "Test definition",
    yaml: yamlStr,
    typescript: "",
  };
}

describe("definitionToFlow", () => {
  it("returns empty graph for empty yaml", () => {
    const result = definitionToFlow(makeDefinition(""));
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("returns empty graph for invalid yaml", () => {
    const result = definitionToFlow(makeDefinition("{{invalid"));
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("parses basic nango.yaml into correct node types", () => {
    const { nodes } = definitionToFlow(makeDefinition(BASIC_YAML));

    const syncNodes = nodes.filter((n) => n.type === "sync");
    const actionNodes = nodes.filter((n) => n.type === "action");
    const modelNodes = nodes.filter((n) => n.type === "model");

    expect(syncNodes).toHaveLength(1);
    expect(actionNodes).toHaveLength(1);
    expect(modelNodes).toHaveLength(3);
  });

  it("extracts sync node data correctly", () => {
    const { nodes } = definitionToFlow(makeDefinition(BASIC_YAML));
    const sync = nodes.find((n) => n.type === "sync")!;

    expect(sync.data.label).toBe("list-repos");
    expect(sync.data.description).toBe("Fetch all repos");
    expect(sync.data.frequency).toBe("every 6h");
    expect(sync.data.endpoint).toBe("/repos");
    expect(sync.data.modelRef).toBe("GithubRepo");
  });

  it("extracts action node data correctly", () => {
    const { nodes } = definitionToFlow(makeDefinition(BASIC_YAML));
    const action = nodes.find((n) => n.type === "action")!;

    expect(action.data.label).toBe("create-issue");
    expect(action.data.description).toBe("Create an issue");
    expect(action.data.inputModelRef).toBe("CreateIssueInput");
    expect(action.data.outputModelRef).toBe("GithubIssue");
    expect(action.data.endpoint).toBe("/issues");
  });

  it("extracts model fields with correct types", () => {
    const { nodes } = definitionToFlow(makeDefinition(BASIC_YAML));
    const repoModel = nodes.find(
      (n) => n.type === "model" && n.data.label === "GithubRepo"
    )!;

    const fields = repoModel.data.fields as Array<{ name: string; type: string; optional: boolean }>;
    expect(fields).toHaveLength(4);
    expect(fields.find((f) => f.name === "id")?.type).toBe("string");
    expect(fields.find((f) => f.name === "private")?.type).toBe("boolean");
  });

  it("marks optional fields correctly", () => {
    const { nodes } = definitionToFlow(makeDefinition(BASIC_YAML));
    const issueModel = nodes.find(
      (n) => n.type === "model" && n.data.label === "GithubIssue"
    )!;

    const fields = issueModel.data.fields as Array<{ name: string; optional: boolean }>;
    expect(fields.find((f) => f.name === "body")?.optional).toBe(true);
    expect(fields.find((f) => f.name === "title")?.optional).toBe(false);
  });

  it("maps integer type to number", () => {
    const { nodes } = definitionToFlow(makeDefinition(BASIC_YAML));
    const issueModel = nodes.find(
      (n) => n.type === "model" && n.data.label === "GithubIssue"
    )!;

    const fields = issueModel.data.fields as Array<{ name: string; type: string }>;
    expect(fields.find((f) => f.name === "id")?.type).toBe("number");
  });

  it("creates edges from sync to output model", () => {
    const { nodes, edges } = definitionToFlow(makeDefinition(BASIC_YAML));

    const sync = nodes.find((n) => n.type === "sync")!;
    const repoModel = nodes.find(
      (n) => n.type === "model" && n.data.label === "GithubRepo"
    )!;

    const edge = edges.find(
      (e) => e.source === sync.id && e.target === repoModel.id
    );
    expect(edge).toBeDefined();
  });

  it("creates edges from action to output model", () => {
    const { nodes, edges } = definitionToFlow(makeDefinition(BASIC_YAML));

    const action = nodes.find((n) => n.type === "action")!;
    const issueModel = nodes.find(
      (n) => n.type === "model" && n.data.label === "GithubIssue"
    )!;

    const edge = edges.find(
      (e) => e.source === action.id && e.target === issueModel.id
    );
    expect(edge).toBeDefined();
  });

  it("handles yaml with only models and no integrations", () => {
    const yamlStr = `
models:
  User:
    id: string
    email: string
`;
    const { nodes, edges } = definitionToFlow(makeDefinition(yamlStr));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("model");
    expect(edges).toHaveLength(0);
  });

  it("handles string endpoint format", () => {
    const yamlStr = `
integrations:
  slack:
    syncs:
      list-channels:
        endpoint: /conversations.list
        output: Channel
models:
  Channel:
    id: string
`;
    const { nodes } = definitionToFlow(makeDefinition(yamlStr));
    const sync = nodes.find((n) => n.type === "sync")!;
    expect(sync.data.endpoint).toBe("/conversations.list");
  });

  it("handles output as array", () => {
    const yamlStr = `
integrations:
  github:
    syncs:
      list-repos:
        output:
          - Repo
models:
  Repo:
    id: string
`;
    const { nodes } = definitionToFlow(makeDefinition(yamlStr));
    const sync = nodes.find((n) => n.type === "sync")!;
    expect(sync.data.modelRef).toBe("Repo");
  });
});
