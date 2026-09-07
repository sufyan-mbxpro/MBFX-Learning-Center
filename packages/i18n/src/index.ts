// @repo/i18n — next-intl config, message catalogs, locale utils (Module 06).
// `./routing`, `./navigation`, `./request` are separate subpath exports
// (see package.json) — next-intl's own convention keeps those out of the
// main barrel so a route handler that only needs `computeSourceHash` isn't
// pulling in the routing/middleware graph.
export * from "./fallback.ts";
export * from "./source-hash.ts";
export * from "./locales.ts";
export type { MessageKey, MessageNamespace, Messages } from "./message-keys.ts";
