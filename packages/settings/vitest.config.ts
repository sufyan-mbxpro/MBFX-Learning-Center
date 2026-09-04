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
      // testing.md: 80% floor on service packages (settings is named explicitly).
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
