"use server";

// Module 16 Phase 3 PR 3.3 — the composer's own actions. Same gate order as
// every other admin action (security.md): requirePermission FIRST LINE,
// then @repo/contracts parse, then the @repo/core service.
import {
  createLayoutTemplate,
  createStylePreset,
  discardDraft,
  DraftConflictError,
  listLayoutTemplates,
  listStylePresets,
  listVersions,
  loadDraftForEditing,
  restoreVersionAsDraft,
  runPublishGates,
  saveDraft,
  type DraftForEditing,
  type PageVersionRow,
  type PublishGateResult,
} from "@repo/core";
import {
  createLayoutTemplateSchema,
  createStylePresetSchema,
  layoutTreeSchema,
  saveDraftSchema,
  type CreateLayoutTemplateInput,
  type CreateStylePresetInput,
  type LayoutTree,
} from "@repo/contracts";
import { requirePermission } from "@repo/rbac";

export async function loadDraftForBuilderAction(pageId: string): Promise<DraftForEditing | null> {
  await requirePermission("cms.pages.view");
  return loadDraftForEditing(pageId);
}

export type SaveDraftResult =
  | { ok: true; revision: number }
  | { ok: false; kind: "conflict"; currentRevision: number }
  | { ok: false; kind: "error"; message: string };

/**
 * A discriminated result instead of letting `DraftConflictError` throw
 * across the server-action boundary — the composer needs `currentRevision`
 * specifically to decide "reload latest," not just a toast message.
 */
export async function saveDraftAction(
  pageId: string,
  layout: LayoutTree,
  baseRevision: number,
): Promise<SaveDraftResult> {
  const actor = await requirePermission("cms.pages.update");
  try {
    const result = await saveDraft(actor, pageId, saveDraftSchema.parse({ layout, baseRevision }));
    return { ok: true, revision: result.revision };
  } catch (error) {
    if (error instanceof DraftConflictError) {
      return { ok: false, kind: "conflict", currentRevision: error.currentRevision };
    }
    return {
      ok: false,
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Read-only: the composer calls this after every autosave to show gate
 * issues inline (plan §8 "gates run on autosave"). PR 3.3 wired the hook
 * against Phase 1's schema-only gate; PR 3.4 grew `runPublishGates` into
 * the full check list (`packages/core/src/cms/gates.ts`) — nothing here
 * changed, the shape was already `{errors, warnings}`.
 */
export async function checkDraftGatesAction(layout: LayoutTree): Promise<PublishGateResult> {
  await requirePermission("cms.pages.view");
  return runPublishGates(layoutTreeSchema.parse(layout));
}

export async function listStylePresetsAction() {
  await requirePermission("cms.pages.view");
  return listStylePresets();
}

export async function createStylePresetFromNodeAction(
  input: CreateStylePresetInput,
): Promise<string> {
  const actor = await requirePermission("cms.styles.manage");
  return createStylePreset(actor, createStylePresetSchema.parse(input));
}

export async function listSectionTemplatesAction() {
  await requirePermission("cms.pages.view");
  const [sections, blocks] = await Promise.all([
    listLayoutTemplates("SECTION"),
    listLayoutTemplates("BLOCK"),
  ]);
  return [...sections, ...blocks];
}

export async function createLayoutTemplateFromNodeAction(
  input: CreateLayoutTemplateInput,
): Promise<string> {
  const actor = await requirePermission("cms.templates.manage");
  return createLayoutTemplate(actor, createLayoutTemplateSchema.parse(input));
}

// ─── PR 3.5: Versions panel ────────────────────────────────────

export async function listVersionsAction(pageId: string): Promise<PageVersionRow[]> {
  await requirePermission("cms.pages.view");
  return listVersions(pageId);
}

export async function restoreVersionAsDraftAction(
  pageId: string,
  versionNumber: number,
): Promise<void> {
  const actor = await requirePermission("cms.pages.update");
  await restoreVersionAsDraft(actor, pageId, versionNumber);
}

export async function discardDraftAction(pageId: string): Promise<void> {
  const actor = await requirePermission("cms.pages.update");
  await discardDraft(actor, pageId);
}
