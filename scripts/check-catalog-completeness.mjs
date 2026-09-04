#!/usr/bin/env node
// SKILL — Module 06 (@repo/i18n): "catalog completeness (non-default
// catalogs missing keys = CI warning; default catalog missing a used key =
// CI error)". The default catalog (en.json) is also the TypeScript type
// source (packages/i18n/src/request.ts's messages type comes from it) —
// referencing a key that doesn't exist there is already a build-time type
// error in any file that calls `useTranslations`/`getTranslations`, so this
// script's job is the other direction: every OTHER catalog compared against
// en.json's key set.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Flattens a nested messages object into dotted keys: {a:{b:1}} -> ["a.b"]. */
export function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/** Returns { locale, missing: string[] } for every catalog that's short a key present in the default catalog. */
export function findMissingKeys(defaultMessages, catalogs) {
  const defaultKeys = new Set(flattenKeys(defaultMessages));
  const results = [];
  for (const [locale, messages] of Object.entries(catalogs)) {
    const localeKeys = new Set(flattenKeys(messages));
    const missing = [...defaultKeys].filter((k) => !localeKeys.has(k));
    if (missing.length > 0) results.push({ locale, missing });
  }
  return results;
}

export function run(root = process.cwd()) {
  const messagesDir = join(root, "packages", "i18n", "messages");
  const defaultLocale = "en";

  let entries;
  try {
    entries = readdirSync(messagesDir).filter((f) => f.endsWith(".json"));
  } catch {
    console.log("check:catalog-completeness — SKIPPED (packages/i18n/messages not found).");
    return 0;
  }

  const catalogs = {};
  for (const file of entries) {
    const locale = file.replace(/\.json$/, "");
    catalogs[locale] = JSON.parse(readFileSync(join(messagesDir, file), "utf8"));
  }

  const defaultMessages = catalogs[defaultLocale];
  if (!defaultMessages) {
    console.error(`check:catalog-completeness FAIL — no default catalog (${defaultLocale}.json) found.`);
    return 1;
  }

  const nonDefault = Object.fromEntries(
    Object.entries(catalogs).filter(([locale]) => locale !== defaultLocale),
  );
  const missing = findMissingKeys(defaultMessages, nonDefault);

  // Non-default missing keys are a WARNING (SKILL.md), not a failure — a
  // catalog mid-translation is an expected, ongoing state, not a bug.
  for (const { locale, missing: keys } of missing) {
    console.warn(`check:catalog-completeness WARN — ${locale}.json is missing: ${keys.join(", ")}`);
  }
  console.log("check:catalog-completeness — OK.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run());
}
