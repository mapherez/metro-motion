import { deepMerge } from "./deep-merge.js";
import { cloneJson, isJsonObject } from "./json.js";

import type { JsonObject, JsonValue} from "./json.js";

const THEME_MODULES = import.meta.glob("../../config/themes/*.json", {
  eager: true,
  import: "default"
}) as Record<string, ThemeDefinition>;

const APP_THEME_CONFIGS = import.meta.glob("../../apps/*/theme.config.json", {
  eager: true,
  import: "default"
}) as Record<string, ThemeConfig>;

export type ThemeDefinition = {
  name: string;
  extends?: string;
  foundations?: JsonObject;
  semantic: JsonObject;
};

export type ThemeConfig = {
  theme: string;
  overrides?: Record<string, JsonValue>;
};

export type ThemeTokens = Record<string, string>;

type ThemeRoot = {
  dataset?: Record<string, string | undefined>;
  style?: { 
    setProperty?(property: string, value: string): void;
  };
};

const THEMES_BY_NAME: Map<string, ThemeDefinition> = new Map(
  Object.values(THEME_MODULES).map((theme) => [theme.name, theme])
);

function resolveDefaultRoot(): ThemeRoot | null {
  const globalDoc = (globalThis as { document?: { documentElement?: ThemeRoot } }).document;
  return globalDoc?.documentElement ?? null;
}

export function loadThemeConfig(appId: string): ThemeConfig {
  const entry = Object.entries(APP_THEME_CONFIGS).find(([path]) => path.includes(`/apps/${appId}/`));
  if (!entry) {
    return { theme: "light" };
  }
  return entry[1];
}

export function resolveTheme(name: string): ThemeDefinition {
  return resolveThemeRecursive(name, []);
}

export function buildThemeTokens(themeName: string, overrides?: Record<string, JsonValue>): ThemeTokens {
  const definition = resolveTheme(themeName);
  const withOverrides = overrides ? applyOverrides(definition, overrides) : definition;
  return buildTokensFromDefinition(withOverrides);
}

export function buildThemeTokensForApp(appId: string, themeName?: string): ThemeTokens {
  const config = loadThemeConfig(appId);
  const targetTheme = themeName ?? config.theme ?? "light";
  return buildThemeTokens(targetTheme, config.overrides);
}

export function applyTheme(
  themeName: string,
  root: ThemeRoot | null = resolveDefaultRoot(),
  overrides?: Record<string, JsonValue>
): ThemeTokens {
  const tokens = buildThemeTokens(themeName, overrides);
  if (!root) {
    return tokens;
  }

  if (root.dataset) {
    root.dataset.theme = themeName;
  }

  const setProperty = root.style?.setProperty;
  if (typeof setProperty === "function") {
    for (const [token, value] of Object.entries(tokens)) {
      setProperty.call(root.style, token, value);
    }
    if (themeName === "dark") {
      setProperty.call(root.style, "color-scheme", "dark");
    } else if (themeName === "light") {
      setProperty.call(root.style, "color-scheme", "light");
    }
  }
  return tokens;
}

function buildTokensFromDefinition(definition: ThemeDefinition): ThemeTokens {
  const context: JsonObject = {
    ...(definition.foundations ?? {})
  };
  const resolved = resolveSemantic(definition.semantic, context);
  const tokens: ThemeTokens = {};
  flattenTokens(resolved, [], tokens);
  return tokens;
}

function resolveThemeRecursive(name: string, stack: string[]): ThemeDefinition {
  const definition = THEMES_BY_NAME.get(name);
  if (!definition) {
    throw new Error(`Theme "${name}" is not defined.`);
  }
  if (stack.includes(name)) {
    throw new Error(`Circular theme inheritance detected: ${[...stack, name].join(' -> ')}`);
  }
  if (!definition.extends) {
    return cloneJson(definition as unknown as JsonValue) as ThemeDefinition;
  }
  const parent = resolveThemeRecursive(definition.extends, [...stack, name]);
  const own = cloneJson({ ...definition, extends: undefined } as unknown as JsonValue) as JsonObject;
  const merged = deepMerge(parent as unknown as JsonObject, own);
  (merged as ThemeDefinition).name = definition.name;
  return merged as ThemeDefinition;
}

function applyOverrides(definition: ThemeDefinition, overrides: Record<string, JsonValue>): ThemeDefinition {
  const clone = cloneJson(definition as unknown as JsonValue) as unknown as JsonObject;
  for (const [path, value] of Object.entries(overrides)) {
    setByPath(clone, path, value);
  }
  return clone as ThemeDefinition;
}

function resolveSemantic(value: JsonObject, context: JsonObject): JsonObject {
  const result: JsonObject = {};
  for (const [key, inner] of Object.entries(value)) {
    result[key] = resolveValue(inner, context);
  }
  return result;
}

function resolveValue(value: JsonValue, context: JsonObject): JsonValue {
  if (typeof value === "string") {
    const match = value.match(/^\{\s*([^}]+)\s*}$/);
    if (!match) {
      return value;
    }
    const resolved = getFromContext(context, match[1]);
    if (resolved === undefined) {
      throw new Error(`Theme token reference "${match[1]}" is undefined.`);
    }
    return cloneJson(resolved);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, context)) as JsonValue;
  }

  if (isJsonObject(value)) {
    const resolvedObject: JsonObject = {};
    for (const [key, inner] of Object.entries(value)) {
      resolvedObject[key] = resolveValue(inner, context);
    }
    return resolvedObject;
  }

  return value;
}

function getFromContext(context: JsonObject, path: string): JsonValue | undefined {
  const segments = tokenizePath(path);
  let current: JsonValue = context;
  for (const segment of segments) {
    if (typeof segment === "number") {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[segment];
      continue;
    }
    if (!isJsonObject(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current as JsonValue | undefined;
}

function setByPath(target: JsonObject, path: string, value: JsonValue) {
  const segments = tokenizePath(path);
  if (segments.length === 0) {
    return;
  }
  let current: JsonObject = target;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const isLast = i === segments.length - 1;
    if (typeof segment === "number") {
      throw new Error("Array overrides are not supported in theme overrides.");
    }
    if (isLast) {
      current[segment] = cloneJson(value);
      return;
    }
    const next = current[segment];
    if (!isJsonObject(next)) {
      current[segment] = {};
    }
    current = current[segment] as JsonObject;
  }
}

function tokenizePath(path: string): Array<string | number> {
  const result: Array<string | number> = [];
  const regex = /([^.[\]]+)|(\[(\d+)\])/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path)) !== null) {
    if (match[1]) {
      result.push(match[1]);
    } else if (match[3]) {
      result.push(Number(match[3]));
    }
  }
  return result;
}

function flattenTokens(value: JsonValue, segments: string[], acc: ThemeTokens) {
  if (isJsonObject(value)) {
    for (const [key, inner] of Object.entries(value)) {
      flattenTokens(inner, [...segments, key], acc);
    }
    return;
  }

  if (Array.isArray(value)) {
    return;
  }

  if (segments.length === 0) {
    return;
  }

  const name = `--${segments.map(toKebabCase).join("-")}`;
  acc[name] = String(value);
}

function toKebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}


