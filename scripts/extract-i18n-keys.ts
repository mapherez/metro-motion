import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "..");
const targetDirs = ["apps/frontend/src", "apps/backend/src", "packages"];
const ignoreDirs = new Set(["node_modules", "dist", ".turbo", ".git", "coverage", "tests"]);
const targetExts = new Set([".ts", ".tsx"]);
const keyPattern = /\bt\(\s*["'`](.+?)["'`]/g;

async function walk(dir: string, files: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, files);
    } else if (targetExts.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function extractKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const relative of targetDirs) {
    const dir = join(root, relative);
    const filePaths = await walk(dir, []);
    for (const file of filePaths) {
      const content = await readFile(file, "utf8");
      let match: RegExpExecArray | null;
      while ((match = keyPattern.exec(content))) {
        const candidate = match[1].trim();
        if (!candidate || candidate.includes("${")) continue;
        keys.add(candidate);
      }
    }
  }
  return keys;
}

const keys = await extractKeys();
const sorted = Array.from(keys).sort((a, b) => a.localeCompare(b));
if (sorted.length === 0) {
  console.log("No i18n keys found.");
} else {
  console.log(`Found i18n keys (${sorted.length}):`);
  for (const key of sorted) {
    console.log(` - ${key}`);
  }
}
