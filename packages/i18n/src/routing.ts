// @repo/i18n — next-intl routing config (Module 06, MONOREPO_CONFIG.md §6).
//
// `locales` is the STATIC superset next-intl's proxy middleware and
// generateStaticParams need at build/request time — next-intl has no
// mechanism to read a dynamic list per request. The DB-driven `Locale`
// table (packages/db/prisma/schema.prisma) is the actual runtime source of
// truth for which locales are ACTIVE (`isActive`) — see locales.ts. Named
// trade-off (SKILL.md): an admin flipping a locale active is instant for
// everything that reads `getActiveLocales()` (the switcher, content
// resolution), but a brand-new locale code showing up here for the first
// time needs this array updated and a rebuild — next-intl can't route a
// prefix it doesn't know about. The four codes below are exactly
// packages/db/prisma/seed.ts's seeded rows, kept in sync by hand.
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es", "ar", "ur"],
  defaultLocale: "en",
  // Default locale has no prefix: "/" not "/en" — keeps the highest-traffic
  // path stable and avoids a redirect hop.
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

/**
 * Static per-locale metadata needed before any DB call is possible — most
 * importantly `direction`, which the public root layout needs synchronously
 * for `<html dir>` (architecture doc §4.3). This is the STATIC half of the
 * same static/dynamic split `locales.ts` documents for the locale list
 * itself: `Locale.direction` in the DB is the editable source of truth for
 * admin-facing screens, but the app shell can't wait on a DB round trip
 * just to pick a text direction, so the four seeded locales' directions are
 * duplicated here too. Keep in sync with packages/db/prisma/seed.ts by
 * hand — same trade-off @repo/theme's default tokens already accepted.
 */
export const LOCALE_DIRECTION: Record<AppLocale, "ltr" | "rtl"> = {
  en: "ltr",
  es: "ltr",
  ar: "rtl",
  ur: "rtl",
};
