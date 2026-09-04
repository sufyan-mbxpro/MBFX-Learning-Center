"use server";

// Self-service profile actions (changes-01 profile page). Session-scoped
// by construction: the subject id comes from the verified session, never
// from input — there is no way to address another user's row from here.
// Password changes go through Better Auth (current-password verification,
// other sessions revoked) rather than any admin path.
import { changeOwnPassword } from "@repo/auth";
import { changeOwnPasswordSchema, updateOwnProfileSchema } from "@repo/contracts";
import { recordAudit, updateOwnProfile } from "@repo/core";
import { requireStaffSubject } from "./staff-subject.ts";

export async function updateOwnProfileAction(input: unknown): Promise<void> {
  const subject = await requireStaffSubject();
  const parsed = updateOwnProfileSchema.parse(input);
  await updateOwnProfile(subject.id, parsed);
}

export async function changeOwnPasswordAction(input: unknown): Promise<void> {
  const subject = await requireStaffSubject();
  const parsed = changeOwnPasswordSchema.parse(input);
  await changeOwnPassword(parsed);
  await recordAudit({
    userId: subject.id,
    action: "users.passwordChange",
    entityType: "user",
    entityId: subject.id,
  });
}
