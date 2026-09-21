// The page half of ADR-127, shared by every detail page with a reading-language
// menu: parse `?lang=`, and work out where each option in the menu goes.
// Loaders own WHICH languages are readable (`@repo/core` reading-languages.ts);
// this file only owns addresses, which is routing and so belongs to the app.
import { readingLanguageSearchSchema } from "@repo/contracts";
import type { ReadingLanguage } from "@repo/core";
import type { ReadingLanguageOption } from "../_components/reading-language-menu.tsx";

/**
 * `?lang=` parsed, never cast (security.md #6). An unusable value is simply no
 * reading language (ADR-127 #5), so a mistyped link still opens the page.
 */
export function readingLocaleFrom(
  search: Record<string, string | string[] | undefined>,
): string | undefined {
  const parsed = readingLanguageSearchSchema.safeParse({ lang: search.lang });
  return parsed.success ? parsed.data.lang : undefined;
}

/**
 * Where each language in the menu goes (ADR-127 #3): the interface locale's
 * own translation is the page without `?lang=`, a SERVED locale is its own
 * localized page, and anything else is a reading view of THIS URL.
 *
 * `pathFor` builds the item's locale-less path for one language, or returns
 * null when that language has no address of its own (a lesson whose course is
 * untranslated there) — which falls back to a reading view rather than a link
 * that 404s.
 */
export function readingLanguageOptions({
  languages,
  contentLocale,
  interfaceLocale,
  servable,
  currentPath,
  pathFor,
}: {
  languages: ReadingLanguage[];
  contentLocale: string;
  interfaceLocale: string;
  servable: readonly string[];
  /** The page's own locale-less path, without a query. */
  currentPath: string;
  pathFor: (language: ReadingLanguage) => string | null;
}): ReadingLanguageOption[] {
  return languages.map((language) => {
    const base = {
      code: language.locale,
      nativeName: language.nativeName,
      direction: language.direction,
      current: language.locale === contentLocale,
    };
    const ownPath = pathFor(language);
    if (language.locale === interfaceLocale) return { ...base, href: ownPath ?? currentPath };
    if (ownPath && servable.includes(language.locale)) {
      return { ...base, href: ownPath, locale: language.locale };
    }
    return { ...base, href: `${currentPath}?lang=${language.locale}` };
  });
}
