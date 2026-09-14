#!/usr/bin/env node
// Module 17 / ADR-078 #5 — the template SET is code, its CONTENT is data, and
// the two live in packages that cannot import each other: @repo/db sits
// upstream of @repo/contracts, so the default content can never read the
// registry. (The content moved out of `seed.ts` in F5 — "Reset to default"
// needs the same bodies the seed writes.)
//
// Same shape as check-permission-keys.mjs: scan both sides as source, compare
// the key lists, and fail loudly on a drift. A seeded key with no registry
// entry can never be sent; a registry key with no seed row renders nothing the
// first time someone opens the editor.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REGISTRY = "packages/contracts/src/email.ts";
const SEED = "packages/db/src/email-template-defaults.ts";

/** Keys of the `EMAIL_TEMPLATES = { ... }` object literal in the registry. */
export function registryKeys(source) {
  const block = source.match(/export const EMAIL_TEMPLATES = \{([\s\S]*?)\n\} as const/);
  if (!block) return [];
  return [...block[1].matchAll(/^\s{2}"([\w.]+)":\s*\{/gm)].map((match) => match[1]);
}

/** Keys of the `EMAIL_TEMPLATE_DEFAULTS = [ ... ]` array the seed writes from. */
export function seedKeys(source) {
  const block = source.match(/EMAIL_TEMPLATE_DEFAULTS: readonly [\w[\]]+ = \[([\s\S]*?)\n\] as const;/);
  if (!block) return [];
  return [...block[1].matchAll(/key:\s*"([\w.]+)"/g)].map((match) => match[1]);
}

export function compare(registry, seed) {
  const missingFromSeed = registry.filter((key) => !seed.includes(key));
  const missingFromRegistry = seed.filter((key) => !registry.includes(key));
  return { missingFromSeed, missingFromRegistry };
}

export function run() {
  const registry = registryKeys(readFileSync(REGISTRY, "utf8"));
  const seed = seedKeys(readFileSync(SEED, "utf8"));

  if (registry.length === 0) {
    console.error(`check:email-templates FAIL — found no templates in ${REGISTRY}.`);
    return 1;
  }

  const { missingFromSeed, missingFromRegistry } = compare(registry, seed);
  if (missingFromSeed.length === 0 && missingFromRegistry.length === 0) {
    console.log(`check:email-templates — OK (${registry.length} templates).`);
    return 0;
  }

  if (missingFromSeed.length > 0) {
    console.error(
      `check:email-templates FAIL — declared but never seeded: ${missingFromSeed.join(", ")}. ` +
        `Add starting content to ${SEED}.`,
    );
  }
  if (missingFromRegistry.length > 0) {
    console.error(
      `check:email-templates FAIL — seeded but not declared: ${missingFromRegistry.join(", ")}. ` +
        `Add an EMAIL_TEMPLATES entry in ${REGISTRY}, or the row can never be sent.`,
    );
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run());
}
