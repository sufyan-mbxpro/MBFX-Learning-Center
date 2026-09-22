// Permanent delete — the second step after a soft delete (changes-49,
// ADR-147).
//
// The owner asked for "an option to delete permanently" in every content
// module. It is deliberately a SECOND step: a row must already be in the
// trash (`deletedAt` set) before it can be purged, so no single click takes
// published content off the site AND out of the database. The soft delete
// stays the everyday action, with Restore as its undo; this is for emptying
// the trash.
//
// What goes with the row:
//   - its own children, by the schema's `onDelete: Cascade` (translations,
//     sections and their lessons, progress, attempts, FAQ rows, tag
//     assignments, reads) — the database does that in the same statement;
//   - the polymorphic `ContentReference` rows, which have no foreign key to
//     cascade through: the ones this entity HOLDS (its cover, its body's
//     media — so a picture it used stops counting as "in use" and can be
//     deleted from the library) and the ones that POINT at it (a curated
//     related link, an internal link). Both in the same transaction.
//
// What stays: the audit trail (a purge writes its own row) and any `Redirect`
// whose target was this entity's address — a redirect to a 404 is the same
// outcome a reader gets from the page being gone, and the redirect table is
// managed where it lives.
import type { PurgeableEntity } from "@repo/contracts";
import { db, type Prisma } from "@repo/db";
import { can, type Subject } from "@repo/rbac";
import { revalidateTag } from "next/cache";
import { articleKindPermission } from "./articles.ts";
import { recordAudit } from "./index.ts";

export class NotInTrashError extends Error {
  constructor() {
    super("Only a deleted item can be deleted permanently");
    this.name = "NotInTrashError";
  }
}

export class PurgePermissionError extends Error {
  constructor(permission: string) {
    super(`Deleting permanently requires ${permission}`);
    this.name = "PurgePermissionError";
  }
}

/** The key a purge needs: the same `*.delete` the soft delete needs. */
const DELETE_PERMISSION: Record<Exclude<PurgeableEntity, "article">, string> = {
  course: "courses.delete",
  // Quizzes and videos publish and delete on the LESSON keys (ADR-058,
  // ADR-068) — there is no `quizzes.*` or `videos.*` group.
  lesson: "lessons.delete",
  quiz: "lessons.delete",
  video: "lessons.delete",
  glossary: "glossary.delete",
};

type Tx = Prisma.TransactionClient;

/** Drop every reference this set of rows holds or is the target of. */
async function dropReferences(
  tx: Tx,
  held: { sourceType: Prisma.ContentReferenceWhereInput["sourceType"]; ids: string[] } | null,
  targeted: { refType: Prisma.ContentReferenceWhereInput["refType"]; ids: string[] } | null,
): Promise<void> {
  const or: Prisma.ContentReferenceWhereInput[] = [];
  if (held && held.ids.length > 0) {
    or.push({ sourceType: held.sourceType, sourceId: { in: held.ids } });
  }
  if (targeted && targeted.ids.length > 0) {
    or.push({ refType: targeted.refType, refId: { in: targeted.ids } });
  }
  if (or.length > 0) await tx.contentReference.deleteMany({ where: { OR: or } });
}

/**
 * Delete one soft-deleted content row for good. Refuses a row that is not in
 * the trash (`NotInTrashError`) and an actor without the entity's delete key
 * (`PurgePermissionError`) — the action's own `requirePermission()` runs first
 * (security.md #1); this is the service refusing on its own as well, the way
 * `setArticleDeleted` does.
 */
export async function purgeContent(
  actor: Subject,
  entity: PurgeableEntity,
  id: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    switch (entity) {
      case "course": {
        assertCan(actor, DELETE_PERMISSION.course);
        const row = await tx.course.findUniqueOrThrow({
          where: { id },
          select: { deletedAt: true },
        });
        if (!row.deletedAt) throw new NotInTrashError();
        await dropReferences(
          tx,
          { sourceType: "COURSE", ids: [id] },
          { refType: "COURSE", ids: [id] },
        );
        // Sections, their lessons and every learner's progress cascade.
        await tx.course.delete({ where: { id } });
        break;
      }
      case "lesson": {
        assertCan(actor, DELETE_PERMISSION.lesson);
        const row = await tx.lesson.findUniqueOrThrow({
          where: { id },
          select: { deletedAt: true },
        });
        if (!row.deletedAt) throw new NotInTrashError();
        await tx.lesson.delete({ where: { id } });
        break;
      }
      case "quiz": {
        assertCan(actor, DELETE_PERMISSION.quiz);
        const row = await tx.quiz.findUniqueOrThrow({
          where: { id },
          select: { deletedAt: true },
        });
        if (!row.deletedAt) throw new NotInTrashError();
        await dropReferences(tx, { sourceType: "QUIZ", ids: [id] }, null);
        // A lesson or course that used it keeps existing: both FKs are
        // `SetNull`, which is exactly "this quiz is no longer attached".
        await tx.quiz.delete({ where: { id } });
        break;
      }
      case "video": {
        assertCan(actor, DELETE_PERMISSION.video);
        const row = await tx.videoTopic.findUniqueOrThrow({
          where: { id },
          select: { deletedAt: true },
        });
        if (!row.deletedAt) throw new NotInTrashError();
        await dropReferences(tx, { sourceType: "VIDEO_TOPIC", ids: [id] }, null);
        await tx.videoTopic.delete({ where: { id } });
        break;
      }
      case "glossary": {
        assertCan(actor, DELETE_PERMISSION.glossary);
        const row = await tx.glossaryTerm.findUniqueOrThrow({
          where: { id },
          select: { deletedAt: true },
        });
        if (!row.deletedAt) throw new NotInTrashError();
        await dropReferences(tx, null, { refType: "GLOSSARY_TERM", ids: [id] });
        await tx.glossaryTerm.delete({ where: { id } });
        break;
      }
      case "article": {
        const row = await tx.article.findUniqueOrThrow({
          where: { id },
          select: { deletedAt: true, kind: true },
        });
        assertCan(actor, articleKindPermission(row.kind, "delete"));
        if (!row.deletedAt) throw new NotInTrashError();
        await dropReferences(
          tx,
          { sourceType: "ARTICLE", ids: [id] },
          { refType: "ARTICLE", ids: [id] },
        );
        await tx.article.delete({ where: { id } });
        break;
      }
    }
  });

  await recordAudit({
    userId: actor.id,
    action: `${entity}.purge`,
    entityType: entity,
    entityId: id,
  });
  // A trashed row is not on the public site, so nothing public changes; the
  // tag still drops so an admin list read through the content cache agrees.
  revalidateTag("content", { expire: 0 });
}

function assertCan(actor: Subject, permission: string): void {
  if (!can(actor, permission)) throw new PurgePermissionError(permission);
}
