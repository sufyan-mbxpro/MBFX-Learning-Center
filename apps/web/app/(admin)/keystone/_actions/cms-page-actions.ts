"use server";

// Module 16 Phase 1 page actions. Gate order per security.md:
// requirePermission FIRST LINE, then @repo/contracts parse, then the
// @repo/core/cms service (which re-checks with `can()` — defense in
// depth, and what makes "denied at the DB level" true even if an action
// were ever called directly).
import {
  createPage,
  duplicatePage,
  loadPageDetail,
  previewPagePath,
  publishPage,
  rollbackPage,
  savePageTranslation,
  setPageDeleted,
  unpublishPage,
  updatePageMeta,
} from "@repo/core";
import {
  createPageSchema,
  publishPageSchema,
  rollbackPageSchema,
  savePageTranslationSchema,
  updatePageMetaSchema,
  type CreatePageInput,
  type PublishPageInput,
  type RollbackPageInput,
  type SavePageTranslationInput,
  type UpdatePageMetaInput,
} from "@repo/contracts";
import { requirePermission } from "@repo/rbac";

export async function createPageAction(input: CreatePageInput): Promise<string> {
  const actor = await requirePermission("cms.pages.create");
  return createPage(actor, createPageSchema.parse(input));
}

export async function updatePageMetaAction(
  pageId: string,
  input: UpdatePageMetaInput,
): Promise<void> {
  const actor = await requirePermission("cms.pages.update");
  await updatePageMeta(actor, pageId, updatePageMetaSchema.parse(input));
}

export async function savePageTranslationAction(
  pageId: string,
  input: SavePageTranslationInput,
): Promise<void> {
  const actor = await requirePermission("cms.pages.update");
  await savePageTranslation(actor, pageId, savePageTranslationSchema.parse(input));
}

export async function duplicatePageAction(pageId: string): Promise<string> {
  const actor = await requirePermission("cms.pages.create");
  return duplicatePage(actor, pageId);
}

export async function setPageDeletedAction(pageId: string, deleted: boolean): Promise<void> {
  const actor = await requirePermission("cms.pages.delete");
  await setPageDeleted(actor, pageId, deleted);
}

export async function publishPageAction(pageId: string, input: PublishPageInput): Promise<number> {
  const actor = await requirePermission("cms.pages.publish");
  return publishPage(actor, pageId, publishPageSchema.parse(input));
}

export async function unpublishPageAction(pageId: string): Promise<void> {
  const actor = await requirePermission("cms.pages.publish");
  await unpublishPage(actor, pageId);
}

export async function rollbackPageAction(pageId: string, input: RollbackPageInput): Promise<void> {
  const actor = await requirePermission("cms.pages.publish");
  await rollbackPage(actor, pageId, rollbackPageSchema.parse(input).versionNumber);
}

/** Read action: recomputes what the live path preview should show as the admin types — never writes. Gated on view, not update, so it can run on every keystroke without a heavier check. */
export async function previewPagePathAction(
  pageId: string,
  locale: string,
  slug: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  await requirePermission("cms.pages.view");
  return previewPagePath({ pageId, locale, slug });
}

export async function loadPageDetailAction(pageId: string) {
  await requirePermission("cms.pages.view");
  return loadPageDetail(pageId);
}
