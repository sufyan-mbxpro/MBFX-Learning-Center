# ADR-079: Password recovery routes by who the user is, not by which screen asked

**Status:** Accepted
**Date:** 2026-09-12
**Module:** 04 (auth), 12 (public site), 09 (admin shell)
**Supersedes:** —
**Extends:** ADR-052 (two sign-in surfaces), ADR-006 (one app, two surfaces)
**Superseded by:** —

## Context

Better Auth 1.7.2 already implements the whole token half of password
recovery: `/request-password-reset` mints a 30-minute token, answers
identically for an unknown address, and even simulates the lookup to blunt
timing attacks. What is missing is delivery (ADR-078) and every screen.

ADR-052 split sign-in across two surfaces: staff at `/admin/sign-in`, the one
`/admin` path the proxy lets through unauthenticated, and learners at
`/[locale]/sign-in`. The public site links to neither `/admin` nor the staff
screen, deliberately. Password recovery has to hold that line: a reset link is
a URL sent by email, so whichever surface mints it decides what the recipient
learns about the system.

Email verification has the same shape — `sendOnSignUp: true` has been minting
tokens into `console.log` since Module 04.

## Decision

1. **Better Auth owns the tokens; this repo owns the screens.** No new token
   table, no hand-rolled expiry. The reset screens POST to
   `/api/auth/reset-password`, so the limiter and lockout apply.
2. **The link is routed by `user.userType`, never by the screen that asked.**
   `sendResetPassword` builds the URL itself:
   - STAFF → `${ADMIN_URL}/admin/reset-password?token=…`
   - everyone else → `${SITE_URL}/<locale>/reset-password?token=…`

   A learner who types their address into the staff screen still receives a
   public link, and the public surface never mentions `/admin` (ADR-052).
   Better Auth's own `/reset-password/:token` GET callback is unused.

3. **The proxy gains an allowlist, not a second exemption.**
   `ADMIN_PUBLIC_PATHS = { /admin/sign-in, /admin/forgot-password,
/admin/reset-password }`. The gate is still a gate: the admin layout's
   STAFF re-check is the boundary (security.md #3).
4. **Enumeration is closed on both channels.** The response is identical for a
   known and an unknown address, and the message says so ("if this email
   exists…"). Sending happens through `advanced.backgroundTasks` → `after()`,
   so a real send cannot make the known case measurably slower.
5. **Two limits, because they stop different attacks** (security.md #13):
   per-IP through Better Auth's `rateLimit.customRules`
   (`/request-password-reset` 3 per 10 min), and per-account through
   `@repo/auth`'s Redis `rateLimit()` (3 per hour per user id), which stops
   one address being mail-bombed from many IPs. Over the per-account limit,
   nothing is sent and the response is unchanged.
6. **A completed reset does four things**, not one:
   `revokeSessionsOnPasswordReset: true` signs every session out;
   `onPasswordReset` clears `failedLoginCount` and `lockedUntil` (a reset is
   how a locked-out user recovers, so leaving the lock would be a trap);
   writes an `auth.passwordReset.self` audit row; and sends
   `auth.password_changed`. The admin-initiated reset (`recordPasswordReset`)
   and a self-service change (`changeOwnPassword`) send the same notice —
   a password changing without the owner hearing about it is the signal worth
   having.
7. **Verification is sent, and never blocks sign-in.**
   `requireEmailVerification` stays `false`. The email goes out on sign-up,
   `afterEmailVerification` keeps setting `status: "ACTIVE"`, and an
   unverified learner is nudged in the header account menu with a resend
   action. A blocking gate would turn a broken mail configuration into a
   total sign-up outage; this way it degrades to a missing nudge.
8. **Every password input is `PasswordInput`** (`@repo/ui`), a single toggle
   implementation rather than one per screen. The admin's generated-password
   dialog keeps its deliberately visible field.

## Enforcement

- `packages/auth/src/auth.integration.test.ts` — a STAFF reset link points at
  `/admin/reset-password`; a LEARNER's contains no `/admin` anywhere; an
  unknown address produces no delivery row and the same response; the
  per-account limit holds; sessions are revoked; the lockout is cleared; the
  notice is sent.
- `apps/web/proxy.test.ts` — the three allowlisted paths are reachable
  anonymously and every other `/admin` path is not.
- `apps/web/app/password-fields.test.ts` — no raw `type="password"` survives.

## Alternatives rejected

- **One reset screen for both surfaces.** It would have to live somewhere,
  and either the public site links to `/admin` or staff reset on the public
  site. ADR-052 already answered this shape.
- **Trusting the screen that asked to choose the link.** An attacker would
  choose it for the victim.
- **`requireEmailVerification: true`.** Stronger on paper; an outage the first
  time SMTP is misconfigured. Revisit when delivery has been stable.
- **A single per-IP limit.** It does not stop a distributed mail-bomb aimed at
  one address.

## Consequences

- An unverified learner keeps full access, so nothing in the product may
  assume `emailVerified` without checking it.
- Because sending is backgrounded, a delivery failure cannot be reported in
  the response the user sees. It surfaces in the delivery log (ADR-078 #10).
- Staff recovery depends on `ADMIN_URL` being correct in the environment; if
  it is wrong, the link is wrong. The same was already true of sign-in
  redirects.
