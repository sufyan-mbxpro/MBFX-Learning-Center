// Shared guard for SELF-scoped admin actions (profile, notifications,
// search) — flows that have no single permission key but must still be
// STAFF-only and DB-verified (never trust the session snapshot; same
// discipline as the admin layout's re-check). Not a "use server" file —
// it's a helper the action modules import.
import { auth } from "@repo/auth";
import { ForbiddenError, loadSubject, UnauthenticatedError, type Subject } from "@repo/rbac";

export async function requireStaffSubject(): Promise<Subject> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthenticatedError();
  const subject = await loadSubject(session.user.id);
  if (subject?.userType !== "STAFF") throw new ForbiddenError("staff");
  return subject;
}
