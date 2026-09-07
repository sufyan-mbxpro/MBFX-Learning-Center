"use server";

import { createRedirect, setRedirectActive } from "@repo/core";
import {
  createRedirectSchema,
  setRedirectActiveSchema,
  type CreateRedirectInput,
  type SetRedirectActiveInput,
} from "@repo/contracts";
import { requirePermission } from "@repo/rbac";

export async function createRedirectAction(input: CreateRedirectInput): Promise<string> {
  const actor = await requirePermission("redirects.manage");
  return createRedirect(actor, createRedirectSchema.parse(input));
}

export async function setRedirectActiveAction(
  id: string,
  input: SetRedirectActiveInput,
): Promise<void> {
  const actor = await requirePermission("redirects.manage");
  await setRedirectActive(actor, id, setRedirectActiveSchema.parse(input));
}
