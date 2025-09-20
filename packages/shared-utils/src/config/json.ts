export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cloneJson<T extends JsonValue>(value: T): T {
  const clone = typeof globalThis.structuredClone === "function" ? globalThis.structuredClone : undefined;
  if (clone) {
    return clone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}