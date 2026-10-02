// Which translations of a public item a search engine may be sent to
// (ADR-159 #2), plus the language facts a detail page puts on its content
// wrapper. Pure, so every content module shares one rule. Formerly
// `reading-languages.ts`, until ADR-181 #7 removed ADR-127's reading menu.
import { supportedLocale } from "@repo/i18n/routing";
import { TranslationStatus } from "@repo/db";

/**
 * The statuses a search engine may be sent to (ADR-159 #2): only what a person
 * saved. Machine-written prose is served but `noindex`, left out of the
 * sitemap and out of every page's hreflang until someone saves it.
 */
export const INDEXABLE_TRANSLATION_STATUSES: readonly TranslationStatus[] = [
  TranslationStatus.TRANSLATED,
  TranslationStatus.OUTDATED,
];

/**
 * Whether a translation may be indexed. The default locale's row always may:
 * it is the source, and its status says nothing about the page (a course's
 * source row is often still `DRAFT` until someone marks it).
 */
export function isIndexableTranslation(
  translation: { locale: string; translationStatus: TranslationStatus },
  defaultLocale: string,
): boolean {
  return (
    translation.locale === defaultLocale ||
    INDEXABLE_TRANSLATION_STATUSES.includes(translation.translationStatus)
  );
}

/**
 * The translations a page may ADVERTISE as its other-language versions — the
 * hreflang alternates.
 *
 * Indexable ones only (ADR-159 #2): a search engine sent to a
 * `MACHINE_TRANSLATED`, `NEEDS_REVIEW` or `DRAFT` row would find words no
 * person has approved, which is also why those pages carry `noindex`. This is
 * what closes ADR-127's recorded issue of alternates that 404: whether the
 * locale is SERVED is the page's half of the rule (`getServableLocales`),
 * applied where the URLs are built.
 */
export function advertisedAlternates(
  translations: readonly { locale: string; slug: string; translationStatus: TranslationStatus }[],
  defaultLocale: string,
): { locale: string; slug: string }[] {
  return translations
    .filter((t) => isIndexableTranslation(t, defaultLocale))
    .map((t) => ({ locale: t.locale, slug: t.slug }));
}

/**
 * The language of the words a detail page shows, for its content wrapper's
 * `lang`/`dir`. Usually the page's own locale; the default locale's when the
 * fallback chain had to supply the words.
 */
export interface ContentLanguageView {
  contentLocale: string;
  contentDirection: "ltr" | "rtl";
}

export function contentLanguage(locale: string): ContentLanguageView {
  return { contentLocale: locale, contentDirection: supportedLocale(locale)?.direction ?? "ltr" };
}
