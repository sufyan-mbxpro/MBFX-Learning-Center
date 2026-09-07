"use server";

import { deleteLayoutTemplate, updateLayoutTemplate } from "@repo/core";
import { updateLayoutTemplateSchema, type UpdateLayoutTemplateInput } from "@repo/contracts";
import { requirePermission } from "@repo/rbac";

// No createLayoutTemplateAction yet: nothing produces a new template
// without the composer's "Save as template" (Phase 3 PR 3.3) — this
// screen is browse/rename/delete until then (plan §12 PR 3.1 scope).

export async function updateLayoutTemplateAction(
  id: string,
  input: UpdateLayoutTemplateInput,
): Promise<void> {
  const actor = await requirePermission("cms.templates.manage");
  await updateLayoutTemplate(actor, id, updateLayoutTemplateSchema.parse(input));
}

export async function deleteLayoutTemplateAction(id: string): Promise<void> {
  const actor = await requirePermission("cms.templates.manage");
  await deleteLayoutTemplate(actor, id);
}
