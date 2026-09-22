// Audit rows for the learner's self-service security changes (ADR-123 #5).
//
// The profile page sends a password change and both two-factor changes
// straight to Better Auth's own HTTP handler — for ADR-001 finding #4's
// reasons: the rate limits live there, and so does the session cookie each of
// those endpoints ROTATES. A server action calling `authInstance.api.*` would
// write the new session row and drop its cookie, signing the learner out of
// the page they were on. So the audit cannot live in an action; it lives here,
// on the two hooks that see the change happen.
//
// The decisions are pure and exported so they are unit-tested where they live;
// the write is one `auditLog.create`, the shape `onPasswordReset` already uses.
import { db } from "@repo/db";

export type AccountAuditAction =
  | "users.twoFactorEnable"
  | "users.twoFactorDisable"
  | "users.passwordChange"
  | "users.emailChange";

/**
 * Which audit row, if any, a write to `user.twoFactorEnabled` means.
 *
 * Keyed on the ENDPOINT as well as the value, because the flag is written in
 * one place per direction: `/two-factor/verify-totp` sets it the first time a
 * code is confirmed (a sign-in challenge never writes the user row, so it
 * cannot be mistaken for an enable), and `/two-factor/disable` clears it.
 * Anything else that happens to touch the user row is not a 2FA change.
 */
export function twoFactorAuditAction(
  path: string | undefined,
  twoFactorEnabled: boolean | null | undefined,
): AccountAuditAction | null {
  if (path === "/two-factor/verify-totp" && twoFactorEnabled === true) {
    return "users.twoFactorEnable";
  }
  if (path === "/two-factor/disable" && twoFactorEnabled === false) {
    return "users.twoFactorDisable";
  }
  return null;
}

/**
 * The user whose password a `/change-password` HTTP request just changed, or
 * null.
 *
 * HTTP only (`request` present): the staff profile calls the same endpoint as
 * a server-side API call and audits and notifies in its own action
 * (`changeOwnPasswordAction`, `changeOwnPassword`), so counting it here too
 * would write every staff change twice. A failure returns an error, not a
 * `user`, and is not a change.
 */
export function passwordChangedBy(ctx: {
  path: string;
  request?: unknown;
  returned: unknown;
}): string | null {
  if (ctx.path !== "/change-password" || ctx.request === undefined) return null;
  const returned = ctx.returned as { user?: { id?: unknown } } | null | undefined;
  const id = returned?.user?.id;
  return typeof id === "string" ? id : null;
}

/**
 * The address change a `/verify-email` request just completed, or null
 * (ADR-155 #2).
 *
 * Better Auth writes the new address in `/verify-email`, and the user row it
 * hands the update hook already carries it — the OLD address survives only in
 * the link's token. The token has been verified by the time the row is
 * written, so its payload is read here, not re-verified. Only the final step
 * of a change (`change-email-verification`) counts; a plain verification
 * carries no `updateTo` and is not a change.
 */
export function emailChangeFromToken(
  path: string | undefined,
  query: unknown,
): { from: string; to: string } | null {
  if (path !== "/verify-email") return null;
  const token = (query as { token?: unknown } | null | undefined)?.token;
  if (typeof token !== "string") return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
      updateTo?: unknown;
      requestType?: unknown;
    };
    if (claims.requestType !== "change-email-verification") return null;
    if (typeof claims.email !== "string" || typeof claims.updateTo !== "string") return null;
    return { from: claims.email, to: claims.updateTo };
  } catch {
    return null;
  }
}

export async function writeAccountAudit(
  userId: string,
  action: AccountAuditAction,
  changes?: { before: Record<string, unknown>; after: Record<string, unknown> },
): Promise<void> {
  await db.auditLog.create({
    data: {
      userId,
      action,
      entityType: "user",
      entityId: userId,
      ...(changes ? { changes: changes as object } : {}),
    },
  });
}
