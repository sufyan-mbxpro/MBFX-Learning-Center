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
// Read-only and anonymous: the language menu on every page shows the same list.
import { getServableLocales } from "@repo/i18n";

export async function GET(): Promise<Response> {
  return Response.json(
    { locales: await getServableLocales() },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
