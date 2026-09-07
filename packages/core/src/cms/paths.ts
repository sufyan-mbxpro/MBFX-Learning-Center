// Path derivation, the service half (plan v2.2 §5.1). @repo/contracts owns
// the pure algorithm (derivePagePath, publicPagePath, reserved-segment
// checks); this file is what reads/writes the database around it: parent
// resolution, the cycle/depth guard, and the redirect + shadow-deactivate
// pair a path change must always perform together.
import { db, type PageKind, type Prisma } from "@repo/db";
import {
  derivePagePath,
  firstPathSegment,
  isReservedFirstSegment,
  MAX_PAGE_DEPTH,
  publicPagePath,
} from "@repo/contracts";
import {
  CyclicParentError,
  MaxDepthExceededError,
  ParentNotTranslatedError,
  PathCollisionError,
  ReservedPathError,
} from "./errors.ts";

export async function getDefaultLocale(): Promise<string> {
  return (
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en"
  );
}

async function walkParentChain(startParentId: string, excludePageId?: string): Promise<void> {
  let current: string | null = startParentId;
  let depth = 0;
  const seen = new Set<string>();
  while (current) {
    if (excludePageId && current === excludePageId) throw new CyclicParentError();
    if (seen.has(current)) throw new CyclicParentError(); // a corrupt existing chain must not loop forever
    seen.add(current);
    depth += 1;
    if (depth > MAX_PAGE_DEPTH) throw new MaxDepthExceededError(depth, MAX_PAGE_DEPTH);
    const row: { parentId: string | null } | null = await db.page.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    if (!row) return; // a dangling id is a data-integrity problem elsewhere, not this guard's job
    current = row.parentId;
  }
}

/** Create-page path: no self-reference is possible yet, only the depth cap applies. */
export async function assertParentDepthOk(parentId: string): Promise<void> {
  await walkParentChain(parentId);
}

/** Reparent path: `candidateParentId` must not be `pageId` itself or a descendant of it. */
export async function assertReparentOk(pageId: string, candidateParentId: string): Promise<void> {
  if (candidateParentId === pageId) throw new CyclicParentError();
  await walkParentChain(candidateParentId, pageId);
}

/** `kind` COLLECTION is exempt — its path is fixed to its content type's hosting route (plan §5.1 rule 3), checked by the caller against CONTENT_ROUTES instead of this guard. */
export function assertPathNotReserved(path: string, kind: PageKind): void {
  if ((kind as string) === "COLLECTION") return;
  const segment = firstPathSegment(path);
  if (isReservedFirstSegment(segment)) throw new ReservedPathError(segment);
}

export async function assertPathAvailable(
  locale: string,
  path: string,
  excludePageId?: string,
): Promise<void> {
  const existing = await db.pageTranslation.findUnique({
    where: { locale_path: { locale, path } },
    select: { pageId: true },
  });
  if (existing && existing.pageId !== excludePageId) {
    throw new PathCollisionError(locale, path, existing.pageId);
  }
}

/** The parent's path in `locale`, or `null` if the parent has no translation there — the input `derivePagePath` needs to decide PARENT_NOT_TRANSLATED. */
export async function resolveParentPathInLocale(
  tx: Prisma.TransactionClient | typeof db,
  parentId: string,
  locale: string,
): Promise<string | null> {
  const row = await tx.pageTranslation.findUnique({
    where: { pageId_locale: { pageId: parentId, locale } },
    select: { path: true },
  });
  return row?.path ?? null;
}

/**
 * Writes (or refreshes) a 301 `Redirect` from `oldPath` to `newPath` — both
 * PUBLIC paths (locale-prefixed), matching articles.ts/content.ts's
 * `createSlugRedirect` precedent of doing this unconditionally on any slug
 * change, not only for currently-published pages (a bookmarked draft
 * preview is still worth redirecting, and the cost of an unused row is
 * nil). Then deactivates any existing redirect that would otherwise SHADOW
 * the page's new live path — the resolver checks redirects before pages
 * (plan §7.2), so a stale row claiming `newPath` would make the page
 * unreachable at its own address.
 */
export async function upsertRedirectForPathChange(
  tx: Prisma.TransactionClient,
  params: {
    locale: string;
    defaultLocale: string;
    oldPath: string;
    newPath: string;
    actorId: string;
  },
): Promise<void> {
  const { locale, defaultLocale, oldPath, newPath, actorId } = params;
  if (oldPath === newPath) return;
  const oldPublic = publicPagePath(locale, defaultLocale, oldPath);
  const newPublic = publicPagePath(locale, defaultLocale, newPath);
  if (oldPublic === newPublic) return;

  await tx.redirect.upsert({
    where: { fromPath: oldPublic },
    update: { toPath: newPublic, isActive: true },
    create: { fromPath: oldPublic, toPath: newPublic, statusCode: 301, createdBy: actorId },
  });
  await tx.redirect.updateMany({
    where: { fromPath: newPublic, isActive: true },
    data: { isActive: false },
  });
}

/**
 * After a page's own path changed in `locale` (slug edit or reparent —
 * the caller has already written the new value and passes it as
 * `newParentPath`), cascades the same recomputation to every descendant
 * that has a translation in that locale, recursively, writing a redirect
 * for each descendant whose path actually moves.
 */
export async function cascadeToChildren(
  tx: Prisma.TransactionClient,
  pageId: string,
  locale: string,
  defaultLocale: string,
  actorId: string,
  newParentPath: string,
): Promise<void> {
  const children = await tx.page.findMany({ where: { parentId: pageId }, select: { id: true } });
  for (const child of children) {
    const childTranslation = await tx.pageTranslation.findUnique({
      where: { pageId_locale: { pageId: child.id, locale } },
      select: { path: true, slug: true },
    });
    if (!childTranslation) continue; // no translation in this locale — nothing to move

    const derived = derivePagePath({
      isHome: false,
      slug: childTranslation.slug,
      hasParent: true,
      parentPath: newParentPath,
    });
    if (!derived.ok || derived.path === childTranslation.path) continue;

    await upsertRedirectForPathChange(tx, {
      locale,
      defaultLocale,
      oldPath: childTranslation.path,
      newPath: derived.path,
      actorId,
    });
    await tx.pageTranslation.update({
      where: { pageId_locale: { pageId: child.id, locale } },
      data: { path: derived.path },
    });
    await cascadeToChildren(tx, child.id, locale, defaultLocale, actorId, derived.path);
  }
}

/**
 * Recomputes `pageId`'s own path in `locale` from its CURRENT `parentId`
 * and CURRENT slug (both already written by the caller inside the same
 * transaction) and cascades to descendants if it moved. Used by
 * `updatePageMeta`/`setPageParent` after a reparent — `savePageTranslation`
 * does the equivalent inline because it also has to upsert the row itself.
 */
export async function recomputePagePathAfterReparent(
  tx: Prisma.TransactionClient,
  pageId: string,
  locale: string,
  defaultLocale: string,
  actorId: string,
): Promise<void> {
  const page = await tx.page.findUniqueOrThrow({
    where: { id: pageId },
    select: { parentId: true, key: true },
  });
  const own = await tx.pageTranslation.findUnique({
    where: { pageId_locale: { pageId, locale } },
    select: { path: true, slug: true },
  });
  if (!own) return;

  const parentPath = page.parentId
    ? await resolveParentPathInLocale(tx, page.parentId, locale)
    : null;
  const derived = derivePagePath({
    isHome: page.key === "home",
    slug: own.slug,
    hasParent: page.parentId !== null,
    parentPath,
  });
  if (!derived.ok) {
    // page.parentId is non-null whenever `hasParent` is true here.
    throw new ParentNotTranslatedError(page.parentId as string, locale);
  }
  if (derived.path === own.path) return;

  await upsertRedirectForPathChange(tx, {
    locale,
    defaultLocale,
    oldPath: own.path,
    newPath: derived.path,
    actorId,
  });
  await tx.pageTranslation.update({
    where: { pageId_locale: { pageId, locale } },
    data: { path: derived.path },
  });
  await cascadeToChildren(tx, pageId, locale, defaultLocale, actorId, derived.path);
}
