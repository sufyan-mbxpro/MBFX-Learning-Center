"use server";

import { createStylePreset, deleteStylePreset, updateStylePreset } from "@repo/core";
import {
  createStylePresetSchema,
  updateStylePresetSchema,
  type CreateStylePresetInput,
  type UpdateStylePresetInput,
} from "@repo/contracts";
import { requirePermission } from "@repo/rbac";

export async function createStylePresetAction(input: CreateStylePresetInput): Promise<string> {
  const actor = await requirePermission("cms.styles.manage");
  return createStylePreset(actor, createStylePresetSchema.parse(input));
}

export async function updateStylePresetAction(
  id: string,
  input: UpdateStylePresetInput,
): Promise<void> {
  const actor = await requirePermission("cms.styles.manage");
  await updateStylePreset(actor, id, updateStylePresetSchema.parse(input));
}

export async function deleteStylePresetAction(id: string): Promise<void> {
  const actor = await requirePermission("cms.styles.manage");
  await deleteStylePreset(actor, id);
}
