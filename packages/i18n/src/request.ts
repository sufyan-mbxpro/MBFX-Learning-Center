// next-intl server request config — loads the message catalog for the
// resolved locale. `hasLocale` guards against a locale slipping through
// that isn't in routing.ts's static list; the proxy already 404s an
// unknown prefix before this ever runs, so this is a defense-in-depth
// fallback to the default locale, not the primary guard.
import { hasLocale, type IntlErrorCode } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing.ts";
import defaultMessages from "../messages/en.json" with { type: "json" };

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;

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
      return (
        (path
          .split(".")
          .reduce<unknown>(
            (acc, segment) =>
              acc && typeof acc === "object"
                ? (acc as Record<string, unknown>)[segment]
                : undefined,
            defaultMessages,
          ) as string | undefined) ?? path
      );
    },
  };
});
