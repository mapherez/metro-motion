import { deepMerge, mergeMany } from "./deep-merge.js";

import type { JsonObject } from "./json.js";

const GLOBAL_SETTINGS = import.meta.glob("../../config/settings/*.json", {
  eager: true,
  import: "default"
}) as Record<string, JsonObject>;

const APP_SETTINGS = import.meta.glob("../../apps/*/app.config.json", {
  eager: true,
  import: "default"
}) as Record<string, JsonObject>;

export type FeatureFlags = Record<string, boolean>;

export type AppSettings = {
  defaultLocale: string;
  supportedLocales: string[];
  theme?: string;
  featureFlags?: FeatureFlags;
  routes?: Record<string, string>;
  [key: string]: unknown;
};

export function loadSettings(appId: string): AppSettings {
  const globals = mergeMany<JsonObject>(Object.values(GLOBAL_SETTINGS));
  const appEntry = findAppEntry(appId);
  if (!appEntry) {
    return globals as AppSettings;
  }
  return deepMerge(globals, appEntry) as AppSettings;
}

function findAppEntry(appId: string): JsonObject | undefined {
  const needle = `/apps/${appId}/`;
  const entry = Object.entries(APP_SETTINGS).find(([path]) => path.includes(needle));
  return entry?.[1];
}

