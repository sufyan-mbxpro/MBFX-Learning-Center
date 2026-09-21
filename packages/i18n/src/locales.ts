// DB-driven active-locale list (SKILL.md: "Active locale list is DB-seeded:
// enabling a locale is instant but dynamic until the next build"). This is
// the dynamic half of the trade-off routing.ts documents — the locale
// switcher and content-fallback resolution both read this, not
// routing.locales, so an admin flipping `Locale.isActive` takes effect
// immediately for everything except next-intl's own route matching.
import { hasLocale } from "next-intl";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { db, type TextDirection } from "@repo/db";
import { routing, type AppLocale } from "./routing.ts";

export interface ActiveLocale {
  code: string;
  name: string;
  nativeName: string;
  direction: TextDirection;
  flagEmoji: string | null;
  isDefault: boolean;
  fallbackCode: string | null;
  sortOrder: number;
}

/** Pure DB read, exported so tests can exercise it without ADR-004's `"use cache"` transform (inert outside a real Next.js build/dev process). */
export async function loadActiveLocales(): Promise<ActiveLocale[]> {
  const rows = await db.locale.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    nativeName: r.nativeName,
    direction: r.direction,
    flagEmoji: r.flagEmoji,
    isDefault: r.isDefault,
    fallbackCode: r.fallbackCode,
    sortOrder: r.sortOrder,
  }));
}

/** Not one of architecture.md #12's frozen four cache tags — minted here for the locale switcher's active list, same reasoning as @repo/settings' "feature-flags" tag. */
const LOCALES_TAG = "locales";

export async function getActiveLocales(): Promise<ActiveLocale[]> {
  "use cache";
  cacheTag(LOCALES_TAG);
  cacheLife({ revalidate: 300 });
  return loadActiveLocales();
}

/**
 * The locales an admin may WRITE content in — every seeded row next-intl can
 * route, active or not (ADR-043 #3, ADR-127).
 *
 * Not the active list. Only `en` is active, and an editor that offered only
 * active locales hid its language switcher entirely, so a translation could
 * be written for an article or a course but not for a video topic or a
 * glossary term. A translation in an inactive locale is not wasted: ADR-127's
 * `?lang=` reading view serves it today, and activation serves it at its own
 * URL later.
 */
export async function loadAuthoringLocales(): Promise<ActiveLocale[]> {
  const rows = await db.locale.findMany({ orderBy: { sortOrder: "asc" } });
  return rows
    .filter((r) => hasLocale(routing.locales, r.code))
    .map((r) => ({
      code: r.code,
      name: r.name,
      nativeName: r.nativeName,
      direction: r.direction,
      flagEmoji: r.flagEmoji,
      isDefault: r.isDefault,
      fallbackCode: r.fallbackCode,
      sortOrder: r.sortOrder,
    }));
}

export async function getAuthoringLocales(): Promise<ActiveLocale[]> {
  "use cache";
  cacheTag(LOCALES_TAG);
  cacheLife({ revalidate: 300 });
  return loadAuthoringLocales();
}

/** Call after an admin activates/deactivates a locale. */
export async function invalidateActiveLocales(): Promise<void> {
  revalidateTag(LOCALES_TAG, { expire: 0 });
}

/**
 * The locales the site actually SERVES — the active list narrowed to codes
 * next-intl can route (ADR-091).
 *
 * `routing.locales` is the static superset that lets next-intl recognise a
 * prefix at all; `Locale.isActive` is what decides whether we publish it.
 * Three callers used to read the superset as though it were this list:
 * `generateStaticParams` (so the build prerendered three untranslated
 * locales), the public root layout's guard, and the sitemap. They now share
 * one rule, because three copies of it is how they came to disagree.
 *
 * The intersection matters in both directions: a DB row for a code that is
 * not in `routing.locales` is unroutable whatever the column says, and a code
 * in `routing.locales` that nobody activated is not ours to publish.
 *
 * The empty fallback is deliberate. A database with no active locale is a
 * misconfiguration, but a build that prerenders NOTHING turns it into a site
 * with no pages; the default locale is the one answer that is always safe.
 */
export async function getServableLocales(): Promise<AppLocale[]> {
  const active = await getActiveLocales();
  const servable = active
    .map((locale) => locale.code)
    .filter((code): code is AppLocale => hasLocale(routing.locales, code));
  return servable.length > 0 ? servable : [routing.defaultLocale];
}

/** Is this locale one we publish? The request-time half of `getServableLocales`. */
export async function isServableLocale(locale: string): Promise<boolean> {
  const servable = await getServableLocales();
  return (servable as readonly string[]).includes(locale);
}
