"use server";

// News & Analysis actions (Module 15, ADR-015). Gate order per security.md:
// requirePermission/requireAnyPermission FIRST LINE, then contracts parse,
// then the @repo/core service (which enforces the KIND-specific gate —
// news.manage vs analysis.* — and the publish gate against the same
// subject).
import { z } from "zod";
import {
  createArticle,
  createArticleCategory,
  createArticleTag,
  deleteArticleCategory,
  deleteArticleTag,
  duplicateArticle,
  publishDueArticles,
  quickUpdateArticle,
  saveArticle,
  setArticleFeatured,
  saveArticleCategoryTranslation,
  saveArticleTagTranslation,
  saveArticleTranslation,
  setArticleActive,
  setArticleDeleted,
  setArticleTagActive,
  transitionArticle,
  updateArticleCategory,
  updateArticleMeta,
} from "@repo/core";
import {
  createArticleCategorySchema,
  createArticleSchema,
  createArticleTagSchema,
  saveArticleCategoryTranslationSchema,
  saveArticleTagTranslationSchema,
  quickEditArticleSchema,
  saveArticleSchema,
  saveArticleTranslationSchema,
  updateArticleCategorySchema,
  updateArticleMetaSchema,
  type CreateArticleCategoryInput,
  type CreateArticleInput,
  type CreateArticleTagInput,
  type SaveArticleCategoryTranslationInput,
  type QuickEditArticleInput,
  type SaveArticleInput,
  type SaveArticleTagTranslationInput,
  type SaveArticleTranslationInput,
  type UpdateArticleCategoryInput,
  type UpdateArticleMetaInput,
} from "@repo/contracts";
import { requireAnyPermission } from "@repo/rbac";

const id = z.string().min(1);

export async function createArticleAction(input: CreateArticleInput): Promise<string> {
  const subject = await requireAnyPermission(["analysis.create", "news.manage"]);
  return createArticle(subject, createArticleSchema.parse(input));
}

export async function updateArticleMetaAction(
  articleId: string,
  input: UpdateArticleMetaInput,
): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await updateArticleMeta(subject, id.parse(articleId), updateArticleMetaSchema.parse(input));
}

export async function saveArticleTranslationAction(
  input: SaveArticleTranslationInput,
): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await saveArticleTranslation(subject, saveArticleTranslationSchema.parse(input));
}

export async function transitionArticleAction(
  articleId: string,
  to: string,
  scheduledForIso?: string,
): Promise<void> {
  // Base gate here; publish-specific (analysis.publish / news.manage) is
  // enforced inside the service — content-actions.ts precedent.
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  const status = z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).parse(to);
  const scheduledFor = scheduledForIso ? z.coerce.date().parse(scheduledForIso) : undefined;
  await transitionArticle(subject, id.parse(articleId), status, scheduledFor);
}

/**
 * The editor v2 header save (changes-07). One action, one service call, one
 * transaction — replacing the two independent saves the old editor fired.
 */
export async function saveArticleAction(input: SaveArticleInput): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await saveArticle(subject, saveArticleSchema.parse(input));
}

export async function setArticleFeaturedAction(
  articleId: string,
  isFeatured: boolean,
): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await setArticleFeatured(subject, id.parse(articleId), isFeatured);
}

export async function quickUpdateArticleAction(
  articleId: string,
  input: QuickEditArticleInput,
): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await quickUpdateArticle(subject, id.parse(articleId), quickEditArticleSchema.parse(input));
}

export async function setArticleActiveAction(articleId: string, isActive: boolean): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await setArticleActive(subject, id.parse(articleId), z.boolean().parse(isActive));
}

export async function setArticleDeletedAction(articleId: string, deleted: boolean): Promise<void> {
  const subject = await requireAnyPermission(["analysis.delete", "news.manage"]);
  await setArticleDeleted(subject, id.parse(articleId), z.boolean().parse(deleted));
}

export async function duplicateArticleAction(articleId: string): Promise<string> {
  const subject = await requireAnyPermission(["analysis.create", "news.manage"]);
  return duplicateArticle(subject, id.parse(articleId));
}

/** Manual "run scheduler now" from the articles list (ADR-015 #6). */
export async function publishDueArticlesAction(): Promise<number> {
  await requireAnyPermission(["analysis.publish", "news.manage"]);
  return publishDueArticles();
}

// ─── Categories ──────────────────────────────────────────────

export async function createArticleCategoryAction(
  input: CreateArticleCategoryInput,
): Promise<string> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  return createArticleCategory(subject, createArticleCategorySchema.parse(input));
}

export async function updateArticleCategoryAction(
  categoryId: string,
  input: UpdateArticleCategoryInput,
): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await updateArticleCategory(
    subject,
    id.parse(categoryId),
    updateArticleCategorySchema.parse(input),
  );
}

export async function saveArticleCategoryTranslationAction(
  input: SaveArticleCategoryTranslationInput,
): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await saveArticleCategoryTranslation(subject, saveArticleCategoryTranslationSchema.parse(input));
}

export async function deleteArticleCategoryAction(categoryId: string): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await deleteArticleCategory(subject, id.parse(categoryId));
}

// ─── Tags ────────────────────────────────────────────────────

export async function createArticleTagAction(input: CreateArticleTagInput): Promise<string> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  return createArticleTag(subject, createArticleTagSchema.parse(input));
}

export async function saveArticleTagTranslationAction(
  input: SaveArticleTagTranslationInput,
): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await saveArticleTagTranslation(subject, saveArticleTagTranslationSchema.parse(input));
}

export async function setArticleTagActiveAction(tagId: string, isActive: boolean): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await setArticleTagActive(subject, id.parse(tagId), z.boolean().parse(isActive));
}

export async function deleteArticleTagAction(tagId: string): Promise<void> {
  const subject = await requireAnyPermission(["analysis.update", "news.manage"]);
  await deleteArticleTag(subject, id.parse(tagId));
}
