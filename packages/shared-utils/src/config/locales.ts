import { IntlMessageFormat } from "intl-messageformat";

import { deepMerge } from "./deep-merge.js";
import { cloneJson, isJsonObject } from "./json.js";

import type { JsonObject, JsonValue} from "./json.js";

const GLOBAL_LOCALES = import.meta.glob("../../locales/*/*.json", {
  eager: true,
  import: "default"
}) as Record<string, JsonObject>;

const APP_LOCALES = import.meta.glob("../../apps/*/locales/*/*.json", {
  eager: true,
  import: "default"
}) as Record<string, JsonObject>;

export type LocaleBundle = Record<string, JsonObject>;
export type Translator = (key: string, values?: Record<string, unknown>) => string;

export function loadLocaleBundle(appId: string, locale: string): LocaleBundle {
  const bundle: LocaleBundle = {};

  for (const [path, messages] of Object.entries(GLOBAL_LOCALES)) {
    const namespace = extractNamespace(path, locale);
    if (!namespace) {continue;}
    bundle[namespace] = bundle[namespace]
      ? (deepMerge(bundle[namespace], messages) as JsonObject)
      : cloneJson(messages);
  }

  const appNeedle = `/apps/${appId}/`;
  for (const [path, messages] of Object.entries(APP_LOCALES)) {
    if (!path.includes(appNeedle)) {continue;}
    const namespace = extractNamespace(path, locale);
    if (!namespace) {continue;}
    bundle[namespace] = bundle[namespace]
      ? (deepMerge(bundle[namespace], messages) as JsonObject)
      : cloneJson(messages);
  }

  return bundle;
}

export function createTranslator(options: {
  locale: string;
  bundles: LocaleBundle;
  fallback?: { locale: string; bundles: LocaleBundle };
}): Translator {
  const primary = flattenBundles(options.bundles);
  const fallback = options.fallback ? flattenBundles(options.fallback.bundles) : undefined;
  const cache = new Map<string, IntlMessageFormat>();

  return (key, values) => {
    const message = primary[key] ?? fallback?.[key];
    if (!message) {
      return key;
    }
    const locale = primary[key] ? options.locale : options.fallback?.locale ?? options.locale;
    const cacheKey = `${locale}:${key}`;
    let formatter = cache.get(cacheKey);
    if (!formatter) {
      formatter = new IntlMessageFormat(message, locale);
      cache.set(cacheKey, formatter);
    }
    const result = formatter.format(values);
    if (Array.isArray(result)) {
      return result.join("");
    }
    return typeof result === "string" ? result : String(result);
  };
}

function extractNamespace(path: string, locale: string): string | undefined {
  const normalized = path.replace(/\\/g, "/");
  const match = normalized.match(new RegExp(`/locales/${locale}/([^/]+)\\.json$`));
  return match?.[1];
}

function flattenBundles(bundles: LocaleBundle): Record<string, string> {
  const acc: Record<string, string> = {};
  for (const [namespace, messages] of Object.entries(bundles)) {
    flattenNamespace(messages, namespace, acc);
  }
  return acc;
}

function flattenNamespace(value: JsonValue, prefix: string, acc: Record<string, string>) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    acc[prefix] = String(value);
    return;
  }
  if (value === null) {
    acc[prefix] = "";
    return;
  }
  if (Array.isArray(value)) {
    acc[prefix] = value.map((item) => String(item)).join(", ");
    return;
  }
  if (isJsonObject(value)) {
    for (const [key, inner] of Object.entries(value)) {
      flattenNamespace(inner, `${prefix}.${key}`, acc);
    }
  }
}

