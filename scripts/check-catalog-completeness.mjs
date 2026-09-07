#!/usr/bin/env node
// SKILL — Module 06 (@repo/i18n): "catalog completeness (non-default
// catalogs missing keys = CI warning; default catalog missing a used key =
// CI error)". The default catalog (en.json) is also the TypeScript type
// source (packages/i18n/src/request.ts's messages type comes from it) —
// referencing a key that doesn't exist there is already a build-time type
// error in any file that calls `useTranslations`/`getTranslations`, so this
// script's job is the other direction: every OTHER catalog compared against
// en.json's key set.
//
// ADR-043 refines that into two rules, because "missing key" no longer means
// one thing:
//
//   PUBLIC namespaces  — the public site is multilingual, fully. Missing keys
//                        are a WARNING for a locale that isn't live yet and a
//                        hard FAILURE for one in ENFORCED_LOCALES.
//   ADMIN namespaces   — the admin portal is English-only BY DESIGN. Missing
//                        keys are not reported at all: silence here is
//                        correct, not neglect. (`cms.*` is doubly moot — it
//                        belongs to the feature ADR-042 cancelled.)
//
// The split matters beyond bookkeeping: before it, ~700 intentional admin gaps
// buried six genuinely-missing PUBLIC keys well enough that nobody noticed
// them. A warning nobody reads enforces nothing.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Namespaces the ADMIN surface owns. English-only by design (ADR-043 #2) —
 * exempt from completeness in every non-default catalog. Everything NOT
 * listed here is treated as public, so a new namespace defaults to the
 * stricter rule rather than silently escaping it.
 */
export const ADMIN_NAMESPACES = new Set(["admin", "cms"]);

/**
 * Locales whose PUBLIC catalog must be complete or CI fails — i.e. the
 * locales that are (or are about to be) `Locale.isActive` in the database.
 * `en` is the source catalog and is never compared against itself.
 *
 * ADR-043 #4: flipping a locale to `isActive` means adding it here in the
 * SAME PR, so CI refuses the activation until that locale's public catalog is
 * complete. A half-translated public site should not be able to go live by
 * accident.
 *
 * Hand-synced with `packages/db/prisma/seed.ts`'s `Locale` rows — this script
 * is a pure file check with no database access, the same static/dynamic
 * trade-off `routing.ts` and `LOCALE_DIRECTION` already make and document.
 */
export const ENFORCED_LOCALES = new Set(["en"]);

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

/** True for a dotted key whose top-level namespace belongs to the admin surface. */
export function isAdminKey(key) {
  return ADMIN_NAMESPACES.has(key.split(".")[0]);
}

/**
 * Returns { locale, missing: string[] } for every catalog short a key present
 * in the default catalog. `publicOnly` applies ADR-043's namespace split.
 */
export function findMissingKeys(defaultMessages, catalogs, { publicOnly = false } = {}) {
  const defaultKeys = flattenKeys(defaultMessages).filter((k) => !publicOnly || !isAdminKey(k));
  const results = [];
  for (const [locale, messages] of Object.entries(catalogs)) {
    const localeKeys = new Set(flattenKeys(messages));
    const missing = defaultKeys.filter((k) => !localeKeys.has(k));
    if (missing.length > 0) results.push({ locale, missing });
  }
  return results;
}

/**
 * `enforced` is injectable so the FAILURE branch is testable. It cannot fire
 * in the real workspace today: `en` is the only enforced locale and, being the
 * source catalog, is never compared against itself. The gate is armed and
 * inert on purpose — it goes live the moment a second locale is activated and
 * added to ENFORCED_LOCALES. A gate first exercised on the day it must work is
 * a gate nobody has tested, hence the seam.
 */
export function run(root = process.cwd(), { enforced = ENFORCED_LOCALES } = {}) {
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
    console.error(
      `check:catalog-completeness FAIL — no default catalog (${defaultLocale}.json) found.`,
    );
    return 1;
  }

  const nonDefault = Object.fromEntries(
    Object.entries(catalogs).filter(([locale]) => locale !== defaultLocale),
  );
  const missing = findMissingKeys(defaultMessages, nonDefault, { publicOnly: true });

  let failed = false;
  for (const { locale, missing: keys } of missing) {
    // An ACTIVE locale with an incomplete public catalog is a broken promise
    // to real visitors (ADR-043 #1), not a translation in progress.
    if (enforced.has(locale)) {
      failed = true;
      console.error(
        `check:catalog-completeness FAIL — ${locale}.json is ACTIVE but its public catalog is missing: ${keys.join(", ")}`,
      );
    } else {
      console.warn(
        `check:catalog-completeness WARN — ${locale}.json (not yet active) is missing public keys: ${keys.join(", ")}`,
      );
    }
  }

  if (failed) return 1;
  console.log("check:catalog-completeness — OK.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run());
}
