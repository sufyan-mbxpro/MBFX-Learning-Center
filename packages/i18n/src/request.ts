// next-intl server request config — loads the message catalog for the
// resolved locale. `hasLocale` guards against a locale slipping through
// that isn't in routing.ts's static list; the proxy already 404s an
// unknown prefix before this ever runs, so this is a defense-in-depth
// fallback to the default locale, not the primary guard.
import { hasLocale, type IntlErrorCode } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { catalogValueAt, getCatalog } from "./catalog.ts";
import { routing } from "./routing.ts";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  // The file with the admin's overrides over it (ADR-178 #3). A language
  // added in the admin ships no file, so its text is all overrides, and a
  // key it lacks reads from English below.
  const [messages, defaultMessages] = await Promise.all([
    getCatalog(locale),
    getCatalog(routing.defaultLocale),
  ]);

  return {
    locale,
    messages,
    // Catalog completeness is enforced as a CI check (SKILL.md: non-default
    // missing key = warning, not a build failure), so a translator being
    // mid-catalog must not crash the page for a real visitor. A missing
    // key silently reads from the English catalog instead of throwing —
    // logged, not surfaced, since MISSING_MESSAGE is the expected, already-
    // tracked-elsewhere case here.
    onError(error) {
      if ((error.code as IntlErrorCode) !== "MISSING_MESSAGE") console.error(error);
    },
    getMessageFallback({ key, namespace }) {
      const path = namespace ? `${namespace}.${key}` : key;
      const value = catalogValueAt(defaultMessages, path);
      return typeof value === "string" ? value : path;
    },
  };
});
