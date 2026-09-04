import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Testcontainers boot can take a while on a cold pull.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      // testing.md: 90% floor on pure-logic packages — this one carries
      // the heaviest unit suite in the repo (SKILL.md).
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
