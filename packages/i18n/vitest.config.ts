import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Testcontainers boot can take a while on a cold pull.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/request.ts", "src/routing.ts", "src/navigation.ts"],
      // testing.md: 80% floor on service packages. request.ts/routing.ts/
      // navigation.ts are next-intl wiring exercised through the live
      // apps/web build+dev-server verification (DEVLOG), not unit-testable
      // in isolation without a full Next.js request/render context.
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
