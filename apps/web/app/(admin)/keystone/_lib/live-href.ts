// Where an editor's "View live" button goes.
//
// Every language of an item shares the default locale's slug (ADR-181 #1), so
// a locale's page is the default locale's path under that locale's prefix —
// the same address the header's language switcher lands on. The old per-item
// reading view is gone (ADR-181 #7). Only an ACTIVE locale is served
// (ADR-091): until a language is switched on, its page answers 404, which is
// the truth about what a reader can open.
interface Translated {
  locale: string;
  slug: string;
}

/** The stored slug for `locale`, or "" when that locale has no saved row. */
export function storedSlug(translations: readonly Translated[], locale: string): string {
  return translations.find((tr) => tr.locale === locale)?.slug ?? "";
}

/**
 * `path` is the DEFAULT locale's path, unprefixed (`as-needed` routing gives
 * the default locale no prefix). Returns it unchanged for the default locale,
 * and under the locale's prefix for any other.
 */
export function liveHref(path: string, locale: string, defaultLocale: string): string {
  return locale === defaultLocale ? path : `/${encodeURIComponent(locale)}${path}`;
}
