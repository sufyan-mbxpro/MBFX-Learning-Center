import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Testcontainers boot can take a while on a cold pull (the Mailpit suite).
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // testing.md reserves mocks for the network edge; `testing.ts` IS that
      // edge for our own callers, and carries no logic of its own.
      exclude: ["src/**/*.test.ts", "src/testing.ts"],
      thresholds: {
        // testing.md #1 — 80% on a service package.
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
        // secret.ts is pure logic guarding the one database secret, so it
        // holds the 90% pure-logic floor.
        "src/secret.ts": { lines: 90, statements: 90, functions: 90, branches: 90 },
      },
    },
  },
});
