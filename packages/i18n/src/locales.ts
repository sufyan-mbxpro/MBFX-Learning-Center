// DB-driven active-locale list (SKILL.md: "Active locale list is DB-seeded:
// enabling a locale is instant but dynamic until the next build"). This is
// the dynamic half of the trade-off routing.ts documents — the locale
// switcher and content-fallback resolution both read this, not
// routing.locales, so an admin flipping `Locale.isActive` takes effect
// immediately for everything except next-intl's own route matching.
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { db, type TextDirection } from "@repo/db";

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

/** Call after an admin activates/deactivates a locale. */
export async function invalidateActiveLocales(): Promise<void> {
  revalidateTag(LOCALES_TAG, { expire: 0 });
}
