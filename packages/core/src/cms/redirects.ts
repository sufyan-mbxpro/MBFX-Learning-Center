// The `Redirect` model exists (ADR-015 #1); only the admin screen and its
// mutations are new. Reuses the seeded `redirects.manage` permission —
// there is no `cms.redirects.manage` (plan §3.2).
import { db } from "@repo/db";
import { can, ForbiddenError, type Subject } from "@repo/rbac";
import type { CreateRedirectInput, SetRedirectActiveInput } from "@repo/contracts";
import { recordAudit } from "../index.ts";

export interface RedirectRow {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
  hitCount: number;
}

export async function listRedirects(): Promise<RedirectRow[]> {
  return db.redirect.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fromPath: true,
      toPath: true,
      statusCode: true,
      isActive: true,
      hitCount: true,
    },
  });
}

export async function createRedirect(actor: Subject, input: CreateRedirectInput): Promise<string> {
  if (!can(actor, "redirects.manage")) throw new ForbiddenError("redirects.manage");

  const row = await db.redirect.create({
    data: {
      fromPath: input.fromPath,
      toPath: input.toPath,
      statusCode: input.statusCode,
      createdBy: actor.id,
    },
  });
  await recordAudit({
    userId: actor.id,
    action: "cms.redirects.create",
    entityType: "redirect",
    entityId: row.id,
    changes: { after: input },
  });
  return row.id;
}

export async function setRedirectActive(
  actor: Subject,
  id: string,
  input: SetRedirectActiveInput,
): Promise<void> {
  if (!can(actor, "redirects.manage")) throw new ForbiddenError("redirects.manage");

  await db.redirect.update({ where: { id }, data: { isActive: input.isActive } });
  await recordAudit({
    userId: actor.id,
    action: "cms.redirects.setActive",
    entityType: "redirect",
    entityId: id,
    changes: { after: input },
  });
}
