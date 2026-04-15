import { describe, it, expect } from "vitest";
import { inferSchemaFromJson } from "../codegen/infer-schema";

describe("inferSchemaFromJson", () => {
  it("returns empty array for invalid JSON", () => {
    expect(inferSchemaFromJson("not json")).toHaveLength(0);
  });

  it("returns empty array for primitive JSON", () => {
    expect(inferSchemaFromJson('"hello"')).toHaveLength(0);
    expect(inferSchemaFromJson("42")).toHaveLength(0);
  });

  it("infers fields from a simple object", () => {
    const json = JSON.stringify({
      id: 1,
      name: "Alice",
      active: true,
    });
    const fields = inferSchemaFromJson(json);
    expect(fields).toHaveLength(3);
    expect(fields.find((f) => f.name === "id")).toEqual({
      name: "id",
      type: "integer",
      optional: false,
    });
    expect(fields.find((f) => f.name === "name")).toEqual({
      name: "name",
      type: "string",
      optional: false,
    });
    expect(fields.find((f) => f.name === "active")).toEqual({
      name: "active",
      type: "boolean",
      optional: false,
    });
  });

  it("infers date type from ISO date strings", () => {
    const json = JSON.stringify({
      created: "2024-01-15T10:30:00Z",
      updated: "2024-01-15",
    });
    const fields = inferSchemaFromJson(json);
    expect(fields.find((f) => f.name === "created")?.type).toBe("date");
    expect(fields.find((f) => f.name === "updated")?.type).toBe("date");
  });

  it("infers number vs integer", () => {
    const json = JSON.stringify({
      count: 42,
      ratio: 3.14,
    });
    const fields = inferSchemaFromJson(json);
    expect(fields.find((f) => f.name === "count")?.type).toBe("integer");
    expect(fields.find((f) => f.name === "ratio")?.type).toBe("number");
  });

  it("infers array types", () => {
    const json = JSON.stringify({
      tags: ["a", "b"],
      scores: [1, 2, 3],
      empty: [],
    });
    const fields = inferSchemaFromJson(json);
    expect(fields.find((f) => f.name === "tags")?.type).toBe("string[]");
    expect(fields.find((f) => f.name === "scores")?.type).toBe("integer[]");
    expect(fields.find((f) => f.name === "empty")?.type).toBe("string[]");
  });

  it("infers object type for nested objects", () => {
    const json = JSON.stringify({
      address: { city: "NYC", zip: "10001" },
    });
    const fields = inferSchemaFromJson(json);
    expect(fields.find((f) => f.name === "address")?.type).toBe("object");
  });

  it("handles null values as string", () => {
    const json = JSON.stringify({ nickname: null });
    const fields = inferSchemaFromJson(json);
    expect(fields.find((f) => f.name === "nickname")?.type).toBe("string");
  });

  // ── Array input ──────────────────────────────────────────────────────

  it("merges fields across array items", () => {
    const json = JSON.stringify([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob", email: "bob@example.com" },
    ]);
    const fields = inferSchemaFromJson(json);
    expect(fields).toHaveLength(3);
    expect(fields.find((f) => f.name === "id")?.optional).toBe(false);
    expect(fields.find((f) => f.name === "name")?.optional).toBe(false);
    expect(fields.find((f) => f.name === "email")?.optional).toBe(true);
  });

  it("widens integer to number when array items disagree", () => {
    const json = JSON.stringify([{ value: 42 }, { value: 3.14 }]);
    const fields = inferSchemaFromJson(json);
    expect(fields.find((f) => f.name === "value")?.type).toBe("number");
  });

  it("widens date to string when array items disagree", () => {
    const json = JSON.stringify([
      { ts: "2024-01-15T10:30:00Z" },
      { ts: "not-a-date" },
    ]);
    const fields = inferSchemaFromJson(json);
    expect(fields.find((f) => f.name === "ts")?.type).toBe("string");
  });

  it("returns empty for array of primitives", () => {
    const json = JSON.stringify([1, 2, 3]);
    expect(inferSchemaFromJson(json)).toHaveLength(0);
  });

  it("handles empty object", () => {
    expect(inferSchemaFromJson("{}")).toHaveLength(0);
  });

  it("handles empty array", () => {
    expect(inferSchemaFromJson("[]")).toHaveLength(0);
  });
});
