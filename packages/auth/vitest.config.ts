import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    // Testcontainers boot can take a while on a cold pull.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
