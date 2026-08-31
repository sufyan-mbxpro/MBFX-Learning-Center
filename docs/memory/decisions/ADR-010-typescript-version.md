# ADR-010: Pin TypeScript 6.0.3 — do not adopt the TypeScript 7 native compiler yet

**Status:** Accepted
**Date:** 2026-08-31
**Module:** 00 — Repo scaffold & governance
**Supersedes:** —
**Superseded by:** —

## Context

`plan.md` A1 says to bump TypeScript to 5.9.x and treats the Go-native
compiler ("tsgo") as "opt-in, not baseline". The Day-1 registry sweep found the
landscape had moved further than the plan recorded:

- `typescript@latest` is now **7.0.2** — the Go-native rewrite, promoted into
  the mainline `typescript` package (released 8 Jul 2026).
- **6.0.3** is the last release of the classic TypeScript-in-JavaScript
  compiler line.
- 5.9.3 is the end of the 5.x line.

The blocker is not performance or type-checking behavior — it is the compiler
**API**. TypeScript 7 ships without a stable programmatic API, and
`typescript-eslint` (plus other AST consumers) imports the compiler directly.
The stable API is expected in ~7.1, targeted around October 2026. Microsoft
publishes `@typescript/typescript6` as a compatibility shim that re-exports the
6.0 API for tools that need it, with TS 7 installed alongside for compilation.

Taking `latest` blindly would break `pnpm lint` on day one — the exact
"don't blindly trust the version tag" failure mode the project's own
instructions warn about.

## Decision

Pin **`typescript@6.0.3`** exactly (not a caret range) in every workspace
package and app. Do not install TypeScript 7, and do not adopt the
alias-plus-shim arrangement (`typescript` → `@typescript/typescript6` with
`@typescript/native` alongside) in Phase 0.

Revisit when TypeScript 7.1 ships with a stable API **and** `typescript-eslint`
publishes a release that supports it. At that point the upgrade is a version
bump plus a lint run, because nothing in the codebase depends on compiler
internals.

## Consequences

- We forgo the ~10x faster type-checking TS 7 delivers. On a workspace this
  size that is a convenience, not a bottleneck — and `turbo`'s caching already
  keeps repeat `typecheck` runs cheap.
- `next build` uses whatever TypeScript is installed; Next 16.3 works with the
  6.x line, so nothing in the build path is blocked.
- The exact pin (`6.0.3`, no caret) is deliberate: a caret range cannot cross
  into 7.x, but an exact pin also prevents an unreviewed 6.x patch from
  changing type-check results mid-sprint. Renovate (Module 14) proposes bumps
  as reviewable PRs instead.
- One more thing to actively revisit — tracked as a stack.md follow-up rather
  than left to someone noticing lint is broken.

## Alternatives considered

- **`typescript@latest` (7.0.2).** Rejected: breaks `typescript-eslint`, and
  linting is a blocking CI gate for every module.
- **TS 7 + `@typescript/typescript6` shim aliasing.** Rejected _for now_: it
  works, but it means two compilers in the dependency graph and a non-obvious
  resolution alias, during the phase when the foundation should be boring.
  Reconsider if type-check time becomes a real cost before 7.1 lands.
- **Stay on 5.9.3.** Rejected: 6.0.x is the current stable classic line and
  gets the fixes; there is no reason to start one line behind.

## Compliance

- `docs/memory/stack.md` records the exact pin and the revisit trigger.
- Every `package.json` in the workspace declares `"typescript": "6.0.3"`.
- `pnpm lint` + `pnpm typecheck` in CI fail loudly if a mismatched compiler is
  introduced, since `typescript-eslint` errors on an unsupported TS version.
