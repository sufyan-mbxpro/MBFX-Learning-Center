// Page CRUD (create, update metadata, reparent, duplicate, soft-delete,
// admin listing). Publish/unpublish/rollback live in publish.ts; the
// translation lifecycle lives in translations.ts.
import { db, PageKind, type ContentStatus } from "@repo/db";
import { can, ForbiddenError, type Subject } from "@repo/rbac";
import {
  derivePagePath,
  EMPTY_LAYOUT,
  type CreatePageInput,
  type ListPagesQuery,
  type UpdatePageMetaInput,
} from "@repo/contracts";
import {
  CyclicParentError,
  PageHasChildrenError,
  PageNotFoundError,
  ParentNotTranslatedError,
} from "./errors.ts";
import {
  assertParentDepthOk,
  assertPathAvailable,
  assertPathNotReserved,
  assertReparentOk,
  getDefaultLocale,
  recomputePagePathAfterReparent,
} from "./paths.ts";
import { recordAudit } from "../index.ts";

export async function createPage(actor: Subject, input: CreatePageInput): Promise<string> {
  if (!can(actor, "cms.pages.create")) throw new ForbiddenError("cms.pages.create");

  if (input.parentId) await assertParentDepthOk(input.parentId);

  const defaultLocale = await getDefaultLocale();
  const parentPath = input.parentId
    ? ((
        await db.pageTranslation.findUnique({
          where: { pageId_locale: { pageId: input.parentId, locale: defaultLocale } },
          select: { path: true },
        })
      )?.path ?? null)
    : null;

  const derived = derivePagePath({
    isHome: false,
    slug: input.slug,
    hasParent: Boolean(input.parentId),
    parentPath,
  });
  if (!derived.ok) throw new ParentNotTranslatedError(input.parentId as string, defaultLocale);

  assertPathNotReserved(derived.path, PageKind.STATIC);
  await assertPathAvailable(defaultLocale, derived.path);

  const page = await db.$transaction(async (tx) => {
    const created = await tx.page.create({
      data: {
        kind: PageKind.STATIC,
        status: "DRAFT",
        createdById: actor.id,
        parentId: input.parentId ?? null,
        group: input.group ?? null,
      },
    });
    await tx.pageTranslation.create({
      data: {
        pageId: created.id,
        locale: defaultLocale,
        title: input.title,
        slug: input.slug,
        path: derived.path,
      },
    });
    const draft = await tx.pageVersion.create({
      data: {
        pageId: created.id,
        number: 0,
        revision: 0,
        layout: EMPTY_LAYOUT as never,
        authorId: actor.id,
      },
    });
    await tx.page.update({ where: { id: created.id }, data: { draftVersionId: draft.id } });
    return created;
  });

  await recordAudit({
    userId: actor.id,
    action: "cms.pages.create",
    entityType: "page",
    entityId: page.id,
    changes: { after: { title: input.title, slug: input.slug, path: derived.path } },
  });

  return page.id;
}

export async function updatePageMeta(
  actor: Subject,
  pageId: string,
  input: UpdatePageMetaInput,
): Promise<void> {
  if (!can(actor, "cms.pages.update")) throw new ForbiddenError("cms.pages.update");

  const page = await db.page.findUnique({ where: { id: pageId }, select: { id: true, key: true } });
  if (!page) throw new PageNotFoundError(pageId);

  const reparenting = input.parentId !== undefined;
  if (input.parentId !== undefined && input.parentId !== null) {
    if (page.key === "home") throw new CyclicParentError(); // the home page is always the root
    await assertReparentOk(pageId, input.parentId);
  }

  const defaultLocale = await getDefaultLocale();

  await db.$transaction(async (tx) => {
    await tx.page.update({
      where: { id: pageId },
      data: {
        parentId: input.parentId,
        group: input.group,
        visibility: input.visibility,
        requiresFeature: input.requiresFeature,
        isActive: input.isActive,
        updatedById: actor.id,
      },
    });

    if (reparenting) {
      const locales = await tx.pageTranslation.findMany({
        where: { pageId },
        select: { locale: true },
      });
      for (const { locale } of locales) {
        await recomputePagePathAfterReparent(tx, pageId, locale, defaultLocale, actor.id);
      }
    }
  });

  await recordAudit({
    userId: actor.id,
    action: "cms.pages.updateMeta",
    entityType: "page",
    entityId: pageId,
    changes: { after: input },
  });
}

export async function duplicatePage(actor: Subject, pageId: string): Promise<string> {
  if (!can(actor, "cms.pages.create")) throw new ForbiddenError("cms.pages.create");

  const source = await db.page.findUnique({
    where: { id: pageId },
    include: { translations: true, versions: { where: { number: 0 } } },
  });
  if (!source) throw new PageNotFoundError(pageId);

  const draftLayout = source.versions[0]?.layout ?? EMPTY_LAYOUT;

  const newPageId = await db.$transaction(async (tx) => {
    const created = await tx.page.create({
      data: {
        kind: source.kind,
        contentType: source.contentType,
        status: "DRAFT",
        createdById: actor.id,
        group: source.group,
      },
    });

    for (const t of source.translations) {
      const base = t.slug === "" ? "page" : t.slug;
      let candidateSlug = `${base}-copy`;
      let candidatePath = `/${candidateSlug}`;
      let suffix = 2;
      // Duplicates are always created at the root — an admin reparents
      // afterward via updatePageMeta if the copy belongs under a parent.
      while (
        await tx.pageTranslation.findUnique({
          where: { locale_path: { locale: t.locale, path: candidatePath } },
        })
      ) {
        candidateSlug = `${base}-copy-${suffix}`;
        candidatePath = `/${candidateSlug}`;
        suffix += 1;
      }
      await tx.pageTranslation.create({
        data: {
          pageId: created.id,
          locale: t.locale,
          title: `${t.title} (Copy)`,
          slug: candidateSlug,
          path: candidatePath,
        },
      });
    }

    const draft = await tx.pageVersion.create({
      data: {
        pageId: created.id,
        number: 0,
        revision: 0,
        layout: draftLayout as never,
        authorId: actor.id,
      },
    });
    await tx.page.update({ where: { id: created.id }, data: { draftVersionId: draft.id } });
    return created.id;
  });

  await recordAudit({
    userId: actor.id,
    action: "cms.pages.duplicate",
    entityType: "page",
    entityId: newPageId,
    changes: { after: { sourcePageId: pageId } },
  });

  return newPageId;
}

export async function setPageDeleted(
  actor: Subject,
  pageId: string,
  deleted: boolean,
): Promise<void> {
  if (!can(actor, "cms.pages.delete")) throw new ForbiddenError("cms.pages.delete");

  const page = await db.page.findUnique({ where: { id: pageId }, select: { id: true } });
  if (!page) throw new PageNotFoundError(pageId);

  if (deleted) {
    const childCount = await db.page.count({ where: { parentId: pageId, deletedAt: null } });
    if (childCount > 0) throw new PageHasChildrenError(childCount);
  }

  await db.page.update({ where: { id: pageId }, data: { deletedAt: deleted ? new Date() : null } });
  await recordAudit({
    userId: actor.id,
    action: deleted ? "cms.pages.delete" : "cms.pages.restore",
    entityType: "page",
    entityId: pageId,
  });
}

export interface PageDetailTranslation {
  locale: string;
  title: string;
  slug: string;
  path: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  includeInSitemap: boolean;
  schemaType: string | null;
}

export interface PageDetail {
  id: string;
  key: string | null;
  kind: PageKind;
  status: ContentStatus;
  isActive: boolean;
  visibility: string;
  requiresFeature: string | null;
  parentId: string | null;
  group: string | null;
  publishedVersionId: string | null;
  draftRevision: number;
  updatedAt: Date;
  translations: PageDetailTranslation[];
}

export async function loadPageDetail(id: string): Promise<PageDetail | null> {
  const page = await db.page.findUnique({
    where: { id },
    include: { translations: true, versions: { where: { number: 0 }, select: { revision: true } } },
  });
  if (!page) return null;

  return {
    id: page.id,
    key: page.key,
    kind: page.kind,
    status: page.status,
    isActive: page.isActive,
    visibility: page.visibility,
    requiresFeature: page.requiresFeature,
    parentId: page.parentId,
    group: page.group,
    publishedVersionId: page.publishedVersionId,
    draftRevision: page.versions[0]?.revision ?? 0,
    updatedAt: page.updatedAt,
    translations: page.translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      slug: t.slug,
      path: t.path,
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
      canonicalUrl: t.canonicalUrl,
      robots: t.robots,
      includeInSitemap: t.includeInSitemap,
      schemaType: t.schemaType,
    })),
  };
}

/** STATIC pages an admin may pick as a parent — excludes the page itself (a page cannot be its own parent) and soft-deleted rows. Titled by `defaultLocale`. */
export async function listParentCandidates(
  defaultLocale: string,
  excludePageId?: string,
): Promise<{ id: string; title: string }[]> {
  const rows = await db.page.findMany({
    where: {
      kind: PageKind.STATIC,
      deletedAt: null,
      ...(excludePageId ? { id: { not: excludePageId } } : {}),
    },
    include: { translations: { where: { locale: defaultLocale } } },
  });
  return rows.map((p) => ({ id: p.id, title: p.translations[0]?.title ?? p.key ?? p.id }));
}

export interface PageListRow {
  id: string;
  key: string | null;
  kind: PageKind;
  title: string | null;
  path: string | null;
  status: ContentStatus;
  isActive: boolean;
  hasUnpublishedChanges: boolean;
  updatedById: string | null;
  updatedAt: Date;
}

/** §8.1's vocabulary: "Pages" (STATIC/COLLECTION), "Designs" (DETAIL), "Global" (PART — reserved for Phase 6, empty until then). */
export async function listPagesAdmin(
  query: ListPagesQuery,
  defaultLocale: string,
): Promise<{ rows: PageListRow[]; total: number }> {
  const tab = query.tab ?? "pages";
  if (tab === "global") return { rows: [], total: 0 }; // PageKind.PART lands in Phase 6 (ADR-027)

  const kindFilter = tab === "designs" ? [PageKind.DETAIL] : [PageKind.STATIC, PageKind.COLLECTION];
  const pageSize = 20;
  const skip = (query.page ?? 0) * pageSize;
  const sortBy = query.sortBy ?? "updatedAt";
  const sortDir = query.sortDir ?? "desc";

  const where = {
    deletedAt: null,
    kind: { in: kindFilter },
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? { translations: { some: { locale: defaultLocale, title: { contains: query.q } } } }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.page.findMany({
      where,
      include: {
        translations: { where: { locale: defaultLocale } },
        versions: { where: { number: 0 }, select: { revision: true } },
      },
      orderBy: sortBy === "title" ? undefined : { [sortBy]: sortDir },
      skip,
      take: pageSize,
    }),
    db.page.count({ where }),
  ]);

  const publishedIds = rows
    .map((p) => p.publishedVersionId)
    .filter((id): id is string => Boolean(id));
  const publishedVersions = publishedIds.length
    ? await db.pageVersion.findMany({
        where: { id: { in: publishedIds } },
        select: { id: true, revision: true },
      })
    : [];
  const publishedRevisionById = new Map(publishedVersions.map((v) => [v.id, v.revision]));

  return {
    total,
    rows: rows.map((p) => {
      const draftRevision = p.versions[0]?.revision ?? 0;
      const publishedRevision = p.publishedVersionId
        ? (publishedRevisionById.get(p.publishedVersionId) ?? 0)
        : null;
      return {
        id: p.id,
        key: p.key,
        kind: p.kind,
        title: p.translations[0]?.title ?? null,
        path: p.translations[0]?.path ?? null,
        status: p.status,
        isActive: p.isActive,
        hasUnpublishedChanges:
          publishedRevision === null ? true : draftRevision > publishedRevision,
        updatedById: p.updatedById,
        updatedAt: p.updatedAt,
      };
    }),
  };
}
