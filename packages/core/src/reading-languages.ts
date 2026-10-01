// Reading languages (ADR-127): which translations of a public item a reader
// may choose to read, independent of the interface locale. Pure, so every
// content module that grows a reading-language menu shares one rule.
import { TranslationStatus, type TextDirection } from "@repo/db";

export interface LocaleMeta {
  code: string;
  nativeName: string;
  direction: TextDirection;
  sortOrder: number;
}

/**
 * The translation statuses a reader may CHOOSE to read (ADR-127 #2, amended by
 * ADR-159 #1).
 *
 * A person wrote `TRANSLATED` and `OUTDATED` (the source only moved on since).
 * `MACHINE_TRANSLATED` joined them under ADR-159: machine translations go live
 * at once, on every read path, so the `?lang=` menu offers what the locale URL
 * already serves. `DRAFT` (a duplicated article's copies) and `NEEDS_REVIEW`
 * (a figure changed in translation, ADR-160 #8) stay out: both are waiting for
 * a person.
 */
export const READABLE_TRANSLATION_STATUSES: readonly TranslationStatus[] = [
  TranslationStatus.TRANSLATED,
  TranslationStatus.OUTDATED,
  TranslationStatus.MACHINE_TRANSLATED,
];

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

export interface ReadingLanguage {
  locale: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  slug: string;
}

/**
 * The languages an article can be read in, in the locales' display order.
 *
 * Every locale in `shownLocales` is listed whatever its status: the one on
 * screen, so the menu can mark it current, AND the page's ordinary translation
 * on a reading view, so the reader has a way back. A source-locale row is often
 * still `DRAFT` (a course's is, until someone marks it), and leaving it out
 * dropped a Spanish reading view to one option — no menu, and no way home.
 * A translation for a locale with no `Locale` row is dropped: there is no name
 * to show it under.
 */
export function resolveReadingLanguages(
  translations: { locale: string; slug: string; translationStatus: TranslationStatus }[],
  known: LocaleMeta[],
  shownLocales: readonly (string | null | undefined)[],
): ReadingLanguage[] {
  return known
    .filter((meta) =>
      translations.some(
        (t) =>
          t.locale === meta.code &&
          (shownLocales.includes(t.locale) ||
            READABLE_TRANSLATION_STATUSES.includes(t.translationStatus)),
      ),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((meta) => ({
      locale: meta.code,
      nativeName: meta.nativeName,
      direction: meta.direction === "RTL" ? "rtl" : "ltr",
      slug: translations.find((t) => t.locale === meta.code)?.slug ?? "",
    }));
}

/**
 * What a detail loader adds to its view once it honours `?lang=` (ADR-127).
 * One shape, so every page wires the menu and the `lang`/`dir` the same way.
 */
export interface ReadingView {
  /** The languages the item's own words can be read in, the one on screen included. */
  readingLanguages: ReadingLanguage[];
  /**
   * The reading locale actually applied, or null when the page shows its
   * ordinary translation — an unknown, unreadable or same-as-shown `lang` is
   * ignored, never a 404 (ADR-127 #5).
   */
  readingLocale: string | null;
  /** Locale of the words on screen, for the content wrapper's `lang`. */
  contentLocale: string;
  /** Direction of the words on screen, for the content wrapper's `dir`. */
  contentDirection: "ltr" | "rtl";
}

/**
 * Apply a reader's `?lang=` choice to a loader's ordinary fallback pick.
 *
 * The chosen translation REPLACES the pick only when it is readable (#2 as
 * amended by ADR-159: a person's row or a machine one); anything else leaves
 * the page exactly as it was. The caller keeps its
 * own pick for everything that is ADDRESS rather than words — slugs, canonical,
 * breadcrumbs — so a reading view never changes the URL it lives at.
 */
export function applyReadingLocale<
  T extends { locale: string; slug: string; translationStatus: TranslationStatus },
>(
  translations: T[],
  fallbackPick: T | null,
  readingLocale: string | undefined,
  known: LocaleMeta[],
  interfaceLocale: string,
): { picked: T | null } & ReadingView {
  const readingPick =
    readingLocale && readingLocale !== fallbackPick?.locale
      ? translations.find(
          (t) =>
            t.locale === readingLocale &&
            READABLE_TRANSLATION_STATUSES.includes(t.translationStatus),
        )
      : undefined;
  const picked = readingPick ?? fallbackPick;
  const readingLanguages = resolveReadingLanguages(translations, known, [
    picked?.locale,
    fallbackPick?.locale,
  ]);
  return {
    picked,
    readingLanguages,
    readingLocale: readingPick ? readingPick.locale : null,
    contentLocale: picked?.locale ?? interfaceLocale,
    contentDirection: readingLanguages.find((l) => l.locale === picked?.locale)?.direction ?? "ltr",
  };
}
