#!/usr/bin/env node
// changes-03-plan.md §12.6 (Phase 9a) — keeps the THREE lists that are all
// keyed by homepage-section strings from drifting apart:
//
//   1. packages/db/prisma/seed.ts        — the seeded `home.sections` default
//   2. @repo/contracts                   — HOME_SECTION_VARIANTS (the variant
//                                          vocabulary) + HOME_SECTION_BUILT_KEYS
//                                          / HOME_SECTION_STUB_KEYS
//   3. app/(public)/[locale]/_sections/registry.ts — SECTION_COMPONENTS
//
// Nothing in the type system connects them: the contracts registry cannot
// import app code (architecture.md #8), and the admin surface cannot import
// the PUBLIC registry (architecture.md #5). That is a deliberate boundary,
// so this script is what makes the duplication safe.
//
// The failure it exists to prevent: the admin's homepage screen offering a
// variant dropdown for a section that has no component and silently renders
// a placeholder.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

/** Section keys inside the seeded `home.sections` default value. */
export function parseSeededKeys(source) {
  const start = source.indexOf('"home.sections"');
  if (start === -1) return null;
  const end = source.indexOf('"Homepage sections"', start);
  if (end === -1) return null;
  return [...source.slice(start, end).matchAll(/key:\s*"([\w-]+)"/g)].map((m) => m[1]);
}

/**
 * Top-level keys of an `export const NAME = { ... }` object literal.
 *
 * Tolerates a type annotation between the name and the literal —
 * SECTION_COMPONENTS is declared as `NAME: Partial<\n  Record<...>\n> = {`,
 * so anchoring on `NAME = {` alone silently found nothing.
 */
export function parseObjectKeys(source, name) {
  const declared = source.indexOf(name);
  if (declared === -1) return null;
  const rest = source.slice(declared);
  const open = rest.search(/=\s*\{/);
  if (open === -1) return null;
  const body = rest.slice(open);
  // Stop at the closing brace that ends the literal — the registries end
  // with `} as const` or `};`.
  const end = body.search(/\n\} as const|\n\};/);
  return [...body.slice(0, end === -1 ? undefined : end).matchAll(/^ {2}([\w-]+):/gm)].map(
    (m) => m[1],
  );
}

/** Entries of an `export const NAME = [ "a", "b" ]` string-array literal. */
export function parseArrayEntries(source, name) {
  const start = source.indexOf(`${name} = [`);
  if (start === -1) return null;
  const rest = source.slice(start);
  const end = rest.indexOf("]");
  return [...rest.slice(0, end).matchAll(/"([\w-]+)"/g)].map((m) => m[1]);
}

/** Returns an array of human-readable problems; empty means the lists agree. */
export function checkHomeSections({ seeded, variants, built, stubs, components }) {
  const problems = [];
  const sorted = (a) => [...a].sort();

  // 1. The declared "built" list must BE the public registry, exactly. This
  //    is the duplication the boundary forces, so it gets the strictest check.
  if (sorted(built).join(",") !== sorted(components).join(",")) {
    problems.push(
      `HOME_SECTION_BUILT_KEYS does not match SECTION_COMPONENTS.\n` +
        `    contracts: ${sorted(built).join(", ") || "(none)"}\n` +
        `    registry:  ${sorted(components).join(", ") || "(none)"}`,
    );
  }

  // 2. A variant vocabulary for a section nobody seeds is dead configuration.
  for (const key of variants) {
    if (!seeded.includes(key)) {
      problems.push(`HOME_SECTION_VARIANTS declares "${key}", which is not a seeded section.`);
    }
  }

  // 3. Every seeded section is either built or a KNOWN stub. A new seeded key
  //    that nobody built must be acknowledged, not silently placeholdered.
  for (const key of seeded) {
    if (!built.includes(key) && !stubs.includes(key)) {
      problems.push(
        `Seeded section "${key}" has no component and is not listed in ` +
          `HOME_SECTION_STUB_KEYS. Build it, or list it as a known stub.`,
      );
    }
  }

  // 4. A key can't be both, and a stub that no longer exists is stale.
  for (const key of stubs) {
    if (built.includes(key)) {
      problems.push(`"${key}" is listed as BOTH built and a stub.`);
    } else if (!seeded.includes(key)) {
      problems.push(`HOME_SECTION_STUB_KEYS lists "${key}", which is not a seeded section.`);
    }
  }

  return problems;
}

function main() {
  const seedSource = readFileSync(join(ROOT, "packages/db/prisma/seed.ts"), "utf8");
  const contractsSource = readFileSync(join(ROOT, "packages/contracts/src/settings.ts"), "utf8");
  const registrySource = readFileSync(
    join(ROOT, "apps/web/app/(public)/[locale]/_sections/registry.ts"),
    "utf8",
  );

  const seeded = parseSeededKeys(seedSource);
  const variants = parseObjectKeys(contractsSource, "HOME_SECTION_VARIANTS");
  const built = parseArrayEntries(contractsSource, "HOME_SECTION_BUILT_KEYS");
  const stubs = parseArrayEntries(contractsSource, "HOME_SECTION_STUB_KEYS");
  const components = parseObjectKeys(registrySource, "SECTION_COMPONENTS");

  // A parse returning null means the source moved — fail loudly rather than
  // pass on an empty list, which is how this class of check rots silently.
  const sources = { seeded, variants, built, stubs, components };
  const unreadable = Object.entries(sources).filter(([, value]) => value === null);
  if (unreadable.length > 0) {
    console.error(
      `check:home-sections FAILED — could not parse: ${unreadable.map(([k]) => k).join(", ")}.\n` +
        `  The source layout changed; update scripts/check-home-sections.mjs.`,
    );
    process.exit(1);
  }

  const problems = checkHomeSections(sources);
  if (problems.length > 0) {
    console.error("check:home-sections FAILED —");
    for (const problem of problems) console.error(`  • ${problem}`);
    process.exit(1);
  }

  console.log(
    `check:home-sections — OK. ${seeded.length} seeded, ${built.length} built, ` +
      `${stubs.length} known stubs, ${variants.length} with variants.`,
  );
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"))) {
  main();
}
