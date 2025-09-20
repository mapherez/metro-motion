import { isJsonObject, cloneJson } from "./json.js";

import type { JsonObject, JsonValue} from "./json.js";

export function deepMerge<T extends JsonObject, U extends JsonObject>(target: T, source: U): T & U {
  const result: JsonObject = cloneJson(target);

  for (const [key, value] of Object.entries(source)) {
    const existing = result[key];
    if (isJsonObject(existing) && isJsonObject(value)) {
      result[key] = deepMerge(existing, value);
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = cloneJson(value);
      continue;
    }

    result[key] = cloneJson(value as JsonValue);
  }

  return result as T & U;
}

export function mergeMany<T extends JsonObject>(parts: ReadonlyArray<JsonObject>): T {
  return parts.reduce<JsonObject>((acc, part) => deepMerge(acc, part), {} as JsonObject) as T;
}

