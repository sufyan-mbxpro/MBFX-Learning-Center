# SKILL — Module 04: @repo/auth (Better Auth)

plan.md A3 + Module 04. ADR-001 written after the 2-day spike (MariaDB
adapter, Argon2id hasher, admin/2FA plugins). Fallback: Auth.js v5,
swap contained to this package.

## Configuration requirements

- Better Auth + Prisma adapter (MariaDB). Schema via
  `npx @better-auth/cli generate`, then project fields merged as
  `additionalFields` (userType, status, locale, timezone, themeMode, lockout
  fields, deletedAt) — merged models handed to Module 01.
- **Argon2id** via custom `password.hash/verify` using `@node-rs/argon2`
  (Better Auth defaults to scrypt — override stands).
- OAuth: Google + GitHub. Email verification required to comment/access
  premium, not to read. Password reset: single-use, 30-min expiry.
- **Database sessions with revocation** — "log this user out now" must work.
- Rate limiting via Redis secondary storage: per-IP + per-account on
  sign-in/up/reset, exponential backoff lockout (never hard lock).
- Plugins: admin (ban/revoke/impersonate behind `users.impersonate`),
  two-factor (gives mfaEnabled/mfaSecret an implementation), bearer/JWT
  (configured, unrouted — future mobile).
- `auth()` session helper exposed with the call shape `@repo/rbac` expects.

## Two credential surfaces (ADR-052 — read it before touching either)

- **Staff:** `/admin/sign-in`, rendered from the `(admin-auth)` route group
  (its own root layout — it CANNOT live in `(admin)`, whose root layout is
  the STAFF re-check and would redirect the page to itself). It is the one
  `/admin` path `proxy.ts` lets through unauthenticated, and every gate
  redirect points at it.
- **Learners:** `/[locale]/sign-in` and `/[locale]/sign-up`. The public site
  links to neither `/admin` nor the staff screen — do not add such a link.
- Each form refuses the other's `userType` (signs it back out, shows an
  error). That is **UX, not a boundary**: the proxy gate, the admin layout's
  `loadSubject()` re-check and `requirePermission()` are unchanged and are
  what actually enforce access.
- Every credential call goes to Better Auth's own `/api/auth/*` handler —
  rate limiting, lockout and cookies live there (ADR-001 #4). Do not wrap
  sign-in/sign-up in a server action.
- Shared browser helpers: `apps/web/app/_lib/credentials.ts` (unit-tested).
  `MIN/MAX_PASSWORD_LENGTH` live in `@repo/contracts` so a public screen can
  state the rule without importing this package.

## Single-app consequences (ADR-006 — read it)

Same origin for learner and staff sessions. Mandatory: STAFF gate in
`proxy.ts` for `/admin/*` AND server-side re-check in the admin layout and
services; shorter staff session lifetime; re-auth for sensitive mutations
(role/permission edits, impersonation start). Tokens never in localStorage;
httpOnly cookies only.

## Required tests

Integration (Testcontainers + route-handler harness): signup → verify token
round-trip → ACTIVE; lockout with backoff; reset single-use + expiry;
**revocation → next request 401 immediately**; staff gate asserted through
the proxy AND with the proxy bypassed; impersonation audited. Proxy matcher
unit tests via `next/experimental/testing/server`. E2E: credential +
Google-mock flows on both surfaces.
