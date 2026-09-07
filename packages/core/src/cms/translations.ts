// Page translation lifecycle: create-or-update a locale's title/slug/SEO
// fields, deriving `path` (plan §5.1) and handling the redirect + subtree
// cascade a path change requires.
import { db } from "@repo/db";
import { can, ForbiddenError, type Subject } from "@repo/rbac";
import { derivePagePath, type SavePageTranslationInput } from "@repo/contracts";
import { EmptySlugError, ParentNotTranslatedError, PageNotFoundError } from "./errors.ts";
import {
  assertPathAvailable,
  assertPathNotReserved,
  cascadeToChildren,
  getDefaultLocale,
  resolveParentPathInLocale,
  upsertRedirectForPathChange,
} from "./paths.ts";
import { revalidatePageTags } from "./revalidate.ts";
import { recordAudit } from "../index.ts";

export type PreviewPagePathResult =
  | { ok: true; path: string }
  | { ok: false; error: "PARENT_NOT_TRANSLATED" | "COLLISION" | "RESERVED" };

/**
 * Read-only: what `savePageTranslation` would derive for a CANDIDATE slug
 * — the admin form's live path preview as the admin types, before saving.
 * Never writes.
 */
export async function previewPagePath(input: {
  pageId: string;
  locale: string;
  slug: string;
}): Promise<PreviewPagePathResult> {
  const page = await db.page.findUnique({
    where: { id: input.pageId },
    select: { key: true, parentId: true, kind: true },
  });
  if (!page) return { ok: false, error: "PARENT_NOT_TRANSLATED" };

  const isHome = page.key === "home";
  const parentPath = page.parentId
    ? await resolveParentPathInLocale(db, page.parentId, input.locale)
    : null;
  const derived = derivePagePath({
    isHome,
    slug: isHome ? "" : input.slug,
    hasParent: page.parentId !== null,
    parentPath,
  });
  if (!derived.ok) return { ok: false, error: "PARENT_NOT_TRANSLATED" };

  try {
    assertPathNotReserved(derived.path, page.kind);
  } catch {
    return { ok: false, error: "RESERVED" };
  }
  try {
    await assertPathAvailable(input.locale, derived.path, input.pageId);
  } catch {
    return { ok: false, error: "COLLISION" };
  }
  return { ok: true, path: derived.path };
}

export async function savePageTranslation(
  actor: Subject,
  pageId: string,
  input: SavePageTranslationInput,
): Promise<void> {
  if (!can(actor, "cms.pages.update")) throw new ForbiddenError("cms.pages.update");

  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { id: true, key: true, parentId: true, kind: true, contentType: true },
  });
  if (!page) throw new PageNotFoundError(pageId);

  const isHome = page.key === "home";
  if (!isHome && input.slug === "") throw new EmptySlugError();

  const parentPath = page.parentId
    ? await resolveParentPathInLocale(db, page.parentId, input.locale)
    : null;
  const derived = derivePagePath({
    isHome,
    slug: input.slug,
    hasParent: page.parentId !== null,
    parentPath,
  });
  if (!derived.ok) throw new ParentNotTranslatedError(page.parentId as string, input.locale);

  assertPathNotReserved(derived.path, page.kind);
  await assertPathAvailable(input.locale, derived.path, pageId);

  const defaultLocale = await getDefaultLocale();
  const existing = await db.pageTranslation.findUnique({
    where: { pageId_locale: { pageId, locale: input.locale } },
    select: { path: true },
  });

  await db.$transaction(async (tx) => {
    await tx.pageTranslation.upsert({
      where: { pageId_locale: { pageId, locale: input.locale } },
      update: {
        title: input.title,
        slug: input.slug,
        path: derived.path,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        ogImageId: input.ogImageId,
        canonicalUrl: input.canonicalUrl,
        robots: input.robots,
        includeInSitemap: input.includeInSitemap,
        schemaType: input.schemaType,
      },
      create: {
        pageId,
        locale: input.locale,
        title: input.title,
        slug: input.slug,
        path: derived.path,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        ogImageId: input.ogImageId,
        canonicalUrl: input.canonicalUrl,
        robots: input.robots ?? undefined,
        includeInSitemap: input.includeInSitemap ?? true,
        schemaType: input.schemaType ?? undefined,
      },
    });

    if (existing && existing.path !== derived.path) {
      await upsertRedirectForPathChange(tx, {
        locale: input.locale,
        defaultLocale,
        oldPath: existing.path,
        newPath: derived.path,
        actorId: actor.id,
      });
      await cascadeToChildren(tx, pageId, input.locale, defaultLocale, actor.id, derived.path);
    }
  });

  await recordAudit({
    userId: actor.id,
    action: "cms.pages.translation.save",
    entityType: "page",
    entityId: pageId,
    changes: { after: { locale: input.locale, slug: input.slug, path: derived.path } },
  });

  revalidatePageTags({
    id: pageId,
    translations: [{ locale: input.locale, path: derived.path }],
    kind: page.kind,
    contentType: page.contentType,
  });
}
