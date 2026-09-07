// Draft autosave with the ADR-032 §6 optimistic lock: the draft
// `PageVersion` (number 0) is mutable in place; `revision` increments on
// every accepted write and a stale `baseRevision` is refused, not merged.
import { db } from "@repo/db";
import { can, ForbiddenError, type Subject } from "@repo/rbac";
import {
  EMPTY_LAYOUT,
  layoutTreeSchema,
  type LayoutTree,
  type SaveDraftInput,
} from "@repo/contracts";
import { DraftConflictError, NothingPublishedError, PageNotFoundError } from "./errors.ts";
import { recordAudit } from "../index.ts";

export interface PageVersionRow {
  id: string;
  number: number;
  note: string | null;
  authorId: string;
  authorName: string | null;
  createdAt: Date;
}

export async function saveDraft(
  actor: Subject,
  pageId: string,
  input: SaveDraftInput,
): Promise<{ revision: number }> {
  if (!can(actor, "cms.pages.update")) throw new ForbiddenError("cms.pages.update");

  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { draftVersionId: true },
  });
  if (!page?.draftVersionId) throw new PageNotFoundError(pageId);

  const result = await db.pageVersion.updateMany({
    where: { id: page.draftVersionId, revision: input.baseRevision },
    data: { layout: input.layout as never, revision: { increment: 1 } },
  });

  if (result.count === 0) {
    const current = await db.pageVersion.findUniqueOrThrow({
      where: { id: page.draftVersionId },
      select: { revision: true },
    });
    throw new DraftConflictError(current.revision);
  }

  const updated = await db.pageVersion.findUniqueOrThrow({
    where: { id: page.draftVersionId },
    select: { revision: true },
  });
  return { revision: updated.revision };
}

export interface DraftForEditing {
  layout: LayoutTree;
  revision: number;
}

/**
 * PR 3.3 — what the composer loads on open. Defensive parse mirrors
 * `collectReferences`'s own precedent (`references.ts`): a row saved
 * before a schema change, or corrupted data, yields an empty canvas
 * rather than throwing and blocking the editor entirely.
 */
export async function loadDraftForEditing(pageId: string): Promise<DraftForEditing | null> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { draftVersionId: true },
  });
  if (!page?.draftVersionId) return null;

  const draft = await db.pageVersion.findUniqueOrThrow({
    where: { id: page.draftVersionId },
    select: { layout: true, revision: true },
  });
  const parsed = layoutTreeSchema.safeParse(draft.layout);
  return { layout: parsed.success ? parsed.data : EMPTY_LAYOUT, revision: draft.revision };
}

/**
 * Published snapshots only (`number > 0`) — the mutable draft row is never
 * listed as history. `PageVersion.authorId` has no Prisma relation to
 * `User` (a plain scalar, like several other audit-ish columns in this
 * schema) — resolved with a separate lookup rather than adding one,
 * avoiding another migration for a display-only join.
 */
export async function listVersions(pageId: string): Promise<PageVersionRow[]> {
  const rows = await db.pageVersion.findMany({
    where: { pageId, number: { gt: 0 } },
    orderBy: { number: "desc" },
    select: { id: true, number: true, note: true, authorId: true, createdAt: true },
  });
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const authors = authorIds.length
    ? await db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(authors.map((a) => [a.id, a.name]));
  return rows.map((r) => ({ ...r, authorName: nameById.get(r.authorId) ?? null }));
}

/**
 * PR 3.5 — "Restore as draft" (Versions panel): copies an earlier
 * PUBLISHED version's layout into the mutable draft for further editing.
 * Deliberately NOT a `saveDraft` call — this is an explicit, one-shot
 * admin action overwriting whatever is in the draft, not a concurrent
 * autosave racing another tab, so it skips the optimistic-lock check
 * entirely (ADR-032 §6's lock exists for autosave collisions, not this).
 * Publishing state is untouched: this only ever changes the draft.
 */
export async function restoreVersionAsDraft(
  actor: Subject,
  pageId: string,
  versionNumber: number,
): Promise<void> {
  if (!can(actor, "cms.pages.update")) throw new ForbiddenError("cms.pages.update");

  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { draftVersionId: true },
  });
  if (!page?.draftVersionId) throw new PageNotFoundError(pageId);

  const source = await db.pageVersion.findUnique({
    where: { pageId_number: { pageId, number: versionNumber } },
    select: { layout: true },
  });
  if (!source) throw new PageNotFoundError(pageId);

  await db.pageVersion.update({
    where: { id: page.draftVersionId },
    data: { layout: source.layout as never, revision: { increment: 1 } },
  });
  await recordAudit({
    userId: actor.id,
    action: "cms.pages.restoreVersionAsDraft",
    entityType: "page",
    entityId: pageId,
    changes: { after: { restoredFromVersion: versionNumber } },
  });
}

/**
 * "Discard draft" (Versions panel) — resets the mutable draft back to
 * exactly what is currently published, throwing away every unpublished
 * edit. A thin wrapper over `restoreVersionAsDraft` aimed at the
 * currently-published version rather than an arbitrary one.
 */
export async function discardDraft(actor: Subject, pageId: string): Promise<void> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { publishedVersionId: true },
  });
  if (!page) throw new PageNotFoundError(pageId);
  if (!page.publishedVersionId) throw new NothingPublishedError(pageId);

  const published = await db.pageVersion.findUniqueOrThrow({
    where: { id: page.publishedVersionId },
    select: { number: true },
  });
  await restoreVersionAsDraft(actor, pageId, published.number);
}
