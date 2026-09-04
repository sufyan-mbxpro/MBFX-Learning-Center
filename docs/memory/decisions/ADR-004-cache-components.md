# ADR-004: Cache Components (`"use cache"`), not `unstable_cache`

**Status:** Accepted
**Date:** 2026-09-01
**Module:** 03 (`@repo/rbac`) — first module to need on-demand, tagged
server-side caching; applies equally to Module 02 (`@repo/theme`) and every
later module that reads `.claude/rules/architecture.md` #11's frozen tag
names (`theme`, `settings:{group}`, `navigation`, `rbac:{userId}`).
**Supersedes:** —
**Superseded by:** —

## Context

plan.md A2 flagged this during the Next 15→16 migration review: the uploaded
reference code (`theme-engine.ts`, `rbac.ts`) uses `unstable_cache` from
`next/cache`, which still runs under Next 16 but is the legacy path — Cache
Components (`"use cache"` + `cacheTag()`/`cacheLife()`, invalidated with
`revalidateTag()`/`updateTag()`) is the documented, supported direction. A2's
decision was to adopt `"use cache"` and write this ADR "so nobody 'helpfully'
reintroduces `unstable_cache`," deferred until a module actually needed it.

Read against the _installed_ Next 16.3.3 docs
(`node_modules/next/dist/docs/01-app/`), not training data, per `claude.md`'s
own instruction — two things there don't match what a pre-16 mental model
would assume:

1. **`revalidateTag` gained a mandatory second argument.** `revalidateTag(tag,
profile)` — the old one-argument call is deprecated (works with errors
   suppressed, may be removed later). `profile="max"` gives
   stale-while-revalidate; `{ expire: 0 }` forces immediate invalidation with
   no stale window, for when the caller needs data gone now but isn't in a
   Server Action (where `updateTag` would be the alternative).
2. **`"use cache"` is a compiler transform, not a runtime primitive — and
   `cacheTag()`/`cacheLife()` fail loud, not silent, without it.** The
   directive string only does something when Next's own SWC/Turbopack
   pipeline processes the file, so under plain Vitest (no Next compiler in
   the loop) it's inert. Corrected after an initial wrong guess: this does
   **not** mean `cacheTag()`/`cacheLife()` become harmless no-ops — verified
   directly against `next@16.3.3`, calling either **throws** ("`cacheTag()`
   is only available with the `cacheComponents` config") rather than
   silently doing nothing. Consequence for tests, not just implementation: a
   function marked `"use cache"` can't be meaningfully unit-tested for its
   _caching_ behavior by Vitest alone, **and any test that exercises a code
   path calling into it must mock `next/cache`'s `cacheTag`/`cacheLife`** (a
   no-op stub) or the test fails on the throw, not on the business logic
   being tested. Tests exercise the underlying data function directly
   (renamed/exported without the directive) wherever that's the more direct
   option, and prove the invalidation _tag_ is computed correctly and the
   data changes when it should; whether Next.js actually serves a cached vs.
   fresh response is an E2E/integration concern against the real dev/build
   server (Module 08's own required test — "admin reorders a menu item →
   public header reflects it... the demo that proves the whole
   architecture" — already treats it
   that way).
3. **React's `cache()` has the same testability shape, empirically
   confirmed** (not documented behavior, checked directly against
   `react@19.2.8`): called twice outside an active render/cache boundary, it
   invokes the underlying function both times — no throw, no memoization, a
   plain passthrough. Consistent with the point above: nothing about either
   primitive breaks a Vitest run, but neither actually caches there either,
   so a test exercising a `cache()`-wrapped function under Vitest is
   correctness-testing the underlying logic, not proving the memoization
   works.

## Decision

- `unstable_cache` is banned repo-wide (already stated in
  architecture.md #11; this ADR is the "why," not a new rule).
- Cross-request, tagged reads use a plain `"use cache"` function:
  `cacheTag(...)` and `cacheLife(...)` called directly inside the cached
  function's own body (not factored into a shared helper — Next's own
  guidance: keep cache behavior explicit at the call site; a shared wrapper
  makes lifetimes and nested-cache propagation harder to reason about).
- Per-render dedup within a single request (distinct problem — twelve
  `<Can>` calls on one page becoming one query) still uses React's `cache()`
  wrapping the `"use cache"`-marked function, exactly as the reference code
  already did with `unstable_cache` — only the inner primitive changes.
- Invalidation: `revalidateTag(tag, { expire: 0 })` from a general-purpose
  library function that doesn't know whether its caller is a Server Action or
  a Route Handler (`invalidateSubject`, and equivalent theme/settings
  invalidators) — broader callable surface than `updateTag` (Server Actions
  only) with the same "no stale window" guarantee, which security-sensitive
  invalidation (a just-revoked permission) requires. A call site that is
  _known_ to run only inside a Server Action may use `updateTag(tag)`
  instead where that reads more directly.
- Frozen tag names carry over unchanged: `theme`, `settings:{group}`,
  `navigation`, `rbac:{userId}`.
- Session reads that need `cookies()`/`headers()` (Module 04's `auth()`) are
  Module 04's concern, not this ADR's — `"use cache: private"` is the
  documented tool for that (browser-only, per-session cache) if Module 04
  needs it, but `@repo/rbac`'s own cached functions take a plain `userId`
  argument and never read the request themselves, so they stay on the plain
  `"use cache"` path.

## Consequences

- Every package using this needs `cacheComponents: true` set in
  `apps/web/next.config.ts` (Module 00/07 territory) for the directive to do
  anything in the real app — packages themselves ship the directive, the app
  opts into the feature.
- Test suites for `"use cache"`-marked functions test the unwrapped data
  function, not the cache wrapper, and say so in a comment at the call site
  — otherwise a future reader reasonably expects a passing "cache
  invalidation" unit test to prove the cache actually invalidated, which it
  structurally cannot outside Next's compiler.
- `revalidateTag`'s new required second argument means every existing
  one-argument call in the reference files needs updating during the port,
  not a mechanical find-replace of `unstable_cache` → `"use cache"` alone.

## Alternatives considered

- **Keep `unstable_cache`.** Rejected: it's the explicitly legacy path per
  Next's own docs, and plan.md A2 already decided against it before any code
  existed.
- **`updateTag` everywhere for invalidation.** Rejected as the default:
  restricts every invalidator to Server-Action-only callers, which isn't
  true for `@repo/rbac`/`@repo/theme` as shared libraries. Used at specific
  call sites known to be Server Actions where it reads more directly.

## Compliance

- `no-restricted-imports` (or equivalent) on `unstable_cache` from
  `next/cache` — enforced in `tooling/eslint-config`, added when the first
  package using this ADR lands (this one).
- Tag names are load-bearing API, documented in architecture.md #12 already;
  a grep for the frozen tag strings is part of each module's review.
