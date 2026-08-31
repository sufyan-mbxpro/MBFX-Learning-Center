# ADR-006: One Next.js app with `(public)` and `(admin)` route groups

**Status:** Accepted
**Date:** 2026-08-31
**Module:** 00 — Repo scaffold & governance
**Supersedes:** —
**Superseded by:** —

## Context

`MONOREPO_ARCHITECTURE.md §1.1` and `plan.md` Part F decision #3 specified two
separate Next.js applications — `apps/web` (public) and `apps/admin` (staff) —
and marked that choice LOCKED. Four arguments were given: bundle isolation,
different rendering profiles, different deploy cadence/access rules, and
separate auth cookie surfaces.

The project owner has directed that Web and Admin ship as **one Next.js
application** with strong internal separation, keeping the packages-first
monorepo intact so mobile (Expo) and desktop (Tauri/Electron) can be added
later without rewriting business logic.

This is not an unconsidered reversal: `MONOREPO_ARCHITECTURE.md §11.2` already
recorded the counter-argument — for a small team, one app with an aggressive
`dynamic` boundary is defensible, and because all logic lives in `packages/*`,
splitting later is mechanical rather than a rewrite. That is the position now
adopted.

## Decision

One Next.js 16 app at `apps/web`, using the **multiple-root-layouts** pattern:
each top-level route group owns its own `<html>` root layout, so the two
surfaces share a runtime without sharing a shell.

This is not a custom structure — it is the officially documented convention.
The Next.js project-structure guide names route groups as the tool for
"organizing routes by site section, intent, or team, e.g. marketing pages,
admin pages", and documents multiple root layouts verbatim: "remove the
top-level layout.js file, and add a layout.js file inside each route group…
useful for partitioning an application into sections that have a completely
different UI or experience. The `<html>` and `<body>` tags need to be added
to each root layout." Standard Next.js conventions (`page`/`layout`/`error`/
`not-found`/`loading`/`route` files, `_private` folders, root `proxy.ts`)
apply unchanged inside each group.

```
apps/web/
├── app/
│   ├── (public)/          # public site — own root layout
│   │   ├── layout.tsx     # <html lang dir> + theme tokens + next-intl provider
│   │   └── [locale]/…     # locale-prefixed routes (Module 06)
│   ├── (admin)/           # admin portal — own root layout
│   │   ├── layout.tsx     # force-dynamic + admin shell (Module 09)
│   │   └── admin/…        # /admin/* routes
│   └── api/               # thin route handlers → packages/core
├── proxy.ts               # Next 16 (was middleware.ts): i18n + STAFF gate
└── next.config.ts
```

`apps/admin` is not created. Future `apps/mobile` and `apps/desktop` are
siblings of `apps/web`; platform-specific UI goes in new packages (e.g.
`packages/ui-native`) rather than by coupling shared packages to Next.js.

Everything else in the architecture is unchanged: apps stay thin, route
handlers never touch Prisma, RBAC semantics stay `deny > super_admin > allow`,
the theme engine, cache-tag names (`theme`, `settings:{group}`, `navigation`,
`rbac:{userId}`), and the i18n design all survive as specified.

## Consequences

The two-app split bought four things. Three are recoverable by construction;
the fourth is a genuine, permanent cost and is stated plainly.

**1. Bundle isolation — recoverable, but now requires enforcement.**
Admin ships a rich-text editor (Tiptap), TanStack Table, color pickers and
chart config. Next.js code-splits per route, so those land only in `(admin)`
chunks _as long as nothing in `(public)` or a shared module imports them_.
Mitigations, all required:

- `.claude/rules/architecture.md` bans importing admin-only modules from
  `(public)` or from shared app-level code.
- An ESLint `no-restricted-imports` boundary rule enforces it mechanically.
- Lighthouse CI budgets on public routes (Modules 12/14) become a **blocking**
  gate — with one app, this is the backstop that catches a leak the lint rule
  misses.

**2. Rendering profiles — recoverable.**
Public routes stay static/ISR with cache tags; the `(admin)` root layout sets
`export const dynamic = "force-dynamic"`. Mixing profiles is a per-segment
config problem, not an app-boundary problem.

**3. Deploy cadence and network access — acceptable, with a changed method.**
One deployment instead of two independent ones. Admin can no longer sit behind
a WAF/IP allowlist by _hostname_; protection becomes **path-based** on
`/admin/*` at the edge/reverse proxy. If host-level isolation is later
required, the same app can be served at `admin.<domain>` via a host rewrite —
no code change. Database migrations remain a separate pre-deploy step.

**4. Separate auth cookie surfaces — genuinely lost. This is the real cost.**
Learner and staff sessions now share an origin, so cookie-scope isolation no
longer reduces blast radius. Compensating controls are mandatory, not optional:

- `proxy.ts` rejects any request to `/admin/*` whose session has
  `userType !== "STAFF"`, before any route or layout runs.
- The STAFF check is **re-applied server-side** in the admin layout and in
  admin services — the proxy is a gate, not the boundary.
- `requirePermission()` at the top of every mutation remains the real boundary,
  exactly as before (`MONOREPO_ARCHITECTURE.md §6.3`).
- Shorter session lifetime for staff sessions, plus re-authentication for
  sensitive mutations (role/permission edits, impersonation).
- Stricter CSP and security headers for `/admin/*` than for public paths
  (Module 14).
- IDOR probes in the Module 14 suite must now also assert that a learner
  session cannot reach any `/admin/*` route or admin API handler.

## Alternatives considered

- **Keep two apps (the original plan).** Rejected by the project owner. Its
  strongest remaining argument is #4 above; the compensating controls are
  judged sufficient for this team and threat model.
- **One app, `/admin` as a plain nested folder under a single shared root
  layout.** Rejected: a single root layout forces the public `<html>` shell
  (locale `dir`, theme provider, public font loading) onto admin pages, and
  gives no natural place for `force-dynamic`. Route groups with separate root
  layouts give the same URL structure with real separation.
- **One app now, split later if it hurts.** This _is_ that plan — §11.2's point
  stands: because logic lives in `packages/*`, promoting `(admin)` into its own
  app later is mechanical. Nothing in this ADR forecloses it.

## Compliance

- ESLint import-boundary rule between `(public)` and `(admin)` (Module 07/09).
- `proxy.ts` STAFF-gate integration test + a learner-session E2E that asserts
  `/admin/*` is refused (Module 04).
- Lighthouse budget on public routes, blocking in CI (Modules 12/14).
- Admin-surface E2E suites run against `/admin/*` on the single app; the
  "permission-denied path" assertions in Module 09 are unchanged.
