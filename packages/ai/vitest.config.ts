import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Testcontainers boot can take a while on a cold pull (the usage and
    // budget suites).
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
        // `pricing.ts` and the prompt builders are pure logic and hold the
        // 90% floor: a wrong cost figure is a wrong invoice, and a prompt
        // builder is the one place authored content is delimited from
        // instructions (ADR-097 #11).
        "src/pricing.ts": { lines: 90, statements: 90, functions: 90, branches: 90 },
        "src/prompts/**": { lines: 90, statements: 90, functions: 90, branches: 90 },
        // Branches sit at 75 here, and deliberately: `translate()`'s final
        // `throw error` is a defensive re-throw for an error type `@repo/secrets`
        // cannot produce, so the only way to reach it is to mock our own
        // package — which testing.md forbids outright ("Never mock our own
        // packages to make a test pass"). `packages/email/src/secret.ts` has
        // the identical shape and the identical uncovered line; lines,
        // statements and functions still hold the 90% pure-logic floor.
        "src/secret.ts": { lines: 90, statements: 90, functions: 90, branches: 75 },
      },
    },
  },
});
