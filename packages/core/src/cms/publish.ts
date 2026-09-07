// Publishing workflow (plan v2.2 §10, ADR-032 §6): draft mutable in place,
// publish SNAPSHOTS it into a new immutable PageVersion and points
// `publishedVersionId` at it; rollback moves the pointer; unpublish nulls
// it. History is publishes, not keystrokes.
import { db, type PageKind } from "@repo/db";
import { can, ForbiddenError, type Subject } from "@repo/rbac";
import type { PublishPageInput } from "@repo/contracts";
import { PageNotFoundError, PublishGateError } from "./errors.ts";
import { runPublishGates } from "./gates.ts";
import { collectReferences, syncReferences } from "./references.ts";
import { revalidatePageTags } from "./revalidate.ts";
import { recordAudit } from "../index.ts";

export { runPublishGates, type PublishGateResult } from "./gates.ts";

// Part publish uses `cms.parts.publish` once `PageKind.PART` exists
// (Phase 6, ADR-027); every kind in Phase 1 uses the page permission.
function publishPermissionFor(_kind: PageKind): string {
  return "cms.pages.publish";
}

async function loadPageForPublish(pageId: string) {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { id: true, kind: true, contentType: true, draftVersionId: true },
  });
  if (!page || !page.draftVersionId) throw new PageNotFoundError(pageId);
  return page as typeof page & { draftVersionId: string };
}

export async function publishPage(
  actor: Subject,
  pageId: string,
  input: PublishPageInput,
): Promise<number> {
  const page = await loadPageForPublish(pageId);
  const permission = publishPermissionFor(page.kind);
  if (!can(actor, permission)) throw new ForbiddenError(permission);

  const draft = await db.pageVersion.findUniqueOrThrow({ where: { id: page.draftVersionId } });
  const gate = await runPublishGates(draft.layout);
  if (gate.errors.length > 0) throw new PublishGateError(gate.errors);

  const translations = await db.pageTranslation.findMany({
    where: { pageId },
    select: { locale: true, path: true },
  });

  const versionNumber = await db.$transaction(async (tx) => {
    const latest = await tx.pageVersion.aggregate({
      where: { pageId, number: { gt: 0 } },
      _max: { number: true },
    });
    const nextNumber = (latest._max.number ?? 0) + 1;

    const snapshot = await tx.pageVersion.create({
      data: {
        pageId,
        number: nextNumber,
        layout: draft.layout as never,
        note: input.note ?? null,
        authorId: actor.id,
        revision: draft.revision,
      },
    });
    await tx.page.update({
      where: { id: pageId },
      data: { publishedVersionId: snapshot.id, status: "PUBLISHED", publishedAt: new Date() },
    });
    await syncReferences(
      tx,
      { sourceType: "PAGE_VERSION", sourceId: snapshot.id },
      collectReferences(draft.layout),
    );
    return nextNumber;
  });

  await recordAudit({
    userId: actor.id,
    action: "cms.pages.publish",
    entityType: "page",
    entityId: pageId,
    changes: { after: { versionNumber, note: input.note } },
  });
  revalidatePageTags({ id: pageId, translations, kind: page.kind, contentType: page.contentType });

  return versionNumber;
}

export async function unpublishPage(actor: Subject, pageId: string): Promise<void> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { id: true, kind: true, contentType: true },
  });
  if (!page) throw new PageNotFoundError(pageId);
  const permission = publishPermissionFor(page.kind);
  if (!can(actor, permission)) throw new ForbiddenError(permission);

  const translations = await db.pageTranslation.findMany({
    where: { pageId },
    select: { locale: true, path: true },
  });

  await db.page.update({
    where: { id: pageId },
    data: { publishedVersionId: null, status: "DRAFT" },
  });
  await recordAudit({
    userId: actor.id,
    action: "cms.pages.unpublish",
    entityType: "page",
    entityId: pageId,
  });
  revalidatePageTags({ id: pageId, translations, kind: page.kind, contentType: page.contentType });
}

export async function rollbackPage(
  actor: Subject,
  pageId: string,
  versionNumber: number,
): Promise<void> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { id: true, kind: true, contentType: true },
  });
  if (!page) throw new PageNotFoundError(pageId);
  const permission = publishPermissionFor(page.kind);
  if (!can(actor, permission)) throw new ForbiddenError(permission);

  const version = await db.pageVersion.findUnique({
    where: { pageId_number: { pageId, number: versionNumber } },
    select: { id: true },
  });
  if (!version) throw new PageNotFoundError(pageId);

  const translations = await db.pageTranslation.findMany({
    where: { pageId },
    select: { locale: true, path: true },
  });

  await db.page.update({
    where: { id: pageId },
    data: { publishedVersionId: version.id, status: "PUBLISHED", publishedAt: new Date() },
  });
  await recordAudit({
    userId: actor.id,
    action: "cms.pages.rollback",
    entityType: "page",
    entityId: pageId,
    changes: { after: { versionNumber } },
  });
  revalidatePageTags({ id: pageId, translations, kind: page.kind, contentType: page.contentType });
}
