#!/usr/bin/env node
// Workspace fixture check (plan.md Module 00 tests): every bare import in
// packages/* and apps/* must be declared in that package's package.json
// (dependencies, devDependencies, or peerDependencies). pnpm's isolated
// node_modules makes phantom deps *usually* fail at runtime, but a hoisted
// peer or a transitive type import can slip through — this makes it loud.
//
// Pure function `findPhantomImports` exported for the vitest suite.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { builtinModules } from "node:module";
import { pathToFileURL } from "node:url";

const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

// Bare specifiers that resolve without being dependencies of the importer.
const IMPLICIT_OK = new Set([
  "eslint/config", // helper module of the eslint peer
]);

const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

function packageNameOf(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** Returns [{file, specifier}] for imports not declared in pkgJson. */
export function findPhantomImports(pkgJson, files) {
  const declared = new Set([
    pkgJson.name,
    ...Object.keys(pkgJson.dependencies ?? {}),
    ...Object.keys(pkgJson.devDependencies ?? {}),
    ...Object.keys(pkgJson.peerDependencies ?? {}),
  ]);
  const phantoms = [];
  for (const { path, source } of files) {
    for (const match of source.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2];
      if (!spec || spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/")) continue;
      if (BUILTINS.has(spec) || IMPLICIT_OK.has(spec)) continue;
      const name = packageNameOf(spec);
      if (BUILTINS.has(name) || declared.has(name)) continue;
      phantoms.push({ file: path, specifier: name });
    }
  }
  return phantoms;
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
  const groups = ["packages", "apps", "tooling"];
  let failed = false;
  for (const group of groups) {
    const groupDir = join(root, group);
    if (!existsSync(groupDir)) continue;
    for (const pkgDir of readdirSync(groupDir)) {
      const pkgJsonPath = join(groupDir, pkgDir, "package.json");
      if (!existsSync(pkgJsonPath)) continue;
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
      const files = [];
      for (const file of walk(join(groupDir, pkgDir), [".ts", ".tsx", ".mjs", ".js", ".mts"])) {
        files.push({
          path: relative(root, file).replace(/\\/g, "/"),
          source: readFileSync(file, "utf8"),
        });
      }
      const phantoms = findPhantomImports(pkgJson, files);
      for (const p of phantoms) {
        failed = true;
        console.error(
          `phantom dependency: ${p.file} imports "${p.specifier}" ` +
            `but ${pkgJson.name} does not declare it`,
        );
      }
    }
  }
  console.log(failed ? "check:phantom-deps — FAIL" : "check:phantom-deps — OK.");
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run());
}
