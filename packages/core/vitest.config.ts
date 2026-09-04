import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // ADR-004: next/cache APIs throw outside a real Next.js process, and
      // core's tests exercise the data paths, not the cache layer — every
      // import of next/cache (core's own AND transitive workspace deps like
      // @repo/settings' updateSetting) resolves to the no-op stub. A
      // per-test vi.doMock can't reach an externalized workspace dep's
      // import, hence config-level.
      "next/cache": fileURLToPath(new URL("./src/test-utils/next-cache-stub.ts", import.meta.url)),
    },
  },
  test: {
    // Testcontainers boot can take a while on a cold pull.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
