// Enforced two-factor for STAFF (ADR-157).
//
// When `security.requireStaffTwoFactor` is on, a staff member who has not
// enrolled is held on the enrolment screen (the admin layout) and refused
// every mutation (`@repo/rbac`'s `requirePermission`). Both ask this module.
//
// It is deliberately NOT a change to `auth()`, which is where ADR-105 put the
// idle timeout: returning no session would hide the enrolment screen and the
// sign-out button along with everything else, which turns "set this up" into
// a lockout. Enrolment itself goes to Better Auth's own handler and passes
// through neither check.
import { db } from "@repo/db";
import { getSetting } from "@repo/settings";

/**
 * The whole decision, with no database in it. A learner is never held — the
 * setting is about the portal, and `userType` decides rather than a role, so a
 * grant cannot switch it off (security.md #3).
 */
export function staffTwoFactorPending(
  user: { userType: string; twoFactorEnabled: boolean | null } | null,
  required: boolean,
): boolean {
  if (!required || !user) return false;
  return user.userType === "STAFF" && user.twoFactorEnabled !== true;
}

/**
 * `staffTwoFactorPending` for a user id. The setting is read first and is a
 * cached read, so while enforcement is off this costs nothing further.
 *
 * The user row is read FRESH — not the session's user snapshot and not the
 * rbac `Subject` cache. Both can lag an enrolment Better Auth has just
 * written, and whoever had just finished setting two-factor up would be shown
 * the setup screen again.
 */
export async function isStaffTwoFactorPending(userId: string): Promise<boolean> {
  // A missing row is a database seeded before ADR-157: not enforced, which is
  // also what the development seed writes.
  const required = (await getSetting("security.requireStaffTwoFactor")) === true;
  if (!required) return false;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { userType: true, twoFactorEnabled: true },
  });
  return staffTwoFactorPending(user, required);
}
