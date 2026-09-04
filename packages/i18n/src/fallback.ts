// Content translation-resolution fallback chain (frozen, SKILL.md):
// requested locale → per-locale fallbackCode → default locale.
//
// The Arabic rule generalizes to every RTL locale (ADR-007): ar/ur are
// seeded with `fallbackCode: null`, so the chain stops at the requested
// locale — an untranslated RTL page renders a "not yet translated" notice
// in its own direction, never LTR English content inside an RTL layout.
// This is per-locale config (packages/db/prisma/seed.ts), not a branch on
// locale code in this function.
export interface LocaleFallbackInfo {
  code: string;
  fallbackCode: string | null;
}

/**
 * Ordered list of locale codes to try, most-preferred first. At most three
 * entries: requested, its fallbackCode (if configured and distinct from
 * the default), and the default locale (unless the requested locale has no
 * fallbackCode configured at all, in which case the chain stops at one).
 */
export function resolveFallbackChain(
  requestedLocale: string,
  defaultLocale: string,
  locales: LocaleFallbackInfo[],
): string[] {
  const info = locales.find((l) => l.code === requestedLocale);
  const chain = [requestedLocale];

  if (info === undefined) {
    // Not a configured locale at all — fall through to default rather
    // than dead-end on a code the system doesn't recognize.
    if (requestedLocale !== defaultLocale) chain.push(defaultLocale);
    return chain;
  }

  if (info.fallbackCode) {
    chain.push(info.fallbackCode);
    if (info.fallbackCode !== defaultLocale) chain.push(defaultLocale);
  }
  // info.fallbackCode is null/undefined: chain stays [requestedLocale] —
  // the Arabic rule.

  return chain;
}

export interface HasLocale {
  locale: string;
}

/** Walks resolveFallbackChain and returns the first matching translation row, or null if none exist anywhere in the chain. */
export function pickTranslation<T extends HasLocale>(
  translations: T[],
  requestedLocale: string,
  defaultLocale: string,
  locales: LocaleFallbackInfo[],
): T | null {
  for (const code of resolveFallbackChain(requestedLocale, defaultLocale, locales)) {
    const match = translations.find((t) => t.locale === code);
    if (match) return match;
  }
  return null;
}
