// Public rendering reads (plan §7.1-7.2). `resolvePublicPage` is the one
// function the catch-all route calls — it never decides between page kinds
// or draft mode itself; that's PR 1.4's job, using this result.
import { cacheLife, cacheTag } from "next/cache";
import { db, type PageKind } from "@repo/db";
import { firstPathSegment, isReservedFirstSegment, publicPagePath } from "@repo/contracts";
import { getRedirect } from "../public-content.ts";
import { getDefaultLocale } from "./paths.ts";

export interface PublicPageRow {
  id: string;
  kind: PageKind;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageId: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  includeInSitemap: boolean;
  schemaType: string | null;
  layout: unknown;
}

function toPublicPageRow(
  page: { id: string; kind: PageKind },
  translation: {
    title: string;
    seoTitle: string | null;
    seoDescription: string | null;
    ogImageId: string | null;
    canonicalUrl: string | null;
    robots: string | null;
    includeInSitemap: boolean;
    schemaType: string | null;
  },
  layout: unknown,
): PublicPageRow {
  return {
    id: page.id,
    kind: page.kind,
    title: translation.title,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    ogImageId: translation.ogImageId,
    canonicalUrl: translation.canonicalUrl,
    robots: translation.robots,
    includeInSitemap: translation.includeInSitemap,
    schemaType: translation.schemaType,
    layout,
  };
}

export async function loadPublishedPageByPath(
  locale: string,
  path: string,
): Promise<PublicPageRow | null> {
  const translation = await db.pageTranslation.findUnique({
    where: { locale_path: { locale, path } },
    select: {
      title: true,
      seoTitle: true,
      seoDescription: true,
      ogImageId: true,
      canonicalUrl: true,
      robots: true,
      includeInSitemap: true,
      schemaType: true,
      page: {
        select: { id: true, kind: true, publishedVersionId: true, deletedAt: true, isActive: true },
      },
    },
  });
  if (!translation || translation.page.deletedAt || !translation.page.isActive) return null;
  if (!translation.page.publishedVersionId) return null;

  const version = await db.pageVersion.findUnique({
    where: { id: translation.page.publishedVersionId },
    select: { layout: true },
  });
  if (!version) return null;

  return toPublicPageRow(translation.page, translation, version.layout);
}

async function getCachedPublishedPageByPath(
  locale: string,
  path: string,
): Promise<PublicPageRow | null> {
  "use cache";
  cacheTag(`page-path:${locale}:${path}`);
  cacheLife({ revalidate: 300 });
  return loadPublishedPageByPath(locale, path);
}

async function loadPublishedPageById(
  pageId: string,
  locale: string,
): Promise<PublicPageRow | null> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      kind: true,
      publishedVersionId: true,
      deletedAt: true,
      isActive: true,
      translations: {
        select: {
          locale: true,
          title: true,
          seoTitle: true,
          seoDescription: true,
          ogImageId: true,
          canonicalUrl: true,
          robots: true,
          includeInSitemap: true,
          schemaType: true,
        },
      },
    },
  });
  if (!page || page.deletedAt || !page.isActive || !page.publishedVersionId) return null;

  const version = await db.pageVersion.findUnique({
    where: { id: page.publishedVersionId },
    select: { layout: true },
  });
  if (!version) return null;

  // TODO(Module 16 Phase 6+): thread the real fallback chain (@repo/i18n
  // pickTranslation) once a consumer needs cross-locale fallback; today's
  // callers (menus/links, once they land) pass the locale they need.
  const translation = page.translations.find((t) => t.locale === locale) ?? page.translations[0];
  if (!translation) return null;

  return toPublicPageRow(page, translation, version.layout);
}

async function getCachedPublishedPageById(
  pageId: string,
  locale: string,
): Promise<PublicPageRow | null> {
  "use cache";
  cacheTag(`page:${pageId}`);
  cacheLife({ revalidate: 300 });
  return loadPublishedPageById(pageId, locale);
}

export async function getPublishedPage(
  pageId: string,
  locale: string,
): Promise<PublicPageRow | null> {
  return getCachedPublishedPageById(pageId, locale);
}

export async function loadDraftPage(pageId: string, locale: string): Promise<PublicPageRow | null> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      kind: true,
      draftVersionId: true,
      translations: {
        select: {
          locale: true,
          title: true,
          seoTitle: true,
          seoDescription: true,
          ogImageId: true,
          canonicalUrl: true,
          robots: true,
          includeInSitemap: true,
          schemaType: true,
        },
      },
    },
  });
  if (!page?.draftVersionId) return null;

  const version = await db.pageVersion.findUnique({
    where: { id: page.draftVersionId },
    select: { layout: true },
  });
  if (!version) return null;

  const translation = page.translations.find((t) => t.locale === locale) ?? page.translations[0];
  if (!translation) return null;

  return toPublicPageRow(page, translation, version.layout);
}

/**
 * The public URL `/api/preview` redirects to after enabling draft mode —
 * kept here (not a raw db call in the route handler) because route
 * handlers never touch Prisma directly (architecture.md #2).
 */
export async function resolvePreviewUrl(pageId: string, locale: string): Promise<string | null> {
  const translation = await db.pageTranslation.findUnique({
    where: { pageId_locale: { pageId, locale } },
    select: { path: true },
  });
  if (!translation) return null;
  const defaultLocale = await getDefaultLocale();
  return publicPagePath(locale, defaultLocale, translation.path);
}

/**
 * Build-time static params for the STATIC-page catch-all (ADR-025 §3: only
 * published STATIC paths, never DETAIL — the build-OOM risk this repo
 * already tracks applies here too). Home (`path === "/"`) is excluded: it
 * has no segments for `[...slug]` to receive and isn't served by the CMS
 * until Phase 2 (PR 2.7) regardless.
 */
export async function loadStaticPageParams(): Promise<{ locale: string; slug: string[] }[]> {
  const rows = await db.pageTranslation.findMany({
    where: {
      path: { not: "/" },
      page: { kind: "STATIC", publishedVersionId: { not: null }, deletedAt: null, isActive: true },
    },
    select: { locale: true, path: true },
  });
  return rows.map((r) => ({ locale: r.locale, slug: r.path.split("/").filter(Boolean) }));
}

/** Sitemap feed: every published, sitemap-eligible page translation. */
export async function loadPageSitemapEntries(): Promise<
  { locale: string; path: string; updatedAt: Date }[]
> {
  return db.pageTranslation.findMany({
    where: {
      includeInSitemap: true,
      page: { publishedVersionId: { not: null }, deletedAt: null, isActive: true },
    },
    select: { locale: true, path: true, updatedAt: true },
  });
}

/**
 * A COLLECTION page's path is fixed to its content type's own hosting
 * route (`CONTENT_ROUTES`, e.g. `/news`) — a reserved segment everywhere
 * else. `resolvePublicPage`'s reserved-path guard exists to stop a STATIC
 * page claiming that segment, so it cannot be reused here; this is the
 * dedicated lookup an explicit route file (`news/page.tsx`, plan v2.2 §12
 * PR 4.4) calls directly, the same way `[locale]/page.tsx`'s
 * `renderCmsHome` calls `resolvePublicPage` directly for `"/"`.
 */
export async function resolveCollectionPage(
  contentType: string,
  locale: string,
  options: { draft?: boolean } = {},
): Promise<ResolvedPublicPage> {
  const page = await db.page.findFirst({
    where: { kind: "COLLECTION", contentType, deletedAt: null },
    select: { id: true, draftVersionId: true, publishedVersionId: true },
  });
  if (!page) return { kind: "not-found" };

  if (options.draft && page.draftVersionId) {
    const draft = await loadDraftPage(page.id, locale);
    if (draft) return { kind: "page", page: draft };
  }

  if (!page.publishedVersionId) return { kind: "not-found" };
  const published = await getPublishedPage(page.id, locale);
  if (!published) return { kind: "not-found" };
  return { kind: "page", page: published };
}

export type ResolvedPublicPage =
  { kind: "page"; page: PublicPageRow } | { kind: "redirect"; to: string } | { kind: "not-found" };

/**
 * The catch-all's one entry point (plan §7.2 order): reserved-path guard →
 * `Redirect` lookup → draft-mode preview → published version → not-found.
 * In draft mode the page is found by its CURRENT `(locale, path)` — the
 * same address the admin's live path preview shows — regardless of publish
 * state, and its DRAFT layout renders; a path with no page at all falls
 * through to the published lookup (harmless — nothing published lives
 * there either).
 */
export async function resolvePublicPage(
  locale: string,
  path: string,
  options: { draft?: boolean } = {},
): Promise<ResolvedPublicPage> {
  const segment = firstPathSegment(path);
  if (isReservedFirstSegment(segment)) return { kind: "not-found" };

  const redirectTo = await getRedirect(path);
  if (redirectTo) return { kind: "redirect", to: redirectTo };

  if (options.draft) {
    const translation = await db.pageTranslation.findUnique({
      where: { locale_path: { locale, path } },
      select: { pageId: true },
    });
    if (translation) {
      const draft = await loadDraftPage(translation.pageId, locale);
      if (draft) return { kind: "page", page: draft };
    }
  }

  const page = await getCachedPublishedPageByPath(locale, path);
  if (!page) return { kind: "not-found" };
  return { kind: "page", page };
}
