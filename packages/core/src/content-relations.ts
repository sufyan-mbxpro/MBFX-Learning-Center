// Generic cross-entity relations (changes-07 PR 3).
//
// `ContentRelation` has been in the schema since Module 11 and was wired by
// exactly zero services — the CMS never used it. Article related-posts claim
// it here, which is reuse of dead schema rather than a revival of anything
// ADR-042 cancelled (see changes-07-plan.md §10.3).
//
// Nothing in this file is CMS code and nothing here imports from
// `packages/core/src/cms/*`.

import { db, type Prisma } from "@repo/db";

/** The one relation type articles use today. Others get their own constants. */
export const RELATED = "related";
export const ARTICLE = "article";

/**
 * Course recommendations (ADR-055). Deliberately reuses `ContentRelation`
 * rather than adding a `CourseRecommendation` table: this model is already
 * generic, ordered, duplicate-proof by unique constraint, and drops
 * self-references — every property the feature needs. Two constants, no new
 * persistence.
 */
export const COURSE = "course";
export const RECOMMENDED = "recommended";

/**
 * Full replacement of one (source, targetType, relationType) relation set,
 * ordered by array position. Same "replace, never merge" rule as tag
 * assignments and role permissions.
 *
 * Takes a transaction client so a caller can commit relations atomically with
 * whatever else it is writing — `saveArticle` depends on that.
 *
 * Self-references are dropped rather than rejected: an article listing itself
 * as related is a UI slip, not an error worth failing a whole save over.
 */
export async function replaceRelations(
  tx: Prisma.TransactionClient,
  params: {
    sourceType: string;
    sourceId: string;
    targetType: string;
    relationType: string;
    targetIds: string[];
  },
): Promise<void> {
  const { sourceType, sourceId, targetType, relationType } = params;
  const targetIds = [...new Set(params.targetIds)].filter((id) => id !== sourceId);

  await tx.contentRelation.deleteMany({
    where: { sourceType, sourceId, targetType, relationType },
  });
  if (targetIds.length === 0) return;

  await tx.contentRelation.createMany({
    data: targetIds.map((targetId, index) => ({
      sourceType,
      sourceId,
      targetType,
      targetId,
      relationType,
      sortOrder: index,
    })),
  });
}

/** Ordered target ids of one relation set — what the editor loads back. */
export async function loadRelationTargets(params: {
  sourceType: string;
  sourceId: string;
  targetType: string;
  relationType: string;
}): Promise<string[]> {
  const rows = await db.contentRelation.findMany({
    where: params,
    orderBy: { sortOrder: "asc" },
    select: { targetId: true },
  });
  return rows.map((r) => r.targetId);
}

/**
 * A tool's related strip (ADR-086 #4). Unlike a course's, it is MIXED-TYPE:
 * lessons, articles, glossary terms, videos and courses in one ordered list.
 */
export const TOOL = "tool";

/** One related item, carrying the type that says which table to read. */
export interface MixedRelation {
  targetType: string;
  targetId: string;
}

/**
 * Full replacement of a MIXED-TYPE relation set, ordered by array position.
 *
 * `replaceRelations` above is per-`targetType`, which is right for a course's
 * recommendations and wrong here: a tool's list interleaves types, and running
 * the per-type helper once per type would restart `sortOrder` at zero for each
 * one — so a list of [lesson, article, lesson] would come back as
 * [lesson, lesson, article]. `ContentRelation` already stores `targetType` per
 * ROW, so the only thing that had to change is that the order is taken across
 * the whole list rather than within a slice of it.
 */
export async function replaceMixedRelations(
  tx: Prisma.TransactionClient,
  params: {
    sourceType: string;
    sourceId: string;
    relationType: string;
    targets: readonly MixedRelation[];
  },
): Promise<void> {
  const { sourceType, sourceId, relationType } = params;

  // Deduplicated on the PAIR, not on the id: a lesson and an article may share
  // an id across tables, and collapsing them would silently drop one.
  const seen = new Set<string>();
  const targets = params.targets.filter((target) => {
    if (target.targetType === sourceType && target.targetId === sourceId) return false;
    const key = `${target.targetType}:${target.targetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await tx.contentRelation.deleteMany({ where: { sourceType, sourceId, relationType } });
  if (targets.length === 0) return;

  await tx.contentRelation.createMany({
    data: targets.map((target, index) => ({
      sourceType,
      sourceId,
      targetType: target.targetType,
      targetId: target.targetId,
      relationType,
      // Across the whole list — the point of this helper.
      sortOrder: index,
    })),
  });
}

/** The ordered mixed set — what the editor loads back and the strip renders. */
export async function loadMixedRelationTargets(params: {
  sourceType: string;
  sourceId: string;
  relationType: string;
}): Promise<MixedRelation[]> {
  const rows = await db.contentRelation.findMany({
    where: params,
    orderBy: { sortOrder: "asc" },
    select: { targetType: true, targetId: true },
  });
  return rows.map((row) => ({ targetType: row.targetType, targetId: row.targetId }));
}
