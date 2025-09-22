import { fileURLToPath, URL } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { deepMerge, mergeMany } from "./deep-merge.js";

import type { JsonObject } from "./json.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Load global settings - config is at workspace root, not relative to this package
const settingsDir = resolve(__dirname, "../../../../config/settings");
const GLOBAL_SETTINGS: Record<string, JsonObject> = {};

readdirSync(settingsDir)
  .filter((file: string) => file.endsWith(".json"))
  .forEach((file: string) => {
    const fullPath = join(settingsDir, file);
    // Use dynamic import for JSON files
    GLOBAL_SETTINGS[fullPath] = JSON.parse(readFileSync(fullPath, "utf-8"));
  });

// Load app settings - apps are at workspace root, not relative to this package
const appsDir = resolve(__dirname, "../../../../apps");
const APP_SETTINGS: Record<string, JsonObject> = {};

readdirSync(appsDir)
  .forEach((app: string) => {
    const configPath = join(appsDir, app, "app.config.json");
    try {
      APP_SETTINGS[configPath] = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch (err) {
      // Skip if app.config.json doesn't exist
    }
  });

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

