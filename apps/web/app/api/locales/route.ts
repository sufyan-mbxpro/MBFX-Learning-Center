// "Which languages does the site serve right now?" — the proxy's question
// (ADR-178 #7).
//
// next-intl's browser-language detection redirects `/` to any code it can
// route, and it can route every language in `SUPPORTED_LOCALES`, live or not.
// The proxy cannot read the database (architecture.md #3), so before it lets
// such a redirect through it asks here, and this answers from the same
// `getServableLocales()` the public layout, `generateStaticParams` and the
// sitemap read — one rule, so the redirect and the page cannot disagree.
//
// `defaultLocale` is Settings → General → Default language (ADR-182): the
// language a first-time PUBLIC visitor lands in. It is answered only when it
// is a served language, so the proxy never sends anyone to a 404, and as
// `null` otherwise. The admin portal is English by design and ignores it.
//
// Read-only and anonymous: the language menu on every page shows the same
// list, and the default is a public setting.
import { getServableLocales } from "@repo/i18n";
import { getSetting } from "@repo/settings";

export async function GET(): Promise<Response> {
  const [locales, preferred] = await Promise.all([
    getServableLocales(),
    getSetting("site.defaultLocale"),
  ]);
  const defaultLocale =
    preferred && (locales as readonly string[]).includes(preferred) ? preferred : null;
  return Response.json(
    { locales, defaultLocale },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
