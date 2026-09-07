#!/usr/bin/env node
// Module 16, plan v2.2 §7.2/§5.1 — keeps the CMS reserved-path guard in
// packages/contracts/src/cms/paths.ts honest against the real route
// files: a route directory missing from RESERVED_PATHS would let an admin
// create a page that silently shadows it; a RESERVED_PATHS/PREFIXES entry
// with no route behind it is a stale reservation nobody needs.
//
// Parses the TS source as text (the same approach check-permission-keys.mjs
// and check-home-sections.mjs use) rather than importing it, since this is
// a plain Node script with no TS loader.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dirname, "..");
const LOCALE_DIR = join(ROOT, "apps", "web", "app", "(public)", "[locale]");

/** [path relative to apps/web/app, the RESERVED_PATHS name it corresponds to] */
const ROOT_FILE_MAP = [
  ["api", "api"],
  ["uploads", "uploads"],
  ["robots.ts", "robots.txt"],
  ["sitemap.ts", "sitemap.xml"],
  ["favicon.ico", "favicon.ico"],
];

/** Reserved names that exist but aren't discoverable as a route directory or one of ROOT_FILE_MAP's files — `admin` is a route GROUP one level up, `_next` is a Next.js internal, neither ever appears here. */
const SYSTEM_EXEMPT = new Set(["admin", "_next"]);

/** Extracts string entries from `export const NAME = [...] as const`. */
export function extractArrayConst(source, name) {
  const start = source.indexOf(`${name} = [`);
  if (start === -1) return null;
  const rest = source.slice(start);
  const closeIdx = rest.indexOf("] as const");
  const end = closeIdx === -1 ? rest.indexOf("]") : closeIdx;
  if (end === -1) return null;
  return [...rest.slice(0, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Extracts `{ key: "value", ... }` pairs from `export const CONTENT_ROUTES = {...} as const satisfies ...`. */
export function extractContentRoutes(source) {
  const start = source.indexOf("CONTENT_ROUTES");
  if (start === -1) return null;
  const rest = source.slice(start);
  const open = rest.indexOf("{");
  if (open === -1) return null;
  const close = rest.indexOf("}");
  if (close === -1) return null;
  const body = rest.slice(open, close);
  const routes = {};
  for (const m of body.matchAll(/(\w+):\s*"([^"]+)"/g)) routes[m[1]] = m[2];
  return routes;
}

/** Returns an array of human-readable problems; empty means the lists agree. */
export function checkReservedPaths({
  routeSegments,
  rootFiles,
  reservedPaths,
  reservedPrefixes,
  contentRoutes,
}) {
  const problems = [];
  const known = new Set([...reservedPaths, ...reservedPrefixes]);
  const contentRouteSegments = new Set(
    Object.values(contentRoutes).map((route) => route.replace(/^\//, "")),
  );

  for (const segment of routeSegments) {
    if (!known.has(segment) && !contentRouteSegments.has(segment)) {
      problems.push(
        `Route directory "${segment}" under (public)/[locale] is not in RESERVED_PATHS, ` +
          `RESERVED_PREFIXES or CONTENT_ROUTES.`,
      );
    }
  }
  for (const file of rootFiles) {
    if (!known.has(file)) {
      problems.push(`Root file "${file}" is not in RESERVED_PATHS.`);
    }
  }

  const discoverable = new Set([...routeSegments, ...rootFiles]);
  for (const p of reservedPaths) {
    if (!discoverable.has(p) && !SYSTEM_EXEMPT.has(p)) {
      problems.push(`RESERVED_PATHS entry "${p}" has no route file behind it.`);
    }
  }

  return problems;
}

function main() {
  const pathsSource = readFileSync(
    join(ROOT, "packages", "contracts", "src", "cms", "paths.ts"),
    "utf8",
  );
  const reservedPaths = extractArrayConst(pathsSource, "RESERVED_PATHS");
  const reservedPrefixes = extractArrayConst(pathsSource, "RESERVED_PREFIXES");
  const contentRoutes = extractContentRoutes(pathsSource);

  if (!reservedPaths || !reservedPrefixes || !contentRoutes) {
    console.error(
      "check:reserved-paths FAILED — could not parse packages/contracts/src/cms/paths.ts.\n" +
        "  The source layout changed; update scripts/check-reserved-paths.mjs.",
    );
    process.exit(1);
  }

  const routeSegments = readdirSync(LOCALE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("["))
    .map((e) => e.name);

  const rootFiles = ROOT_FILE_MAP.filter(([rel]) =>
    existsSync(join(ROOT, "apps", "web", "app", rel)),
  ).map(([, reserved]) => reserved);

  const problems = checkReservedPaths({
    routeSegments,
    rootFiles,
    reservedPaths,
    reservedPrefixes,
    contentRoutes,
  });

  if (problems.length > 0) {
    console.error("check:reserved-paths FAILED —");
    for (const problem of problems) console.error(`  • ${problem}`);
    process.exit(1);
  }

  console.log(
    `check:reserved-paths — OK. ${reservedPaths.length} reserved paths, ` +
      `${reservedPrefixes.length} reserved prefixes, ${Object.keys(contentRoutes).length} content routes.`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
