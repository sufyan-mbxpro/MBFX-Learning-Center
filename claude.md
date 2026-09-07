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

| Module                        | Skill                             | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00 Repo scaffold & governance | `.claude/skills/scaffold/`        | complete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 01 `@repo/db` schema/seed     | `.claude/skills/db/`              | complete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 02 `@repo/theme` engine       | `.claude/skills/theme/`           | complete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 03 `@repo/rbac`               | `.claude/skills/rbac/`            | complete                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 04 `@repo/auth` (Better Auth) | `.claude/skills/auth/`            | core complete, E2E deferred; **two sign-in surfaces since 2026-09-07 (ADR-052)** — staff at `/admin/sign-in` (route group `(admin-auth)`, the one `/admin` path the proxy gate lets through unauthenticated), learners at `/[locale]/sign-in` + the new `/[locale]/sign-up`. The public site links to neither `/admin` nor the staff screen. Password reset, email verification and OAuth still have no UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 05 `@repo/settings` + flags   | `.claude/skills/settings/`        | core complete, action UI deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 06 `@repo/i18n`               | `.claude/skills/i18n/`            | core complete, RTL E2E deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 07 `@repo/ui` design system   | `.claude/skills/ui/`              | core complete, axe/visual E2E deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 08 Navigation & header/footer | `.claude/skills/navigation/`      | core complete, a11y E2E deferred; **admin reorder UI paused 2026-09-06 (ADR-038)**, runtime unaffected; **mega menu shipped 2026-09-07 (ADR-048)** — panel composition is a code registry (`app/(public)/[locale]/_nav/mega-menu.ts`), the database still owns items, labels and hrefs; mobile nav is a sheet with accordion sections; **footer is a sitemap as of 2026-09-07 (no ADR)** — three seeded footer menus (`footer_learn` / `footer_markets` / `footer_company`) listed by `footer.menuColumns`, so every header destination has a footer row. Extending it is a seed + setting change, not a code change                                                                                                                                                                                                                                                                                                                                                                                                             |
| 09 Admin shell & theme editor | `.claude/skills/admin-shell/`     | core complete, E2E + uploads deferred; **theme editor's Layout & Display tab paused 2026-09-06 (ADR-038)** — Colors/Modes/Presets/Logos unaffected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 10 Users, roles, employees    | `.claude/skills/users-employees/` | core complete, E2E deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 11 Content system             | `.claude/skills/content/`         | services complete; editors/media deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 12 Public site                | `.claude/skills/public-site/`     | core complete (glossary+home); learn area deferred; **homepage section admin UI paused 2026-09-06 (ADR-038)**, rendering unaffected; **About section shipped 2026-09-07 (ADR-047, changes-09)** — five coded static pages under `/about/**`, every factual claim gated on `_content/about-facts.ts` (empty ⇒ the section does not render); **homepage design pass 2026-09-07 (no ADR)** — new `explore_platform` section (destination carousel; composition in `_sections/explore-destinations.ts`, `soon` cards are non-clickable because `/learn`, `/tools`, `/markets` have no route), `_content/home-media.ts` third instance of the ADR-047 §3 media pattern, filled with generated art from `scripts/generate-home-art.mjs` (the About generator's engine, now shared at `scripts/lib/art.mjs` — output is committed and byte-deterministic; re-run, never hand-edit an SVG), seven un-built stub sections seeded `enabled: false` (**needs `pnpm db:reset` to appear**). axe + Lighthouse budgets still owed to Module 14 |
| 13 Market layer               | `.claude/skills/market/`          | core complete; **`/economic-calendar` shipped 2026-09-07 (ADR-050)** as an embedded MQL5/Tradays widget behind the already-seeded flag and menu row — our chrome, the vendor's data. No Prisma models, no sync, no admin screen: the DB-backed calendar in this module's spec is **deferred, not replaced**, and history is still deferred. Read ADR-050 before extending it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 14 Hardening & launch gate    | `.claude/skills/hardening/`       | continuous                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 15 News & Analysis (articles) | `.claude/skills/articles/`        | core complete (ADR-015); **editor v2 shipped 2026-09-07** (changes-07 PRs 0–6, 8: one-transaction `saveArticle`, FAQ blocks, curated related posts, SEO analysis, featured flag, header image, quick edit); **editor v3 shipped 2026-09-07** (changes-10, ADR-046: sectioned layout, intent-coloured actions, FAQ dialog + collapse, inline category/tag creation, HTML source view, class-based tone/family/size/alignment, tables, in-body video). E2E deferred; per-post custom CSS rejected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 16 Website builder (CMS)      | `.claude/skills/website-builder/` | **CANCELLED 2026-09-07 (ADR-042, supersedes ADR-037)** — withdrawn, not paused: there is no resume path, and no work is to be planned against plan v2.2 (now history, like v1). Admin UI stays hidden (`WEBSITE_BUILDER_ADMIN_UI_ENABLED = false` in `admin-shell.tsx`); code, DB, seeded rows, permissions and public rendering are all **retained** — nothing is deleted, and deleting any of it needs its own ADR. ADR-020…036 are not reversed; they are accurate history that has lost its forward force. Progress when cancelled: Phase 1–3 complete, Phase 4 through PR 4.3. **Read ADR-042 before acting on anything in this row.**                                                                                                                                                                                                                                                                                                                                                                                      |

Module 16's plan — `docs/MBX-Dynamic-Site-Control-Plan-v2.md`, and the v1 it
superseded — is **withdrawn history as of ADR-042**. Do not implement from
either, and do not treat `docs/cms/00-reconciliation.md` as a live spec.

**Design philosophy (settled 2026-09-07, ADR-042; stated first in ADR-038):**
site design (layout structure, navigation, homepage composition, theme
layout/fonts) is built module-by-module in code or statically — never through
admin-configurable dynamic composition. Only content _data_ (news articles,
glossary, taxonomy, users, settings) is dynamic and admin-managed. This is
the settled position, not an interim one: the admin surfaces it removes
(Website Builder in full; Navigation reorder; Homepage section composer;
Settings → Layout; Theme's Layout & Display tab) are hidden permanently, and
changing menu order, homepage composition or layout tokens is a code change.
Hidden, not deleted — read ADR-042 before touching any of it.

**Multilingual is NOT in scope of that cancellation (owner, 2026-09-07).**
"Design is static" means layout and composition, never language. ADR-043 scopes
it precisely — three statements that had been running together:

1. **The PUBLIC site is multilingual, fully.** Everything under
   `app/(public)/**` is translated for every active locale: catalogs,
   `*Translation` tables, `[locale]` routing, `dir=rtl` + logical properties,
   hreflang. Do not simplify any of it away.
2. **The ADMIN portal is English-only, by design.** `admin.*` and `cms.*` keys
   need a value in `en.json` only. Strings still go through catalog keys
   (code-style.md #2's mechanism is unchanged) — only the non-English _values_
   are dropped. Reversible any time by translating the namespace.
3. **Only `en` is active right now** (ADR-007; `seed.ts` has `es`/`ar`/`ur` as
   `isActive: false`). The machinery exists for all four regardless —
   activating one is a data change plus a catalog, never a re-architecture.

`check:catalog-completeness` enforces the split: public gaps FAIL for any
locale in its `ENFORCED_LOCALES` list and warn otherwise; admin gaps are
silent. **Flipping a locale to `isActive` means adding it to that list in the
same PR**, so CI refuses the activation until its public catalog is complete.

**PR 0 (2026-09-07) resolved ADR-042's one live conflict.** `/` and `/news`
had been rendering from published CMS `PageVersion` rows (`renderCmsHome` /
`renderCmsNews` ran _before_ the coded fallbacks). Both switches are removed;
the routes render from `_sections/registry.ts` and the coded news listing. The
CMS rows are retained, not deleted, and are now simply unresolved. Remaining
open decisions live in `docs/changes/changes-07-plan.md` §10.4.

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
