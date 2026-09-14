// ADR-091 — only an active locale is served.
//
// Read as SOURCE, like `seo-metadata.test.ts` and `grid-base.test.ts`: the
// three call sites are a `generateStaticParams`, a `notFound()` guard and a
// sitemap builder, none of which has a render to assert against, and the
// defect they encode is "read the wrong list", which no type can catch —
// `routing.locales` and the served list are both `AppLocale[]`.
//
// What went wrong before this: `routing.locales` is the STATIC superset
// next-intl needs to recognise a prefix, and three callers read it as the list
// of locales the site publishes. The build prerendered es/ar/ur, each missing
// 573 public keys, and next-intl throws `MISSING_MESSAGE` on a missing key.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP = resolve(process.cwd(), "app");
const PUBLIC_ROOT_LAYOUT = resolve(APP, "(public)/[locale]/layout.tsx");
const SITEMAP = resolve(APP, "sitemap.ts");

/** Code without comments — this file's own prose names every symbol it forbids. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("the public root layout serves active locales only", () => {
  it("prerenders the servable locales, not routing.locales", () => {
    const source = code(PUBLIC_ROOT_LAYOUT);
    const params = /export async function generateStaticParams\(\)[\s\S]*?\n}/.exec(source)?.[0];

    // Proves the regex still matches something — the failure mode a source
    // guard dies of quietly.
    expect(params).toBeDefined();
    expect(params).toContain("getServableLocales()");
    // The exact line this ADR removed.
    expect(params).not.toContain("routing.locales");
  });

  it("404s a routable locale that is not active", () => {
    // The boundary is here and not in generateStaticParams: dropping a locale
    // from the prerender list alone moves the missing-key error to the first
    // request for /es rather than removing it.
    expect(code(PUBLIC_ROOT_LAYOUT)).toMatch(
      /if\s*\(!\(await isServableLocale\(locale\)\)\)\s*notFound\(\);/,
    );
  });

  it("keeps the routing.locales guard as well — the two reject different things", () => {
    // An unroutable prefix is a 404 for a different reason than an inactive
    // one, and `isServableLocale` narrows to `routing.locales` itself, so
    // losing this line would not change behaviour today. It is kept because it
    // is the one that still holds if the servable list ever widens.
    expect(code(PUBLIC_ROOT_LAYOUT)).toContain("hasLocale(routing.locales, locale)");
  });
});

describe("the sitemap advertises only what is served", () => {
  it("builds static rows from the servable locales", () => {
    const source = code(SITEMAP);

    expect(source).toContain("await getServableLocales()");
    // Listing /es and /ar when neither is served is a crawl hint pointing at
    // a 404 — ADR-086 #5's reasoning about a disabled tool, applied here.
    expect(source).not.toMatch(/routing\.locales\.flatMap/);
  });

  it("filters CONTENT rows by locale too, not just the static paths", () => {
    // Content rows carry their own locale. A glossary term translated into es
    // is a published row whose URL 404s while es is inactive, so filtering the
    // locale list alone would have fixed the static paths and left every
    // translated row in the sitemap.
    const source = code(SITEMAP);

    expect(source).toMatch(/const served = /);
    for (const group of ["glossaryEntries", "articleEntries", "pageEntries"]) {
      expect(source).toContain(`served(${group})`);
    }
    // The four learn groups go through one helper.
    expect(source).toMatch(/const localised = [\s\S]*?served\(entries\)/);
  });

  it("still uses routing.defaultLocale for the unprefixed path", () => {
    // The default locale has no prefix (`localePrefix: "as-needed"`), and that
    // is a routing fact, not an activation one — so this reader stays.
    expect(code(SITEMAP)).toContain("routing.defaultLocale");
  });
});
