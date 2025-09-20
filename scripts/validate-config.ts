import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";
import type { ErrorObject } from "ajv";
import addFormats from "ajv-formats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

type SchemaName = "settings" | "appConfig" | "theme" | "locale";

type Validators = Record<SchemaName, Ajv.ValidateFunction>;

type JsonFile = string;

type ValidationResult = {
  file: JsonFile;
  errors: string[];
};

async function main() {
  const validators = await compileValidators();
  const issues: ValidationResult[] = [];

  issues.push(
    ...(await validateFiles("settings", await collectGlobalSettingsDefaults(), validators))
  );
  issues.push(
    ...(await validateFiles(
      "appConfig",
      [
        ...(await collectGlobalSettingsOverrides()),
        ...(await collectAppConfigFiles())
      ],
      validators
    ))
  );
  issues.push(
    ...(await validateFiles("theme", await listJsonFiles(path.join(ROOT_DIR, "config", "themes")), validators))
  );
  issues.push(
    ...(await validateFiles(
      "locale",
      [
        ...(await listJsonFiles(path.join(ROOT_DIR, "locales"))),
        ...(await collectAppLocaleFiles())
      ],
      validators
    ))
  );

  const flatErrors = issues.flatMap((issue) =>
    issue.errors.map((message) => `${toRelative(issue.file)}: ${message}`)
  );

  if (flatErrors.length > 0) {
    console.error("Config validation failed:");
    for (const message of flatErrors) {
      console.error(` - ${message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Config validation passed.");
}

async function compileValidators(): Promise<Validators> {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const load = async (relative: string) => {
    const schemaPath = path.join(ROOT_DIR, relative);
    const raw = await fs.readFile(schemaPath, "utf8");
    return JSON.parse(raw);
  };

  const settingsSchema = await load(path.join("config", "schemas", "settings.schema.json"));
  const appConfigSchema = await load(path.join("config", "schemas", "app-config.schema.json"));
  const themeSchema = await load(path.join("config", "schemas", "theme.schema.json"));
  const localeSchema = await load(path.join("config", "schemas", "locale.schema.json"));

  return {
    settings: ajv.compile(settingsSchema),
    appConfig: ajv.compile(appConfigSchema),
    theme: ajv.compile(themeSchema),
    locale: ajv.compile(localeSchema)
  };
}

async function validateFiles(
  schemaName: SchemaName,
  files: JsonFile[],
  validators: Validators
): Promise<ValidationResult[]> {
  const validate = validators[schemaName];
  if (!validate) {
    throw new Error(`Missing validator for schema: ${schemaName}`);
  }

  const relevantFiles = files.filter(Boolean);
  if (relevantFiles.length === 0) {
    return [];
  }

  const results: ValidationResult[] = [];
  for (const file of relevantFiles) {
    const data = await readJson(file);
    if (!validate(data)) {
      const errors = (validate.errors ?? []).map((error) => formatAjvError(error));
      results.push({ file, errors });
    }
  }
  return results;
}

function formatAjvError(error: ErrorObject): string {
  const pathText = error.instancePath ? error.instancePath : "(root)";
  const message = error.message ?? "validation error";
  if (error.keyword === "additionalProperties" && typeof error.params.additionalProperty === "string") {
    return `${pathText} has unknown property '${error.params.additionalProperty}'`;
  }
  return `${pathText} ${message}`;
}

async function listJsonFiles(dir: string): Promise<JsonFile[]> {
  const files: JsonFile[] = [];
  const exists = await directoryExists(dir);
  if (!exists) {
    return files;
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(path.join(dir, entry.name))));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

async function collectGlobalSettingsDefaults(): Promise<JsonFile[]> {
  const defaults = path.join(ROOT_DIR, "config", "settings", "defaults.json");
  if (await fileExists(defaults)) {
    return [defaults];
  }
  return [];
}

async function collectGlobalSettingsOverrides(): Promise<JsonFile[]> {
  const dir = path.join(ROOT_DIR, "config", "settings");
  if (!(await directoryExists(dir))) {
    return [];
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: JsonFile[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "defaults.json") {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

async function collectAppConfigFiles(): Promise<JsonFile[]> {
  const appsRoot = path.join(ROOT_DIR, "apps");
  const exists = await directoryExists(appsRoot);
  if (!exists) {
    return [];
  }
  const results: JsonFile[] = [];
  const apps = await fs.readdir(appsRoot, { withFileTypes: true });
  for (const entry of apps) {
    if (!entry.isDirectory()) {
      continue;
    }
    const candidate = path.join(appsRoot, entry.name, "app.config.json");
    if (await fileExists(candidate)) {
      results.push(candidate);
    }
  }
  return results;
}

async function collectAppLocaleFiles(): Promise<JsonFile[]> {
  const appsRoot = path.join(ROOT_DIR, "apps");
  const exists = await directoryExists(appsRoot);
  if (!exists) {
    return [];
  }
  const results: JsonFile[] = [];
  const apps = await fs.readdir(appsRoot, { withFileTypes: true });
  for (const entry of apps) {
    if (!entry.isDirectory()) {
      continue;
    }
    const localesDir = path.join(appsRoot, entry.name, "locales");
    results.push(...(await listJsonFiles(localesDir)));
  }
  return results;
}

async function readJson(file: string): Promise<unknown> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read JSON at ${toRelative(file)}: ${message}`);
  }
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dir);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(target: string): Promise<boolean> {
  try {
    const stats = await fs.stat(target);
    return stats.isFile();
  } catch {
    return false;
  }
}

function toRelative(file: string): string {
  return path.relative(ROOT_DIR, file).replace(/\\/g, "/");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});