import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { publicPagePath, SITE_NAME_PLACEHOLDER, TITLE_PLACEHOLDER } from "@repo/contracts";
import { getServableLocales } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { getSetting } from "@repo/settings";

// The public surface's SEO rules, in one place.
//
// Every public `generateMetadata` used to spell these out for itself, and the
// copies disagreed: some canonicals carried the locale prefix and most did not,
// hreflang listed whatever translation rows existed, and a blank SEO
// description went out as a present-but-undefined key. The helpers below are
// small on purpose — each one is a rule a page would otherwise re-derive.

/**
 * The site's name as search engines and share cards see it: the admin-set
 * `site.name` (Settings → General), the same value the header and footer
 * print. The catalog's `common.siteName` is only the fallback for a database
 * that has no row — it had been the ONLY source for titles and JSON-LD, so
 * renaming the site in admin changed the header and left every `<title>`,
 * `og:site_name` and `publisher` on the old name.
 */
export async function siteName(): Promise<string> {
  const stored = (await getSetting("site.name"))?.trim();
  if (stored) return stored;
  const t = await getTranslations("common");
  return t("siteName");
}

/** What a missing, blank or `%s`-less `seo.titleTemplate` means. */
export const DEFAULT_TITLE_TEMPLATE = `${TITLE_PLACEHOLDER} | ${SITE_NAME_PLACEHOLDER}`;

/**
 * `seo.titleTemplate` with `%site%` already resolved to {@link siteName}, so
 * the brand in every page title follows the site name instead of being typed
 * into the template a second time (it was seeded `%s | MBX Pro`). A template
 * without `%s` would give every page the same title, so it is treated as
 * unset rather than obeyed.
 */
export async function titleTemplate(): Promise<string> {
  const [stored, name] = await Promise.all([getSetting("seo.titleTemplate"), siteName()]);
  const template = stored?.includes(TITLE_PLACEHOLDER) ? stored : DEFAULT_TITLE_TEMPLATE;
  return template.split(SITE_NAME_PLACEHOLDER).join(name);
}

/**
 * A page title through the template. A function replacer, never a string one:
 * `String.replace` reads `$&`, `$$` and `` $` `` in a replacement STRING as
 * patterns, and a title is admin-typed text that can hold a dollar sign.
 */
export function titleFrom(template: string, title: string): string {
  return template.replace(TITLE_PLACEHOLDER, () => title);
}

/** A default-locale path (`/tools/x`) as the given locale's URL (`/es/tools/x`). */
export function localizedPath(locale: string, path: string): string {
  return publicPagePath(locale, routing.defaultLocale, path);
}

/**
 * `{ description }` from the first non-empty candidate, or `{}`.
 *
 * Spread it, never assign it: Next merges `description` as
 * `child.description ?? null`, so a present `description: undefined` ERASES the
 * layout's site description instead of inheriting it — code-style.md #26's
 * `robots` trap, on a different key.
 */
export function descriptionFrom(
  ...candidates: (string | null | undefined)[]
): Pick<Metadata, "description"> {
  const description = candidates.map((value) => value?.trim()).find(Boolean);
  return description ? { description } : {};
}

export interface AlternateLink {
  locale: string;
  /** The locale's own URL, prefix included. */
  href: string;
}

/**
 * `alternates.languages` for hreflang: only locales we SERVE (ADR-091), plus
 * `x-default` pointing at the default locale's URL.
 *
 * The status half of the rule — no machine or draft translation — is applied
 * by the loader that builds the list (`advertisedAlternates` in `@repo/core`).
 * A single entry emits nothing: a page with one language has no alternates to
 * declare, and its canonical already names it.
 */
export async function languageAlternates(
  links: AlternateLink[],
): Promise<Record<string, string> | null> {
  const servable = new Set<string>(await getServableLocales());
  const served = links.filter((link) => servable.has(link.locale));
  if (served.length < 2) return null;
  const languages = Object.fromEntries(served.map((link) => [link.locale, link.href]));
  const fallback = served.find((link) => link.locale === routing.defaultLocale);
  return fallback ? { ...languages, "x-default": fallback.href } : languages;
}

/**
 * `alternates` with a canonical and, when there is more than one served
 * language, hreflang. Never returns a key holding `undefined` (ADR-090).
 */
export async function alternatesFor({
  canonical,
  languages,
}: {
  canonical?: string | null;
  languages?: AlternateLink[];
}): Promise<NonNullable<Metadata["alternates"]>> {
  const hreflang = languages ? await languageAlternates(languages) : null;
  return {
    ...(canonical ? { canonical } : {}),
    ...(hreflang ? { languages: hreflang } : {}),
  };
}

/**
 * A paginated listing's canonical: its own URL, page number included.
 *
 * Page 3 of an archive is a different set of articles from page 1, so it
 * canonicalises to ITSELF (pointing every page at page 1 tells a crawler the
 * deeper pages are duplicates and drops the articles only they link to). What
 * it strips is everything else — `?utm_*`, reordered params — which is the
 * duplication a canonical exists to collapse. `page` is the listing's own
 * zero-based index, written the way `NumberedPagination` writes it.
 */
export function pagedCanonical(path: string, page: number): string {
  return page > 0 ? `${path}?page=${page}` : path;
}

/**
 * Canonical + robots for the `/news` and `/analysis` feeds.
 *
 * A search (`?q=`) is not a page to index: every query would be its own thin
 * listing. It stays `follow`, so the articles it lists still count.
 */
export function listingMetadata(
  locale: string,
  path: string,
  page: number,
  query?: string,
): Pick<Metadata, "alternates" | "robots"> {
  return {
    alternates: { canonical: pagedCanonical(localizedPath(locale, path), page) },
    ...(query ? { robots: { index: false, follow: true } } : {}),
  };
}

/** The site's fallback share image, or null while the setting is empty. */
export async function defaultShareImage(): Promise<string | null> {
  const value = await getSetting("seo.defaultOgImage");
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * `openGraph` + `twitter` for a page that has its own share card.
 *
 * Next REPLACES the layout's `openGraph` wholesale when a page sets one, so a
 * page-level card that forgot `siteName` or the fallback image lost them. This
 * builds the whole object: the page's image, else the site default.
 * `title`/`description` are optional — Next fills an absent one from the
 * page's own metadata.
 */
export async function shareMetadata({
  locale,
  siteName,
  url,
  type = "website",
  title,
  description,
  image,
  publishedTime,
  modifiedTime,
  twitterCard = "summary_large_image",
  twitterImage,
}: {
  locale: string;
  siteName: string;
  url?: string;
  type?: "website" | "article";
  title?: string;
  description?: string | null;
  image?: string | null;
  publishedTime?: string;
  modifiedTime?: string;
  twitterCard?: "summary" | "summary_large_image";
  twitterImage?: string | null;
}): Promise<Pick<Metadata, "openGraph" | "twitter">> {
  const fallback = await defaultShareImage();
  const ogImage = image || fallback;
  const cardImage = twitterImage || ogImage;
  const text = {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
  };
  return {
    openGraph: {
      type,
      siteName,
      locale,
      ...(url ? { url } : {}),
      ...text,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      ...(type === "article" && modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: twitterCard,
      ...text,
      ...(cardImage ? { images: [cardImage] } : {}),
    },
  };
}

/**
 * An `Article.headline` Google will accept: at most 110 characters, cut on a
 * word boundary with an ellipsis. The page's `<h1>` keeps the full title.
 */
export function truncateHeadline(title: string, max = 110): string {
  if (title.length <= max) return title;
  const cut = title.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** A `<script type="application/ld+json">` body, safe inside an HTML document. */
export function jsonLd(graph: unknown): string {
  // `</script>` in any string value would close the element early; `<` escaped
  // as a unicode sequence is still the same JSON.
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
