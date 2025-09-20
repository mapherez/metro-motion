import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environmentMatchGlobs: [
      ["**/*.test.tsx", "jsdom"],
      ["**/*.spec.tsx", "jsdom"]
    ],
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "lcov"]
    },
    passWithNoTests: true
  }
});