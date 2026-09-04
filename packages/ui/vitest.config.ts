import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Map the package's own self-referencing import alias (components import
  // "@repo/ui/lib/utils" etc. — the shadcn convention) back to src.
  resolve: {
    alias: {
      "@repo/ui": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    // Under a fully-parallel `turbo test` (12 packages, several of them
    // spinning MariaDB containers), jsdom environment startup has been
    // observed taking 90s+ — the two flakes on this suite were timeouts,
    // not product failures. Same headroom the Testcontainers suites get.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
