# ADR-001: Adopt Better Auth (not the Auth.js v5 fallback)

**Status:** Accepted
**Date:** 2026-09-01
**Module:** 00/01 prerequisite — spiked ahead of Module 04 because Module 01's
auth tables (`User`/`Account`/`Session`/`Verification`) are gated on this
decision (plan.md kickoff sequence).
**Supersedes:** —
**Superseded by:** —

## Context

plan.md A3 proposed replacing Auth.js v5 with Better Auth (database sessions
with revocation, Argon2id via a custom hasher, admin/2FA plugins, Redis-backed
rate limiting) but left it contingent on a 2-day-timeboxed spike: "if a hard
blocker appears in week 1 (e.g. an adapter gap with MariaDB), Auth.js v5
remains a viable... fallback."

The spike ran against the project's real target stack — the local Docker
MariaDB 11.4 + Redis 7 containers, Prisma 7.10.x pinned by ADR-002, MariaDB
via `@prisma/adapter-mariadb` — using a disposable `better_auth_spike`
database (dropped after the spike; not the project's `mbfx_learning_center`
database). Versions installed: `better-auth@1.7.2` (npm `latest` at spike
time), `@better-auth/prisma-adapter@1.7.2`, `@node-rs/argon2@2.2.0`.

## Decision

**Adopt Better Auth 1.7.x.** No MariaDB adapter gap was found — every issue
below has a known, one-line/one-flag fix, not a fundamental incompatibility.
Module 04 implements auth on this stack; the fallback is not invoked.

Verified end-to-end against live MariaDB + Redis containers:

- `@prisma/adapter-mariadb` + `better-auth generate`'s schema apply cleanly to
  MariaDB (`prisma db push` succeeds).
- Argon2id hashing via `@node-rs/argon2`, wired through
  `emailAndPassword.password.hash/verify`, overrides Better Auth's scrypt
  default — verified the stored `Account.password` has an `$argon2id$` prefix.
- Database-backed session revocation: sign up → sign in → session row exists
  in MariaDB → `revokeSession` → next `getSession` returns `null`
  **immediately** and the MariaDB row is deleted, not just the Redis cache
  entry.
- Redis-backed rate limiting (`secondaryStorage`, `rateLimit.storage:
"secondary-storage"`) engages at the HTTP layer: sign-in requests routed
  through `auth.handler(request)` return `429` on the 4th rapid attempt,
  matching Better Auth's built-in default rule for `/sign-in*` (3 req / 10s).
- `admin`, `two-factor`, and `bearer` plugins load and generate their tables
  (`twoFactor`) without runtime errors.

## Consequences

Four real findings from the spike, each with a required mitigation for
Module 04 to carry forward:

1. **`secondaryStorage` silently moves sessions out of the database by
   default.** Configuring `secondaryStorage` (needed for Redis-backed rate
   limiting) makes Better Auth store sessions **only** in Redis unless
   `session.storeSessionInDatabase: true` is also set — reads always come
   from secondary storage regardless. This directly conflicts with
   security.md #11 ("sessions are database-backed, revocable"). **Mitigation:
   `session.storeSessionInDatabase: true` is mandatory in Module 04's auth
   config** — confirmed in the spike to restore the MariaDB `Session` row
   without breaking Redis-cached reads.
2. **`better-auth generate` (CLI, v1.7.2) omits a required `Account.issuer`
   column.** Better Auth's 1.7 line scopes account identity by `issuer`
   (Better Auth's own upgrade guide: "account identity is scoped by issuer");
   the runtime `internal-adapter` writes and queries it, but the bundled
   Prisma schema generator doesn't emit it, so a plain `generate` output
   fails on the first sign-up (`Unknown argument issuer`). Not MariaDB-specific
   — reproduces against any Prisma target, so it does not trigger the
   Auth.js v5 fallback clause (that was scoped to a MariaDB adapter gap).
   **Mitigation: Module 04 must hand-add `issuer String @db.VarChar(255)` to
   the generated `Account` model after every `better-auth generate` run**
   (a compound index on `(issuer, accountId)` is worth adding too — the
   runtime queries by that pair). Document this as a standing post-generate
   step, not a one-time fix, since regenerating overwrites it.
3. **`@better-auth/cli` is dead weight.** npm flags it deprecated
   ("Package no longer supported"); the `better-auth` package now ships the
   same CLI itself (`node_modules/.bin/better-auth generate`, `migrate`,
   etc.). **Do not add `@better-auth/cli` to `packages/auth`'s
   dependencies** — `stack.md`'s "Better Auth exact pin" follow-up should
   list only `better-auth` and `@better-auth/prisma-adapter`.
4. **Rate limiting only runs on the HTTP path, not on direct `auth.api.*()`
   calls.** `onRequestRateLimit` is wired into `auth.handler(request)`;
   calling `auth.api.signInEmail(...)` directly from server-side code (no
   `Request`) bypasses it entirely — confirmed by 15 direct calls producing
   zero 429s where the same sequence through `auth.handler` tripped on
   attempt 4. **Mitigation: Module 04's sign-in/sign-up/password-reset flows
   in `apps/web` must go through the mounted `/api/auth/[...all]` handler**
   (client SDK or a fetch to that route), not call `auth.api` directly from a
   server action for anything rate-limit-sensitive. Purely internal calls
   (e.g. an admin action creating a user) are fine to call `auth.api`
   directly since they're already behind `requirePermission()`.

Costs accepted:

- Every `better-auth generate` re-run needs the manual `issuer` patch
  reapplied (finding #2) until upstream fixes the generator — a real,
  recurring maintenance cost, tracked here rather than rediscovered.
- The default sign-in rate-limit rule (3 req / 10s) is aggressive; Module 04
  should evaluate via `rateLimit.customRules` rather than assuming the
  built-in default is the final answer for production UX.

## Alternatives considered

- **Auth.js v5 fallback.** Rejected: the spike's stated trigger condition
  ("an adapter gap with MariaDB") did not occur — the one schema-generation
  bug found is Prisma-target-agnostic and has a one-line workaround. Auth.js
  receives security patches only (A3's original rationale for leaving it)
  and would forgo the admin/2FA/bearer plugins this project's requirements
  call for.
- **Skip `secondaryStorage`, keep rate limiting on `"database"` storage.**
  Considered to sidestep finding #1 entirely. Rejected: A3/security.md #13
  specifically calls for Redis-backed rate limiting, and the `rateLimit`
  table's window/count churn is exactly the write pattern MariaDB shouldn't
  absorb at request volume — Redis is the right store for it. Fixing forward
  with `storeSessionInDatabase: true` costs one config line.

## Compliance

- Module 04's `packages/auth` config must set both
  `session.storeSessionInDatabase: true` and
  `rateLimit: { enabled: true, storage: "secondary-storage" }` — a unit test
  asserting both are present in the resolved Better Auth options is part of
  Module 04's required tests (SKILL.md).
- The post-`generate` `issuer` column patch is scripted (not manual), so a
  regenerate can't silently drop it — Module 04 wires this into
  `@repo/db#generate` or a dedicated `auth:generate` script, with a test that
  fails if `Account.issuer` is missing from the checked-in schema.
- Module 04's integration tests (per SKILL.md: signup → verify → lockout →
  reset → **revocation → next request 401 immediately** → impersonation
  audited) exercise the same path this spike validated, against
  Testcontainers MariaDB.
