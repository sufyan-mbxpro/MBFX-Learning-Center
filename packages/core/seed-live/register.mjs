// `node --import ./register.mjs` — points every `next/cache` import at the
// no-op stub beside this file. A resolve HOOK rather than a tsconfig path,
// because the imports that matter live in workspace packages (@repo/core,
// @repo/settings, @repo/rbac) whose own resolution a path mapping here would
// not reach — the same reason core's vitest.config.ts aliases it globally.
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      const stub = ${JSON.stringify(new URL("./next-cache-stub.mjs", import.meta.url).href)};
      export async function resolve(specifier, context, next) {
        if (specifier === "next/cache" || specifier === "next/cache.js") {
          return { url: stub, shortCircuit: true };
        }
        return next(specifier, context);
      }
    `),
);
