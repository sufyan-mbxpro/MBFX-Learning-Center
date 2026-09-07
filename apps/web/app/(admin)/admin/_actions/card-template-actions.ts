"use server";

import { createCardTemplate, deleteCardTemplate, updateCardTemplate } from "@repo/core";
import {
  createCardTemplateSchema,
  updateCardTemplateSchema,
  type CreateCardTemplateInput,
  type UpdateCardTemplateInput,
} from "@repo/contracts";
import { requirePermission } from "@repo/rbac";

export async function createCardTemplateAction(input: CreateCardTemplateInput): Promise<string> {
  const actor = await requirePermission("cms.cards.manage");
  return createCardTemplate(actor, createCardTemplateSchema.parse(input));
}

export async function updateCardTemplateAction(
  id: string,
  input: UpdateCardTemplateInput,
): Promise<void> {
  const actor = await requirePermission("cms.cards.manage");
  await updateCardTemplate(actor, id, updateCardTemplateSchema.parse(input));
}

export async function deleteCardTemplateAction(id: string): Promise<void> {
  const actor = await requirePermission("cms.cards.manage");
  await deleteCardTemplate(actor, id);
}
