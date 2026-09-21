// Where an editor's "View live" button goes (ADR-127).
//
// Only an ACTIVE locale is served (ADR-091), and only `en` is active, so
// `/es/news/<spanish-slug>` is a 404 however complete the translation is. The
// address a reader can actually open is the DEFAULT locale's page with
// `?lang=<code>`, which swaps the item's words and keeps the chrome. That view
// is right after activation too: the reading menu there links on to the
// locale's own URL.
//
// A `?lang=` the page cannot honour (a machine or draft translation, ADR-127
// #2) is ignored rather than refused, so the link degrades to the English page
// instead of a 404.
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
 * and as a reading view for any other.
 */
export function liveHref(path: string, locale: string, defaultLocale: string): string {
  return locale === defaultLocale ? path : `${path}?lang=${encodeURIComponent(locale)}`;
}
