#!/usr/bin/env node
// SKILL — Module 03 (@repo/rbac): every permission string passed to
// requirePermission|requireAnyPermission|<Can permission= must exist in the
// seed permission registry (packages/db/prisma/seed.ts). Catches a typo'd
// key — the classic silent-403 bug, since a permission that doesn't exist in
// the registry can never be granted to anyone, so the check just always
// fails with no error telling you why.
//
// Only string-literal usages are checked; a computed/dynamic permission
// argument can't be statically verified and is skipped.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRE_PERMISSION_RE = /requirePermission\(\s*["']([^"']+)["']/g;
const REQUIRE_ANY_PERMISSION_RE = /requireAnyPermission\(\s*\[([^\]]*)\]/g;
const CAN_COMPONENT_RE = /<Can\b[^>]*\spermission=["']([^"']+)["']/g;
const STRING_LITERAL_RE = /["']([^"']+)["']/g;

/** Returns [{file, key}] for every string-literal permission key referenced in `files`. */
export function findPermissionUsages(files) {
  const usages = [];
  for (const { path, source } of files) {
    for (const match of source.matchAll(REQUIRE_PERMISSION_RE)) {
      usages.push({ file: path, key: match[1] });
    }
    for (const match of source.matchAll(REQUIRE_ANY_PERMISSION_RE)) {
      for (const inner of match[1].matchAll(STRING_LITERAL_RE)) {
        usages.push({ file: path, key: inner[1] });
      }
    }
    for (const match of source.matchAll(CAN_COMPONENT_RE)) {
      usages.push({ file: path, key: match[1] });
    }
  }
  return usages;
}

/** Extracts the flat `resource.action` keys from the seed's PERMISSIONS tuple array. */
export function extractSeedRegistry(seedSource) {
  const registry = new Set();
  const tupleRe = /\[\s*"[^"]+"\s*,\s*"([a-zA-Z][\w.]*)"\s*,/g;
  for (const match of seedSource.matchAll(tupleRe)) registry.add(match[1]);
  return registry;
}

/** Returns [{file, key}] for usages whose key is not in `registry`. */
export function findUnregisteredPermissions(files, registry) {
  return findPermissionUsages(files).filter((u) => !registry.has(u.key));
}

function* walk(dir, exts) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", "dist", ".turbo", "generated", "coverage"].includes(entry))
      continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full, exts);
    else if (exts.some((e) => full.endsWith(e))) yield full;
  }
}

export function run(root = process.cwd()) {
  const seedPath = join(root, "packages", "db", "prisma", "seed.ts");
  if (!existsSync(seedPath)) {
    console.log("check:permission-keys — SKIPPED (packages/db/prisma/seed.ts not found).");
    return 0;
  }
  const registry = extractSeedRegistry(readFileSync(seedPath, "utf8"));

  const files = [];
  for (const group of ["packages", "apps"]) {
    const groupDir = join(root, group);
    if (!existsSync(groupDir)) continue;
    for (const file of walk(groupDir, [".ts", ".tsx"])) {
      // Test fixtures legitimately exercise requirePermission() with
      // deliberately-fake keys to test the ForbiddenError path — not the
      // real-usage typo this check exists to catch.
      if (/\.test\.tsx?$/.test(file)) continue;
      files.push({
        path: relative(root, file).replace(/\\/g, "/"),
        source: readFileSync(file, "utf8"),
      });
    }
  }

  const bad = findUnregisteredPermissions(files, registry);
  for (const b of bad) {
    console.error(`unregistered permission key: ${b.file} uses "${b.key}", not in the seed registry`);
  }
  console.log(bad.length ? "check:permission-keys — FAIL" : "check:permission-keys — OK.");
  return bad.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run());
}
