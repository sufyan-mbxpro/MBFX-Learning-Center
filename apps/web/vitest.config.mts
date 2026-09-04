import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.mts"],
    // Vitest's default Node-ESM externalization can't resolve next-intl's
    // nested `next/server` import through pnpm's isolated node_modules
    // (peer dep, not a real nested copy) — inlining routes it through
    // Vite's own resolver, which understands pnpm's layout correctly.
    server: {
      deps: {
        inline: [/next-intl/],
      },
    },
  },
});
