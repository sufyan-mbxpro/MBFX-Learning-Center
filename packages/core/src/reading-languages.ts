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
 * The translation statuses a reader may CHOOSE to read (ADR-127 #2).
 *
 * A human wrote both: `OUTDATED` only means the source moved on since. This is
 * the first public read that filters on the status, so ADR-097's recorded
 * consequence binds it — `MACHINE_TRANSLATED` is out until an editor's Save
 * promotes it, and `DRAFT` (a duplicated article's copies) is out entirely.
 */
export const READABLE_TRANSLATION_STATUSES: readonly TranslationStatus[] = [
  TranslationStatus.TRANSLATED,
  TranslationStatus.OUTDATED,
];

/**
 * The translations a page may ADVERTISE as its other-language versions — the
 * hreflang alternates.
 *
 * The same human-saved rule as the reading menu, with one exception: the
 * DEFAULT locale's row is always kept. It is the source, and a course's source
 * row is often still `DRAFT` until someone marks it, which says nothing about
 * whether the page is published. A `MACHINE_TRANSLATED` or `DRAFT` row in any
 * other locale is left out, because a search engine sent there would find
 * words no human has approved (ADR-097) — or, while the locale is inactive, a
 * 404. Whether the locale is SERVED is the page's half of the rule
 * (`getServableLocales`), applied where the URLs are built.
 */
export function advertisedAlternates(
  translations: readonly { locale: string; slug: string; translationStatus: TranslationStatus }[],
  defaultLocale: string,
): { locale: string; slug: string }[] {
  return translations
    .filter(
      (t) =>
        t.locale === defaultLocale || READABLE_TRANSLATION_STATUSES.includes(t.translationStatus),
    )
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
 * The chosen translation REPLACES the pick only when a human saved it
 * (#2); anything else leaves the page exactly as it was. The caller keeps its
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
