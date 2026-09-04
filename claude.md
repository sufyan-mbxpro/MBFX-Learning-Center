# MBFX Learning Center — Project Instructions

Forex learning platform: public learning site + admin portal, one Next.js app,
packages-first Turborepo monorepo. **Primary source of truth:** `docs/plan.md`
(Part D = module specs, Part F = locked decisions). This file is the summary
you read first, not a replacement for the plan.

## Architecture in one page

```
apps/
└── web/                    # ONE Next.js 16 app — both surfaces (ADR-006)
    ├── app/
    │   ├── (public)/       #   public site — own root layout; [locale] routing lands in Module 06
    │   ├── (admin)/        #   admin portal — own root layout, force-dynamic; routes under /admin
    │   └── api/            #   thin route handlers → call packages/core services
    └── proxy.ts            # Next 16 proxy (ex-middleware): i18n routing + /admin STAFF gate
packages/
├── db/                     # Prisma 7 schema, client singleton, migrations, seed (Module 01)
├── auth/                   # Better Auth config + session helper (Module 04, ADR-001)
├── rbac/                   # permission registry + can() — deny > super_admin > allow (Module 03)
├── theme/                  # DB tokens → CSS variables, derived contrast (Module 02)
├── ui/                     # shadcn/ui components, shared + themable (Module 07)
├── i18n/                   # next-intl config, catalogs, fallback chain (Module 06)
├── settings/               # typed settings reader/writer + feature flags (Module 05)
├── core/                   # domain services — the only code that touches db (Modules 08/11/13)
├── contracts/              # Zod v4 schemas, shared types
└── utils/                  # pure helpers (slugs, dates, currency, calculators)
tooling/
├── eslint-config/          # flat config: base / react-internal / next
├── typescript-config/      # base / react-library / nextjs tsconfigs
└── tailwind-config/        # shared CSS preset (Tailwind v4 — config lives in CSS)
```

Future apps (`apps/mobile` Expo, `apps/desktop` Tauri/Electron) reuse the same
packages. Platform-specific UI goes in new packages (e.g. `ui-native`) — never
couple shared packages to Next.js. `@repo/ui` is web-only by design.

## The non-negotiables

1. **Apps are thin.** Routing, rendering, composition only. If logic would
   need rewriting for a React Native screen, it belongs in a package. Route
   handlers and server actions never touch Prisma — they call `@repo/core`.
2. **Every mutation checks permissions server-side.** `requirePermission()`
   is the first line of every server action/route handler mutation. Deny
   beats allow; the STAFF gate precedes the permission check; the proxy is a
   gate, not the boundary. A hidden button is not security.
3. **No literals that belong to theme or i18n.** No hex colors outside
   `@repo/theme`'s own token definitions (lint-enforced). No hardcoded
   user-facing strings — message catalogs and translatable settings only.
   Logical properties (`ps-`/`pe-`/`ms-`/`me-`/`text-start`) only — physical
   `pl-/pr-/ml-/mr-` utilities fail lint. Dark/light mode is user-controlled;
   admins control branding, never the mode (ADR-008, plan A5.4).

## Governance loop (mandatory, every module)

**Before** implementing a module, read in this order:

1. `claude.md` (this file)
2. `.claude/rules/*` that apply (architecture, security, code-style, testing)
3. `.claude/skills/<module>/SKILL.md`
4. Relevant ADRs in `docs/memory/decisions/`
5. The last 5 entries of `docs/logs/DEVLOG.md`

**During:** deviation from the plan requires an ADR _before_ the code
(Part F #10). New ADRs supersede; never edit an existing ADR's meaning.

**After:** append a DEVLOG entry (date, module, what shipped, decisions,
test status). Append-only — never rewrite history. `pnpm governance:check`
enforces both rules in CI.

## Module index

| Module                        | Skill                             | Status                                             |
| ----------------------------- | --------------------------------- | -------------------------------------------------- |
| 00 Repo scaffold & governance | `.claude/skills/scaffold/`        | complete                                           |
| 01 `@repo/db` schema/seed     | `.claude/skills/db/`              | complete                                           |
| 02 `@repo/theme` engine       | `.claude/skills/theme/`           | complete                                           |
| 03 `@repo/rbac`               | `.claude/skills/rbac/`            | complete                                           |
| 04 `@repo/auth` (Better Auth) | `.claude/skills/auth/`            | core complete, E2E deferred                        |
| 05 `@repo/settings` + flags   | `.claude/skills/settings/`        | core complete, action UI deferred                  |
| 06 `@repo/i18n`               | `.claude/skills/i18n/`            | core complete, RTL E2E deferred                    |
| 07 `@repo/ui` design system   | `.claude/skills/ui/`              | core complete, axe/visual E2E deferred             |
| 08 Navigation & header/footer | `.claude/skills/navigation/`      | core complete, a11y E2E deferred                   |
| 09 Admin shell & theme editor | `.claude/skills/admin-shell/`     | core complete, E2E + uploads deferred              |
| 10 Users, roles, employees    | `.claude/skills/users-employees/` | core complete, E2E deferred                        |
| 11 Content system             | `.claude/skills/content/`         | services complete; editors/media deferred          |
| 12 Public site                | `.claude/skills/public-site/`     | core complete (glossary+home); learn area deferred |
| 13 Market layer               | `.claude/skills/market/`          | core complete; calendar/history deferred           |
| 14 Hardening & launch gate    | `.claude/skills/hardening/`       | continuous                                         |
| 15 News & Analysis (articles) | `.claude/skills/articles/`        | core complete (ADR-015); editor/E2E deferred       |

Build order and exit criteria: `docs/plan.md` Part E. Locked decisions:
Part F. Exact versions: `docs/memory/stack.md` (never bump ad hoc).

## Commands

```bash
pnpm dev                # single app on :3000 — public at /, admin at /admin
pnpm build              # turbo build (depends on @repo/db#generate)
pnpm lint               # eslint flat config, workspace-wide
pnpm typecheck          # tsc --noEmit per package
pnpm test               # vitest per package via turbo
pnpm format             # prettier --write
pnpm governance:check   # DEVLOG + ADR discipline (also runs in CI)
pnpm check:phantom-deps # every import is a declared dependency
pnpm db:*               # generate | migrate | deploy | seed | studio | reset (Module 01+)
```

Next.js specifics: this repo pins exact versions (`docs/memory/stack.md`).
`apps/web/AGENTS.md` is generated by `next dev` and points at the _installed_
Next.js docs under `node_modules/next/dist/docs/` — trust those over training
data. TypeScript is pinned to 6.0.3 (ADR-010): do not "upgrade" to 7.x.
