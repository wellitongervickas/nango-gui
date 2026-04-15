import type { ModelField } from "../types/flow";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Map a JS value to a Nango model type string.
 */
function inferType(value: JsonValue): string {
  if (value === null) return "string";
  if (Array.isArray(value)) {
    if (value.length === 0) return "string[]";
    return `${inferType(value[0])}[]`;
  }
  switch (typeof value) {
    case "string":
      return isIsoDate(value) ? "date" : "string";
    case "number":
      return Number.isInteger(value) ? "integer" : "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return "string";
  }
}

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function isIsoDate(s: string): boolean {
  return ISO_DATE_RE.test(s);
}

/**
 * Infer ModelField[] from a JSON sample (object or array of objects).
 *
 * If the sample is an array, fields are merged across all items —
 * a field missing from some items is marked optional.
 */
export function inferSchemaFromJson(jsonStr: string): ModelField[] {
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(jsonStr) as JsonValue;
  } catch {
    return [];
  }

  if (Array.isArray(parsed)) {
    return inferFromArray(parsed);
  }

  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    return inferFromObject(parsed as Record<string, JsonValue>);
  }

  return [];
}

function inferFromObject(obj: Record<string, JsonValue>): ModelField[] {
  return Object.entries(obj).map(([key, value]) => ({
    name: key,
    type: inferType(value),
    optional: false,
  }));
}

function inferFromArray(arr: JsonValue[]): ModelField[] {
  const objects = arr.filter(
    (item): item is Record<string, JsonValue> =>
      item !== null && typeof item === "object" && !Array.isArray(item),
  );

  if (objects.length === 0) return [];

  // Collect all unique keys and their inferred types
  const fieldMap = new Map<string, { type: string; count: number }>();

  for (const obj of objects) {
    for (const [key, value] of Object.entries(obj)) {
      const existing = fieldMap.get(key);
      if (!existing) {
        fieldMap.set(key, { type: inferType(value), count: 1 });
      } else {
        existing.count++;
        // Widen type if different items produce different types
        const newType = inferType(value);
        if (existing.type !== newType) {
          existing.type = widenType(existing.type, newType);
        }
      }
    }
  }

  const totalObjects = objects.length;
  return Array.from(fieldMap.entries()).map(([name, { type, count }]) => ({
    name,
    type,
    optional: count < totalObjects,
  }));
}

/**
 * When two items in an array disagree on a field's type,
 * pick the wider type.
 */
function widenType(a: string, b: string): string {
  // integer + number → number
  if (
    (a === "integer" && b === "number") ||
    (a === "number" && b === "integer")
  )
    return "number";
  // date + string → string
  if ((a === "date" && b === "string") || (a === "string" && b === "date"))
    return "string";
  // any other mismatch → string (safest common type)
  return "string";
}
