// Staff impersonation — "Login as user" on the admin user page (ADR-142 §3).
//
// Better Auth's admin plugin ships an impersonation endpoint, and it is the
// wrong door for this project: it authorises against the plugin's own
// `user.role` string, which nothing here writes (permissions live in
// @repo/rbac, ADR-001), so it refuses everyone — and opening it would mean
// granting that role, which opens every other `/admin/*` Better Auth endpoint
// with it. So the mechanism is the plugin's, and the DOOR is ours:
//
// - **Start is SERVER_ONLY.** better-call's router skips an endpoint whose
//   metadata says so, so `/staff-impersonation/start` has no HTTP route at
//   all. The only caller is `startImpersonation()` below, and the only caller
//   of THAT is the admin server action, which has already run
//   `requirePermission("users.impersonate")` (security.md #1) and written the
//   audit row. @repo/auth cannot run that check itself — rbac depends on auth.
// - **Only a learner, never staff.** Checked here as well as in the action, on
//   the freshly loaded row, so a staff account cannot be entered by any
//   caller: impersonating staff is a privilege escalation, not support work.
// - **Cookies are Better Auth's own format.** The staff session token moves
//   into the signed `admin_session` cookie exactly as the plugin's endpoint
//   stores it, and the target's session is a real, database-backed, revocable
//   row carrying `impersonatedBy`, capped at one hour.
// - **Stop is ours too, and audited.** `/staff-impersonation/stop` is an
//   ordinary POST (the learner-side banner calls it) that restores the staff
//   session, deletes the impersonation row, and writes the stop audit row that
//   security.md #5 requires. The plugin's own `/admin/stop-impersonating` is
//   switched off in `disabledPaths`, so there is no unaudited way out.
import { cookies, headers } from "next/headers";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import {
  deleteSessionCookie,
  expireCookie,
  parseSetCookieHeader,
  setSessionCookie,
  toCookieOptions,
} from "better-auth/cookies";
import { impersonateUserSchema } from "@repo/contracts";
import { db } from "@repo/db";

/** One hour, the admin plugin's own default. */
export const IMPERSONATION_SESSION_SECONDS = 60 * 60;

const ADMIN_SESSION_COOKIE = "admin_session";

/**
 * Whether a user row may be entered at all. Pure, so the rule is unit-tested
 * where it lives: a live learner only.
 */
export function canBeImpersonated(target: {
  userType: string;
  deletedAt: Date | null;
  status: string;
}): boolean {
  return (
    target.userType === "LEARNER" && target.deletedAt === null && target.status !== "SUSPENDED"
  );
}

export const staffImpersonation = () =>
  ({
    id: "staff-impersonation",
    endpoints: {
      startStaffImpersonation: createAuthEndpoint(
        "/staff-impersonation/start",
        {
          method: "POST",
          body: impersonateUserSchema,
          use: [sessionMiddleware],
          metadata: { SERVER_ONLY: true },
        },
        async (ctx) => {
          const actor = ctx.context.session;
          if ((actor.user as { userType?: unknown }).userType !== "STAFF") {
            throw APIError.fromStatus("FORBIDDEN");
          }
          // Already inside someone else's session: a second hop would lose the
          // staff token the first hop parked.
          if ((actor.session as { impersonatedBy?: unknown }).impersonatedBy) {
            throw APIError.fromStatus("BAD_REQUEST");
          }

          const target = await db.user.findUnique({
            where: { id: ctx.body.userId },
            select: { id: true, userType: true, deletedAt: true, status: true },
          });
          if (!target || !canBeImpersonated(target)) throw APIError.fromStatus("NOT_FOUND");
          const targetUser = await ctx.context.internalAdapter.findUserById(target.id);
          if (!targetUser) throw APIError.fromStatus("NOT_FOUND");

          const session = await ctx.context.internalAdapter.createSession(
            targetUser.id,
            true,
            {
              impersonatedBy: actor.user.id,
              expiresAt: new Date(Date.now() + IMPERSONATION_SESSION_SECONDS * 1000),
            },
            true,
          );
          if (!session) throw APIError.fromStatus("INTERNAL_SERVER_ERROR");

          const authCookies = ctx.context.authCookies;
          deleteSessionCookie(ctx);
          const dontRemember = await ctx.getSignedCookie(
            authCookies.dontRememberToken.name,
            ctx.context.secret,
          );
          await ctx.setSignedCookie(
            ctx.context.createAuthCookie(ADMIN_SESSION_COOKIE).name,
            `${actor.session.token}:${dontRemember || ""}`,
            ctx.context.secret,
            authCookies.sessionToken.attributes,
          );
          // `dontRememberMe`: the impersonation cookie dies with the browser
          // session as well as with the one-hour row.
          await setSessionCookie(ctx, { session, user: targetUser }, true);
          return ctx.json({ ok: true });
        },
      ),

      stopStaffImpersonation: createAuthEndpoint(
        "/staff-impersonation/stop",
        { method: "POST", requireHeaders: true, use: [sessionMiddleware] },
        async (ctx) => {
          const current = ctx.context.session;
          const staffId = (current.session as { impersonatedBy?: string | null }).impersonatedBy;
          if (!staffId) throw APIError.fromStatus("BAD_REQUEST");

          const adminCookie = ctx.context.createAuthCookie(ADMIN_SESSION_COOKIE);
          const parked = await ctx.getSignedCookie(adminCookie.name, ctx.context.secret);
          const [staffToken, dontRemember] = (typeof parked === "string" ? parked : "").split(":");

          // End the impersonation first, whatever happens next: a stop that
          // cannot restore the staff session must still not leave the
          // learner's session open under staff hands.
          await ctx.context.internalAdapter.deleteSession(current.session.token);
          await db.auditLog.create({
            data: {
              userId: staffId,
              action: "users.impersonateStop",
              entityType: "user",
              entityId: current.user.id,
            },
          });

          const staffSession = staffToken
            ? await ctx.context.internalAdapter.findSession(staffToken)
            : null;
          if (!staffSession || staffSession.session.userId !== staffId) {
            deleteSessionCookie(ctx);
            expireCookie(ctx, adminCookie);
            return ctx.json({ restored: false });
          }
          await setSessionCookie(ctx, staffSession, !!dontRemember);
          expireCookie(ctx, adminCookie);
          // The impersonation set `dont_remember`; a staff session that did
          // not have it must not inherit it, or it would stop extending.
          if (!dontRemember) expireCookie(ctx, ctx.context.authCookies.dontRememberToken);
          return ctx.json({ restored: true });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;

/**
 * Begin an impersonation from a server action. The CALLER owns authorisation
 * and the start audit row; this only swaps the cookies.
 *
 * `auth.api` returns its Set-Cookie lines instead of sending them when called
 * in-process, so they are copied onto Next's cookie store here — the same
 * translation Better Auth's own `nextCookies()` plugin performs, done at the
 * one call site that needs it rather than on every server-side API call.
 */
export async function startImpersonation(api: unknown, userId: string): Promise<{ ok: boolean }> {
  const start = (
    api as {
      startStaffImpersonation: (input: {
        body: { userId: string };
        headers: Headers;
        returnHeaders: true;
      }) => Promise<{ headers: Headers }>;
    }
  ).startStaffImpersonation;
  try {
    const result = await start({ body: { userId }, headers: await headers(), returnHeaders: true });
    const setCookie = result.headers.get("set-cookie");
    if (!setCookie) return { ok: false };
    const jar = await cookies();
    parseSetCookieHeader(setCookie).forEach((value, name) => {
      if (name) jar.set(name, value.value, toCookieOptions(value));
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
