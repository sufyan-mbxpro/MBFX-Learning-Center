import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The settings and usage suite boots a MariaDB container.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // `testing.ts` is the fake network edge (testing.md) and carries no logic.
      exclude: ["src/**/*.test.ts", "src/testing.ts"],
      thresholds: {
        // testing.md #1 — 80% on a service package.
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
        // Pure logic holds the 90% floor: a wrong placeholder is a broken
        // message on a live page, and a wrong number check lets a changed
        // leverage figure through.
        // Branches at 85, deliberately (`@repo/ai`'s secret.ts precedent):
        // three refusals are defensive and unreachable by construction — a
        // selector `hoistSelectors` did not lift, and a rebuilt message that
        // fails to re-parse or changes its arguments. Placeholders are
        // protected and counted before either check runs, so reaching them
        // would take mocking our own code, which testing.md forbids. They stay
        // because the cost of being wrong is a broken message on a live page.
        "src/icu.ts": { lines: 90, statements: 90, functions: 90, branches: 85 },
        "src/html.ts": { lines: 90, statements: 90, functions: 90, branches: 90 },
        "src/numbers.ts": { lines: 90, statements: 90, functions: 90, branches: 90 },
        "src/batch.ts": { lines: 90, statements: 90, functions: 90, branches: 90 },
      },
    },
  },
});
