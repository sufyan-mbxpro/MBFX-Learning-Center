import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      // testing.md: 90% floor on pure-logic packages (utils named).
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
