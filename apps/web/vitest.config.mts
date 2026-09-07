import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.mts"],
    // `e2e/` belongs to Playwright, which has its own runner and config.
    // Without this, vitest collects those .spec.ts files and each one dies
    // with "Playwright Test did not expect test() to be called here" — two
    // red files on every `pnpm test` that say nothing about the code.
    // Found while adding the first unit test under app/ (changes-09 PR 3);
    // it has been failing since the E2E harness landed.
    exclude: [...configDefaults.exclude, "e2e/**"],
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
