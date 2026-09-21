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
//
// **It compares the VARIABLES too** (added with ADR-113, the first template
// with five of them). `emailTemplateSaveSchema` refuses an undeclared variable
// when an ADMIN saves a body — but the seeded defaults never pass through that
// schema, so a typo in the defaults file reaches a real inbox as literal
// `{{braces}}`, and "Reset to default" puts it back afterwards. It is the same
// comparison one level down: every variable a default body uses must be
// declared by its registry entry, and every variable the entry marks
// `required` must actually appear.
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
  const block = source.match(
    /EMAIL_TEMPLATE_DEFAULTS: readonly [\w[\]]+ = \[([\s\S]*?)\n\] as const;/,
  );
  if (!block) return [];
  return [...block[1].matchAll(/key:\s*"([\w.]+)"/g)].map((match) => match[1]);
}

export function compare(registry, seed) {
  const missingFromSeed = registry.filter((key) => !seed.includes(key));
  const missingFromRegistry = seed.filter((key) => !registry.includes(key));
  return { missingFromSeed, missingFromRegistry };
}

/**
 * The source with its comments removed, for the variable comparison only.
 *
 * Both halves of that comparison are chunked by splitting on each entry's
 * `key:` line, so a comment ABOVE an entry lands in the previous entry's
 * chunk — and these files explain their variables in prose, which made the
 * support template's `{{contact.message}}` read as a defect in the newsletter
 * template above it. Stripping first is also simply correct: a variable named
 * in a comment is not a variable the template uses.
 *
 * Line comments are matched only at the START of a line (after indentation).
 * A blanket `//` rule would eat the rest of any line holding an `https://`
 * URL, and the registry's fixture values are full of them.
 */
export function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * Variables available to every template whatever its key, so a body may use
 * them without its own entry listing them.
 *
 * Read out of the registry source rather than retyped here, because a second
 * copy that drifts is precisely the failure this whole file exists to catch.
 */
export function globalVariables(registrySource) {
  const block = registrySource.match(
    /export const GLOBAL_EMAIL_VARIABLES = \[([\s\S]*?)\n\] as const;/,
  );
  if (!block) return [];
  return [...block[1].matchAll(/"([\w.]+)"/g)].map((match) => match[1]);
}

/** `{ [key]: { variables, required } }` from the registry's object literal. */
export function registryVariables(source) {
  const block = source.match(/export const EMAIL_TEMPLATES = \{([\s\S]*?)\n\} as const/);
  if (!block) return {};

  // Split on the two-space-indented `"key": {` lines that open each entry, so
  // each chunk holds exactly one template's fields. `sample` is inside the
  // chunk too, which is harmless: the two lists are matched by name.
  const entries = {};
  const parts = block[1].split(/^\s{2}"([\w.]+)":\s*\{/m);
  for (let index = 1; index < parts.length; index += 2) {
    const body = parts[index + 1] ?? "";
    entries[parts[index]] = {
      variables: namedList(body, "variables"),
      required: namedList(body, "required"),
    };
  }
  return entries;
}

/** The string entries of a `name: [ ... ]` array inside one template's chunk. */
function namedList(body, name) {
  const found = body.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]`));
  if (!found) return [];
  return [...found[1].matchAll(/"([\w.]+)"/g)].map((match) => match[1]);
}

/** `{ [key]: usedVariables }` across each default's subject, preheader and body. */
export function seedVariables(source) {
  const block = source.match(
    /EMAIL_TEMPLATE_DEFAULTS: readonly [\w[\]]+ = \[([\s\S]*?)\n\] as const;/,
  );
  if (!block) return {};

  const entries = {};
  const parts = block[1].split(/key:\s*"([\w.]+)"/);
  for (let index = 1; index < parts.length; index += 2) {
    const chunk = parts[index + 1] ?? "";
    // The same pattern `findTemplateVariables` uses, kept in step by the
    // fixture tests in packages/contracts rather than by memory.
    const used = new Set(
      [...chunk.matchAll(/\{\{\s*([A-Za-z][\w.]*)\s*\}\}/g)].map((match) => match[1]),
    );
    entries[parts[index]] = [...used];
  }
  return entries;
}

/**
 * Per key: variables a default body uses that its entry does not allow, and
 * variables the entry requires that the body never mentions.
 *
 * A key present in the registry but absent from the seed is skipped — the
 * key-list comparison above already reports that, and reporting it twice
 * would bury the variable problems under it.
 */
export function compareVariables(registry, seed, globals) {
  const problems = [];
  for (const [key, entry] of Object.entries(registry)) {
    const used = seed[key];
    if (!used) continue;

    const allowed = new Set([...globals, ...entry.variables]);
    const undeclared = used.filter((name) => !allowed.has(name));
    if (undeclared.length > 0) problems.push({ key, undeclared });

    const missing = entry.required.filter((name) => !used.includes(name));
    if (missing.length > 0) problems.push({ key, missing });
  }
  return problems;
}

export function run() {
  const registrySource = readFileSync(REGISTRY, "utf8");
  const seedSource = readFileSync(SEED, "utf8");
  const registry = registryKeys(registrySource);
  const seed = seedKeys(seedSource);

  if (registry.length === 0) {
    console.error(`check:email-templates FAIL — found no templates in ${REGISTRY}.`);
    return 1;
  }

  const { missingFromSeed, missingFromRegistry } = compare(registry, seed);

  if (missingFromSeed.length === 0 && missingFromRegistry.length === 0) {
    const problems = compareVariables(
      registryVariables(withoutComments(registrySource)),
      seedVariables(withoutComments(seedSource)),
      globalVariables(registrySource),
    );
    if (problems.length === 0) {
      console.log(`check:email-templates — OK (${registry.length} templates).`);
      return 0;
    }

    for (const problem of problems) {
      if (problem.undeclared) {
        console.error(
          `check:email-templates FAIL — ${problem.key} uses undeclared ` +
            `${problem.undeclared.join(", ")}. It would reach the inbox as literal braces; ` +
            `add it to that template's variables in ${REGISTRY}.`,
        );
      } else {
        console.error(
          `check:email-templates FAIL — ${problem.key} never uses required ` +
            `${problem.missing.join(", ")}. Put it in the subject or body in ${SEED}.`,
        );
      }
    }
    return 1;
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
