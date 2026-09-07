# Forex Learning Portal — Plan Review & Updated Implementation Plan

**Reviewed:** 31 Aug 2026 · against `MONOREPO_ARCHITECTURE.md`, `MONOREPO_CONFIG.md`, `schema.prisma`, `seed.ts`, `theme-engine.ts`, `rbac.ts`, `root-layout.tsx`, `globals.css` (now in `docs/reference/`)

**Revised:** 31 Aug 2026 — **single-app architecture (ADR-006)**. Web and Admin ship as one Next.js application (`apps/web`) with `(public)` and `(admin)` route groups, each owning its own root layout. `apps/admin` is not created. The packages-first monorepo is unchanged, so `apps/mobile` (Expo) and `apps/desktop` (Tauri/Electron) remain drop-in siblings later. Every reference below to "both apps" now means **both surfaces of one app**. Also revised for the Day-1 version sweep (see `docs/memory/stack.md`).

**Verdict:** The architecture is fundamentally sound — packages-first monorepo, DB-driven theming with derived contrast, deny-beats-allow RBAC, base+translation i18n. It does **not** need a redesign. It needs: (1) a version refresh (three of the four pillars have moved), (2) two bug fixes found in review, (3) a testing layer that is currently entirely absent, (4) a governance layer (claude.md / memory / rules / logs / per-module skills) that is required but undefined, and (5) per-module implementation prompts. All of that is below.

---

# PART A — REVIEW FINDINGS

## A1. Outdated: stack versions (verified against releases as of 31 Aug 2026)

| Tech       | Plan says                         | Current stable                                                                                                                                                                                 | Action                                                                                                                                                                                                                                                                                                                          |
| ---------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js    | 15 (App Router)                   | **16.3.3** (Active LTS; 15.x is Maintenance LTS, **EOL Oct 2026**)                                                                                                                             | Build on 16.3.x. Do not start a greenfield project on a line that loses support two months after kickoff.                                                                                                                                                                                                                       |
| React      | 19.0                              | 19.x latest (ships with `create-next-app@latest`)                                                                                                                                              | Take whatever `create-next-app` pins.                                                                                                                                                                                                                                                                                           |
| Auth       | Auth.js v5                        | **Auth.js is in maintenance mode** (team joined Better Auth, Sept 2025; the repo itself now recommends Better Auth for new projects). **Better Auth 1.x** is the actively developed successor. | **Switch `packages/auth` to Better Auth.** See A3.                                                                                                                                                                                                                                                                              |
| Prisma     | ^6.1                              | **7.10.0 stable**; Prisma 8 is **still RC** (`prisma@8.0.0-rc.12`; `@prisma/client` `latest` = 7.10.0) as of the Day-1 sweep                                                                   | **Locked to Prisma 7.10.x** — 8 is not GA, so it fails the "stable production-ready line" test. See ADR-002. v7 is breaking vs v6 — see A4.                                                                                                                                                                                     |
| Tailwind   | v4                                | v4.1.x                                                                                                                                                                                         | Fine; use 4.1 features (e.g. `@source` already correct).                                                                                                                                                                                                                                                                        |
| shadcn/ui  | CLI 2-era, manual monorepo config | **CLI 3.x** — native monorepo support, namespaced registries                                                                                                                                   | `components.json` approach still valid; use `shadcn@latest` init with monorepo template instead of hand-rolling.                                                                                                                                                                                                                |
| next-intl  | (unversioned)                     | v4.x                                                                                                                                                                                           | Verify Next 16 peer range at kickoff; v4 supports App Router + `[locale]` segment as planned.                                                                                                                                                                                                                                   |
| Turborepo  | ^2.3                              | 2.5+                                                                                                                                                                                           | Bump.                                                                                                                                                                                                                                                                                                                           |
| pnpm       | 9.15                              | **11.24.0** (10.x line ended at 10.34.5)                                                                                                                                                       | Bump `packageManager` to pnpm@11. Lifecycle-script trust (`onlyBuiltDependencies`) is still required for `@prisma/*`, `@node-rs/argon2`, `esbuild` — but **pnpm 11 reads it from `pnpm-workspace.yaml`, not package.json's `pnpm` field**. pnpm 11 also requires Node 22+, is pure ESM, and defaults `minimumReleaseAge: 1440`. |
| TypeScript | ^5.7                              | `latest` dist-tag is **7.0.2** (native Go compiler); **6.0.3** is the last classic-API line                                                                                                    | **Pin 6.0.3, not 7.x.** TS 7 has no stable programmatic API until ~7.1, which breaks `typescript-eslint` (and ts-based test tooling) — the plan's own "tsgo is opt-in, not baseline" call, now with a concrete blocker. See ADR-010. Revisit when 7.1 ships.                                                                    |
| Zod        | (implied v3)                      | v4                                                                                                                                                                                             | Use v4 in `@repo/contracts`; v4 has different error APIs — don't copy v3 snippets.                                                                                                                                                                                                                                              |
| Node       | >=20.11                           | **Node 24 LTS ("Krypton")** is Active LTS (EOL Apr 2028); Node 22 went to Maintenance LTS in Oct 2025 (EOL Apr 2027)                                                                           | Bump `engines` to `>=24.0.0`. Starting greenfield on a maintenance-phase line repeats the mistake the Next.js row calls out.                                                                                                                                                                                                    |

**Rule going forward (add to `rules`):** exact versions are pinned in a `docs/memory/stack.md` at Phase 0 kickoff after running `pnpm outdated` — the plan names lines (16.x, 7.x), never patch numbers, so it doesn't rot.

## A2. Next.js 15 → 16 migration deltas that touch the uploaded code

1. **`middleware.ts` → `proxy.ts`.** Next 16 renamed the file and convention. Under ADR-006 there is now **one** `apps/web/proxy.ts` carrying both responsibilities: i18n locale routing for the `(public)` surface and the `userType !== "STAFF"` gate for `/admin/*`. The `matcher` config carries over, and must exclude `/api`, `/_next`, and static files, and must not locale-prefix `/admin`.
2. **Caching model.** `unstable_cache` (used in `theme-engine.ts`, `rbac.ts`, and the settings reader) still works in 16 but is the legacy path. Next 16's Cache Components (`"use cache"` + `cacheTag()` + `cacheLife()`, invalidated with `revalidateTag`/`updateTag`) is the supported direction. **Decision:** adopt `"use cache"` for theme/settings/navigation reads; keep the tag names (`theme`, `settings:{group}`, `rbac:{userId}`) exactly as designed — the invalidation architecture survives unchanged, only the wrapper syntax changes. Write this as an ADR so nobody "helpfully" reintroduces `unstable_cache`.
3. **Turbopack is the default bundler** in dev and build. Drop any webpack-specific config assumptions; `transpilePackages` still works.
4. **Async request APIs** (`await params`, `await cookies()`) — `root-layout.tsx` already does this correctly. No change.
5. `experimental.optimizePackageImports` for `lucide-react` is on by default for known packages in 16 — remove the flag.

## A3. Auth: replace Auth.js v5 with Better Auth (decision + consequences)

Auth.js receives security patches only; no new features. For a greenfield project with a "latest stable" mandate, building on it is starting in debt. Better Auth is the successor by the same team's endorsement and covers, **in core or first-party plugins**, several things the plan was going to hand-build:

- Email/password with configurable hashing → keep **Argon2id** by supplying `@node-rs/argon2` as the custom hasher (Better Auth defaults to scrypt; the plan's Argon2id choice stands, implemented via the `password.hash/verify` config).
- OAuth (Google, GitHub), email verification, password reset with single-use expiring tokens.
- **Database sessions with revocation** — matches the plan's "log this user out now must actually work" requirement.
- **Rate limiting** built in (backed by Redis via secondary storage) — replaces the hand-rolled §5.2 plan.
- **Admin plugin**: list/ban users, revoke sessions, impersonation — the `users.impersonate` permission gets a real mechanism.
- **Two-factor plugin** — the `mfaEnabled`/`mfaSecret` columns get an implementation instead of dead schema.
- **Bearer/JWT support** for the future mobile app — replaces the "written now, left unrouted" token issuance.

**Single-app consequence (ADR-006):** learner and staff sessions now share an origin, so the cookie-scope isolation the two-app split provided is gone. Better Auth's **database sessions with revocation** and the STAFF gate carry more weight as a result. Compensating controls are mandatory: the `proxy.ts` STAFF gate before any `/admin/*` route, a server-side re-check in the admin layout and admin services, `requirePermission()` on every mutation as the true boundary, shorter staff session lifetime with re-authentication for sensitive mutations (role/permission edits, impersonation), and stricter CSP on `/admin/*` (Module 14).

**Schema consequence:** Better Auth generates its own `user/session/account/verification` tables via its Prisma adapter and CLI (`npx @better-auth/cli generate`). The uploaded `schema.prisma`'s Auth.js-shaped `Account`/`Session`/`VerificationToken` models are **replaced by generated ones**, then extended with the project's custom fields (`userType`, `status`, `locale`, `themeMode`, `deletedAt`, lockout fields) using Better Auth's `additionalFields`. The RBAC, Employee, and content tables are untouched — they relate to `User.id` regardless of who mints the session.

**Fallback position (record as ADR-002):** if a hard blocker appears in week 1 (e.g. an adapter gap with MariaDB), Auth.js v5 remains a viable, security-patched fallback and the `packages/auth` boundary means the swap cost is contained to one package. Timebox the spike to 2 days.

## A4. Prisma 6 → 7 deltas that touch `schema.prisma`

- Generator becomes `provider = "prisma-client"` (not `prisma-client-js`) with a **required custom `output`** (e.g. `../src/generated/client`). All imports come from that path, not `@prisma/client` — the `packages/db` singleton re-export makes this invisible to the rest of the repo (one more reason the singleton was right).
- New `prisma.config.ts` in `packages/db` for env loading and seed configuration (the `"prisma": { "seed": ... }` package.json block moves there).
- **Driver adapters are the standard path**: use `@prisma/adapter-mariadb` for MariaDB.
- **Remove `relationMode = "prisma"`.** That mode exists for FK-less platforms (PlanetScale). Self-hosted MariaDB supports real foreign keys; emulating them in the client silently drops DB-level integrity and costs extra queries. This is a **bug-class fix**, not a preference.
- Turbo task `@repo/db#generate` outputs change from `../../node_modules/.prisma/**` to the custom output dir — update `turbo.json`.

## A5. Bugs found in the uploaded code (fix before they fossilize)

1. **Theme scope resolution is wrong for `web`.** `theme-engine.ts` loads with `orderBy: { scope: "asc" }` and the comment "exact scope wins over both". Alphabetically `"admin" < "both" < "web"` — so for the **web** scope, a `"both"` theme sorts _before_ the exact `"web"` theme and wins, the opposite of the stated intent. Fix: fetch both candidates and pick exact-scope in code, or order by a computed priority (`scope = $scope DESC` via two queries / `queryRaw`), and **add the unit test that would have caught it** (see Module 02 tests).
2. **`--font-sans` circular reference.** `globals.css` declares `@theme inline { --font-sans: var(--font-sans); }` while the theme engine also emits `--font-sans` on `:root`. Same-name self-reference is circular. Fix: engine emits `--brand-font-sans` / `--brand-font-mono`; `@theme inline` maps `--font-sans: var(--brand-font-sans)`.
3. **RGB channel triples break Tailwind opacity modifiers.** Tokens are stored as `"255 255 255"` and consumed as `rgb(var(--background))`, which makes `bg-background/50` produce invalid CSS. Tailwind v4 + current shadcn style use **full color values** (hex or oklch) directly — v4 handles opacity via `color-mix()`. Fix: `tokensToCss` emits plain hex values (`--background: #ffffff`), `@theme inline` maps `--color-background: var(--background)`, and `rgbChannels()` is deleted. This also simplifies the engine and its tests.
4. **`Theme.allowUserToggle` contradicts the requirements.** The requirement is explicit: dark/light mode is **user-controlled, not admin-controlled**. Drop the column. `defaultMode` survives only as the _first-visit_ default; the user's choice (next-themes localStorage + `User.themeMode` for signed-in users) always wins and can never be disabled by an admin.
5. **Minor:** text-size tokens lack paired line-heights (`--text-base--line-height` etc. in Tailwind v4) — add them; `focus-visible` global ring is good, keep it.

## A6. Requirement coverage check (the new/clarified requirements)

| Requirement                                         | Covered by existing plan?                                                             | Gap / action                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header controllable from admin                      | Partially — `Menu`/`MenuItem` (location `header`) covers nav                          | Add **header settings** (layout group): logo variant per mode (`BrandAsset` ✓), CTA button (label key + route/URL + visibility), sticky on/off, announcement bar (text translatable, dismissible, on/off). Spec in Module 08.                                                                                                                       |
| Menu / navigation                                   | ✓ `Menu`, `MenuItem`, `MenuItemTranslation`, visibility + feature + permission gating | Add drag-reorder admin UI spec + nav cache tag `navigation` + max-depth rule (2 levels) .                                                                                                                                                                                                                                                           |
| Footer controllable                                 | Partially — footer menus ✓, `SocialLink` ✓                                            | Add footer settings: column layout (which menus, in which order), copyright line (translatable, `{year}` token), optional disclaimer/legal text (forex sites need a risk disclaimer — make it a translatable `legal` setting rendered site-wide), newsletter block toggle.                                                                          |
| Background colors                                   | ✓ `SurfacePalette` per mode                                                           | None.                                                                                                                                                                                                                                                                                                                                               |
| Primary/secondary colors                            | ✓ `BrandColors`                                                                       | None.                                                                                                                                                                                                                                                                                                                                               |
| Hover/active colors                                 | ✓ derived (`--primary-hover`, `--primary-active`)                                     | Keep **derived, not editable** — record as ADR: admins set base colors; hover/active are computed so they can never fail contrast. Expose a read-only preview in the theme editor instead of inputs.                                                                                                                                                |
| Typography                                          | Partially — font stacks in `LayoutTokens`                                             | Arbitrary font URLs are a security + performance hole. Action: **curated font allowlist** — 8–12 self-hosted families via `next/font/local` in `packages/ui`, admin picks from the list; engine maps the pick to the preloaded family. Add `baseFontSize` (13–16px) to `LayoutTokens`. Arbitrary Google-Fonts-by-URL is explicitly out of scope v1. |
| Dark/Light = user-controlled                        | Conflict — `allowUserToggle`                                                          | Fixed per A5.4.                                                                                                                                                                                                                                                                                                                                     |
| Latest stable everything                            | No                                                                                    | Fixed per A1.                                                                                                                                                                                                                                                                                                                                       |
| Tests per module                                    | **Absent — the biggest gap**                                                          | Part C defines the testing standard; every module spec in Part D includes required tests.                                                                                                                                                                                                                                                           |
| Governance (claude.md, memory, skills, logs, rules) | **Absent**                                                                            | Part B defines it.                                                                                                                                                                                                                                                                                                                                  |

## A7. Schema gaps to spec later (don't block Phase 0)

Permissions are seeded for capabilities with **no backing models yet**: `analysis.*`, `news.manage`, `media.*`, `comments.moderate`, `market.*`. Add models in their phases: `MediaAsset` (+usage tracking), `Article`/`ArticleTranslation` (analysis & news, one model + `kind` enum), `Comment`, `Instrument`, `EconomicEvent`, `Page`/`PageTranslation` (for admin-editable static pages — currently missing entirely and needed for "highly dynamic public site"). **Update 2026-09-04:** `Page`/`PageTranslation` are now owned by **Module 16** (website builder) and specified in **ADR-021** — they are the CMS page model, not a second one; `Comment` landed design-only in ADR-019. Seeding a permission before its feature exists is fine (it gates nothing); shipping the feature without wiring the permission is not — add a CI check that every `requirePermission()` string exists in the seed registry (Module 03 tests).

---

# PART B — GOVERNANCE LAYER (required; currently undefined)

These files are created in Phase 0, **before any feature code**, and the standing rule is: _read the relevant governance files before implementing each module; append to logs/memory after; never overwrite history._

```
mbfx-learning-center/
├── claude.md                      # Project instructions & architecture summary (source of truth for agents)
├── .claude/
│   ├── rules/
│   │   ├── architecture.md        # apps = routing/rendering only; route handlers never touch Prisma;
│   │   │                          #   (public)/(admin) import boundary (ADR-006); etc.
│   │   ├── security.md            # requirePermission first line of every mutation; deny beats allow; no secrets in DB
│   │   ├── code-style.md          # naming, exports, logical properties (ps-/pe-), no color literals outside theme
│   │   └── testing.md             # the standard from Part C — coverage floors, what blocks merge
│   └── skills/                    # per-module standards, one folder per module
│       ├── theme/SKILL.md         # token vocabulary, derivation rules, WCAG thresholds, "hover/active are derived"
│       ├── rbac/SKILL.md          # permission key format, escalation rules, audit requirements
│       ├── db/SKILL.md            # migration discipline, soft-delete policy, translation-table pattern
│       ├── ui/SKILL.md            # shadcn conventions, a11y checklist, RTL checklist
│       ├── i18n/SKILL.md          # message key conventions, fallback chain, outdated-translation flow
│       └── ...one per module in Part D
├── docs/
│   ├── plan.md                    # this document — primary source of truth
│   ├── reference/                 # the reviewed input bundle (architecture/config docs + code)
│   ├── memory/
│   │   ├── decisions/             # ADRs: ADR-001-better-auth.md, ADR-002-prisma-version.md, ADR-003-derived-hover.md,
│   │   │                          #       ADR-004-next16-cache-components.md, ADR-005-curated-fonts.md,
│   │   │                          #       ADR-006-single-app-route-groups.md, ADR-010-typescript-version.md ...
│   │   └── stack.md               # pinned exact versions, updated deliberately, never ad hoc
│   └── logs/
│       └── DEVLOG.md              # append-only: date, module, what shipped, what was decided/deferred, test status
```

**Note on `docs/` casing:** the reviewed bundle arrived in `Docs/`; it is normalized to lowercase `docs/` (with the input files under `docs/reference/`) because Windows treats `Docs/` and `docs/` as the same directory while Linux CI does not — two casings in one repo is a cross-platform trap.

**claude.md contents (write it, don't improvise it):** one-page architecture summary (the package map + the three non-negotiables: apps are thin, permission check server-side on every mutation, no color/text literals that belong to theme/i18n), the module index pointing at `.claude/skills/*`, the governance loop ("before a module: read claude.md + its SKILL.md + rules + last DEVLOG entries; after: append DEVLOG, add/append ADR if a decision was made"), and the command cheatsheet.

**Enforcement, not vibes:** a `pnpm governance:check` script (Phase 0) fails CI if a merge touches `packages/*` without a same-branch DEVLOG entry, or if any ADR file was _modified_ rather than superseded.

---

# PART C — TESTING STANDARD (applies to every module)

**Frameworks (latest stable at kickoff):** Vitest (unit/integration, workspace mode across packages) · React Testing Library + vitest-browser or jsdom (components) · Playwright (E2E, both surfaces of the single app — public suites against `/`, admin suites against `/admin/*`) · `@axe-core/playwright` (a11y gate) · Testcontainers **MariaDB** (real-DB integration for db/rbac/settings — mocking Prisma hides FK and constraint bugs) · MSW where an external API must be faked (market data).

**Turbo wiring:** every package gets a `test` task; `turbo test` depends on `@repo/db#generate`; CI = `lint → typecheck → test → build → e2e`. Coverage floors (blocking): **90% on pure-logic packages** (`theme`, `rbac`, `utils`, `contracts`), **80% on service packages** (`core`, `settings`, `i18n`), **no floor but required happy-path + auth-failure E2E per admin screen**.

**Single-app additions (ADR-006):** because one app now serves both surfaces, two gates that were structural become tests. (1) **Bundle-boundary gate** — a Lighthouse CI budget on public routes, blocking, so admin-only dependencies (Tiptap, TanStack Table, color pickers) cannot leak into public bundles unnoticed; backed by an ESLint import-boundary rule between `(public)` and `(admin)`. (2) **Cross-surface authorization gate** — the Module 14 IDOR suite must additionally assert that an authenticated _learner_ session cannot reach any `/admin/*` route or admin API handler, since it now carries a valid same-origin cookie. Every bug fixed gets a regression test in the same PR (rule in `testing.md`).

**Cross-cutting required suites:**

- **RTL smoke:** Playwright runs the public-site suite twice, `en` and `ar`, asserting `dir=rtl` and no horizontal overflow on key pages.
- **A11y gate:** axe scan on every public page template and every admin screen; serious/critical violations fail CI.
- **Theme contract test:** for the default theme _and_ a property-based sample of random valid palettes, every (text, surface) pair the engine emits meets its WCAG threshold. This is the test that makes "admin can never ship an illegible site" true rather than hoped.

---

# PART D — MODULE SPECS (implementation prompt + tests per module)

Each module below is a unit of work with: **Scope**, an **Implementation prompt** (paste-able instruction for whoever/whatever implements it — always prefixed by the governance preamble), **Required tests**, and **Definition of Done (DoD)**. The governance preamble for every prompt is implicit and mandatory:

> _"Before writing code: read `claude.md`, `.claude/rules/*`, `.claude/skills/<module>/SKILL.md`, and the last 5 entries of `docs/logs/DEVLOG.md`. Follow them; where you must deviate, write an ADR first. After finishing: append a DEVLOG entry with test results."_

## Module 00 — Repo scaffold & governance

**Scope:** Fresh Turborepo with the package map from the architecture doc, built with current tooling — `pnpm create next-app@latest` for the **single** `apps/web` (TypeScript, App Router, Tailwind v4, Turbopack — all current defaults), restructured into `(public)` and `(admin)` route groups per ADR-006, each with its own root layout; pnpm 11 workspace with `onlyBuiltDependencies` (in `pnpm-workspace.yaml`, which is where pnpm 11 reads it) for `@prisma/*`, `@node-rs/argon2`, `esbuild`; Node 24 engines; the ten `packages/*` as declared skeletons; shared `tooling/` (eslint flat config, tsconfig bases, tailwind preset); Prettier; the full governance tree from Part B with claude.md, rules, SKILL.md per module, ADR-000 (template) plus the decisions actually made on Day 1, DEVLOG seeded; `governance:check` script; CI pipeline skeleton (GitHub Actions: install → lint → typecheck → test → build, Turbo remote cache).

**Implementation prompt:** "Scaffold the monorepo per `docs/reference/MONOREPO_ARCHITECTURE.md §1` and `MONOREPO_CONFIG.md` as revised for ADR-006, updated as follows: pnpm@11 + Node 24 engines; one Next.js 16.3.x app created with `create-next-app@latest`, then split into `app/(public)/` and `app/(admin)/admin/` with separate root layouts; `middleware.ts` references become a single `apps/web/proxy.ts`; turbo.json `@repo/db#generate` outputs point at the Prisma 7 custom client output; remove `optimizePackageImports` (on by default in 16). Create every governance file in Part B with real content, not placeholders. Add `.env.example` from §7 unchanged except: add `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` naming per Better Auth docs, keep `SEED_ADMIN_*` with the production-omission comment. Nothing in this module renders UI beyond a placeholder per surface."

**Tests:** CI green on the empty workspace (`lint`, `typecheck`, `test`, `build` all pass); `governance:check` proven to fail on a package change without a DEVLOG entry (negative test, run in CI); a workspace fixture test asserting every package in `packages/*` declares its deps explicitly (no phantom-dependency imports — script comparing `import` statements to package.json).

**DoD:** `pnpm dev` boots the single app on :3000 with the public surface at `/` and admin at `/admin`; remote cache configured (hit demonstrated once a token exists); governance tree complete.

## Module 01 — `@repo/db`: schema, migrations, seed

**Scope:** Prisma 7 (`prisma-client` generator, custom output, `prisma.config.ts`, `@prisma/adapter-mariadb`, real FKs — no `relationMode="prisma"`). Port the uploaded `schema.prisma` with the review fixes: drop `Theme.allowUserToggle`; auth tables replaced by Better Auth CLI-generated models extended with project fields (Module 04 owns the generation, this module owns the merge); everything else (RBAC, Employee, Settings, FeatureFlag, SocialLink, Theme, BrandAsset, Locale, Menu*, Course/Module/Lesson/Glossary + translations, ContentRelation, AuditLog, Redirect) ports as-is. Port `seed.ts` unchanged in spirit: idempotent upserts on business keys, permission registry, 11 roles with `level`, default theme from `@repo/theme` defaults, locales (en default, ur/ar/es inactive until translated), menus (main header, footer columns), social links, settings incl. new header/footer/legal keys, admin user from `SEED_ADMIN_*` (fail loudly if password empty in dev).

**Implementation prompt:** "Implement `packages/db` on Prisma 7.x per `.claude/skills/db/SKILL.md`. Migrate the uploaded schema applying review fixes A4/A5.4. Keep the singleton client pattern but export from the Prisma 7 generated output path. Seed must be re-runnable against a dirty database without duplicating or clobbering admin-edited values (upsert `create`-only for admin-editable fields like Setting.value — update labels/types, never values, on reseed)."

**Tests (Vitest + Testcontainers MariaDB):** migrations apply cleanly from zero; **seed idempotency** — run twice, row counts identical, an admin-edited `Setting.value` survives reseed; FK integrity (deleting a Course cascades translations, `SetNull` paths behave); unique constraints (`(locale, slug)` collision rejected); soft-delete convention (queries in fixtures exclude `deletedAt`).

**DoD:** `pnpm db:reset && pnpm db:seed && pnpm db:seed` green; schema ERD committed to docs.

## Module 02 — `@repo/theme`: theme engine

**Scope:** Port `theme-engine.ts` with fixes: **scope-resolution bug fixed** (exact scope beats `both`, deterministically); tokens emitted as **full hex values** (delete `rgbChannels`); font vars renamed `--brand-font-sans/mono`; `baseFontSize` added to `LayoutTokens`; curated font registry (ADR-005) mapping font keys → `next/font/local` families defined in `@repo/ui`; caching moved to `"use cache"` + `cacheTag("theme")` (ADR-004). Keep unchanged: `BrandColors`/`SurfacePalette`/`BrandOverrides` split, `deriveInteractive`, `readableOn`, blocking-vs-advisory validation, `BRAND_FIELD_REGISTRY`, `buildThemeStyleSheet`.

**Implementation prompt:** "Implement `packages/theme` per `.claude/skills/theme/SKILL.md`. The engine is pure functions + one cached loader; no React. Every derived value must be reproducible from (brand, surface, layout, overrides) alone. The loader returns defaults when no active theme row exists — the site must render branded on an empty database."

**Required tests (this package carries the heaviest unit suite, 90% floor):**

- Color math: `contrastRatio` against known WCAG reference pairs (e.g. #C28D5A/#FFFFFF ≈ 2.90); `shade` clamping; 3-digit hex expansion.
- `deriveInteractive`: for a table of brand colors on white and near-black, result ≥ target ratio and stays same-hue-family; out-of-headroom fallback path.
- **Scope resolution regression test:** rows `{scope: both}` + `{scope: web}` both active → web loader returns the `web` row; admin loader with only `both` present returns `both`. (The test that would have caught bug A5.1.)
- `validateTheme`: crafted palettes hitting each blocking rule and each advisory; `canSave` flips correctly; dark overrides applied before validation.
- **Property-based contract test** (fast-check): random valid palettes → every emitted `*-foreground` pair ≥ 4.5:1, ring ≥ 3:1.
- CSS snapshot: `buildThemeStyleSheet(defaults)` snapshot; asserts hex output (no channel triples) and `--brand-font-*` naming.

**DoD:** coverage ≥ 90%; snapshot reviewed; ADR-003/004/005 written.

## Module 03 — `@repo/rbac`

**Scope:** Port `rbac.ts` with: cache layer migrated per ADR-004 (tags `rbac:{userId}` unchanged); `auth()` import swapped to Better Auth session helper; `recordAudit()` implemented here or in `core` (decide via ADR) and required by rule for every mutation.

**Implementation prompt:** "Implement `packages/rbac` per its SKILL.md. Semantics are frozen: deny beats allow; STAFF gate precedes permission check; super_admin bypasses allow-list but **not** deny-list is FALSE — verify intended semantics: in the uploaded code a DENY on super_admin wins (deny checked first). Preserve exactly that: deny > super_admin > allow. `canAssignRole` enforces strict `<` on level. `requirePermission` throws typed errors; a shared error boundary maps them to 401/403."

**Tests (Vitest, 90% floor; Testcontainers for loader):** truth-table for `can()` covering: learner with role → false; staff no role → false; role grant → true; DENY override beats role grant; DENY beats super_admin; `canAny`/`canAll` edge cases (empty arrays); `canAssignRole` — equal level rejected, super_admin exempt, missing `permissions.assign` rejected; loader — deleted/inactive user → null subject; cache invalidation — role change + `invalidateSubject` visible on next read. **CI cross-check script:** every string passed to `requirePermission|requireAnyPermission|<Can permission=` in the repo exists in the seed permission registry (catches typo'd permission keys — the classic silent-403 bug).

**DoD:** coverage ≥ 90%; escalation tests documented in SKILL.md as frozen behavior.

## Module 04 — `@repo/auth`: Better Auth

**Scope (ADR-001):** Better Auth with Prisma adapter (MariaDB); email/password with **Argon2id via custom hasher**; Google + GitHub OAuth; email verification (required to comment/access premium, not to read); password reset (single-use, 30-min); **database sessions** with revocation; rate limiting via Redis secondary storage (sign-in/up/reset per-IP + per-account, exponential backoff lockout); plugins: admin (ban, revoke sessions, impersonate — gated behind `users.impersonate`), two-factor, bearer/JWT (configured, unrouted, for mobile). **Same-origin session handling per ADR-006:** cookie-scope separation between learner and staff is no longer available, so the compensating controls are part of this module's scope — `apps/web/proxy.ts` rejects `userType !== 'STAFF'` on `/admin/*` before any route or layout runs, the admin root layout re-checks server-side (the proxy is a gate, not the boundary), staff sessions get a shorter lifetime, and sensitive mutations (role/permission edits, impersonation start) require re-authentication.

**Implementation prompt:** "Implement `packages/auth` on Better Auth latest stable per its SKILL.md. Generate schema via `@better-auth/cli generate`, merge project fields (`userType`, `status`, `locale`, `timezone`, `themeMode`, lockout, `deletedAt`) as additionalFields, hand the merged models to Module 01. Session helper `auth()` exposed with the same call-shape the rbac package expects. Never store tokens in localStorage; httpOnly cookies only on web. Because both surfaces share an origin (ADR-006), the STAFF gate is enforced in `proxy.ts` **and** re-checked server-side — never assume the proxy ran."

**Tests:** integration (Testcontainers + route-handler harness): signup → verification email token round-trip → status flips ACTIVE; wrong password increments failure count, lockout after threshold with backoff; reset token single-use (second use 400) and expiry; session revocation — revoked session's next request 401 immediately (the plan's headline requirement); staff gate — LEARNER session hitting `/admin/*` → redirect/403, asserted both through the proxy and with the proxy bypassed (direct server-component/handler call), since same-origin means a learner session is already present; impersonation start/stop audited. E2E (Playwright): full credential + Google-mock sign-in flows across both surfaces.

**DoD:** all auth E2E green in CI; ADR-001 records the decision + fallback; rate-limit behavior documented.

## Module 05 — `@repo/settings` + feature flags

**Scope:** Typed settings reader/writer: `getPublicSettings(group)` / `getSetting(key)` cached per ADR-004 with tag `settings:{group}`; writes via server action guarded by `settings.update`, writing audit rows and revalidating; Zod schema per setting key in `@repo/contracts` (a Setting's `value` is validated against its declared type — an admin cannot save a number into an image slot); `isPublic` strictly enforced (non-public settings never serialize to client components — lint rule + test). Feature flags: `isFeatureVisible(key, subject|null)` honoring `visibility` dimension; disabled features 404 (not blank) via route guards; flags feed navigation building (Module 08).

**Tests:** reader returns typed values + defaults for missing keys; write → immediate read-after-invalidate consistency; **isPublic leak test** — a server-render harness asserts admin-only keys absent from RSC payload of public pages; flag matrix (enabled × visibility × subject type) truth-table; audit row on every write.

**DoD:** settings registry documented in SKILL.md; seeded keys cover Part A6 header/footer/legal additions.

## Module 06 — `@repo/i18n`

**Scope:** next-intl v4; routing per `MONOREPO_CONFIG §6` (`as-needed` prefix) but in `proxy.ts`; DB-driven active-locale list with the documented static/dynamic trade-off; message catalogs in `packages/i18n/messages/{locale}.json` with generated type-safe keys (missing key = TS error); content translation utilities: `sourceHash` computation + the OUTDATED flip on source change; fallback chain (locale → per-locale fallbackCode → default), with the Arabic rule (fallback to "not yet translated" notice rather than LTR English inside RTL layout) implemented as per-locale config, exactly as the architecture doc argues.

**Tests:** routing unit tests (default locale unprefixed, `/ar/...` prefixed, unknown locale → 404); fallback chain resolution table incl. the ar-no-fallback case; **sourceHash lifecycle** — edit English lesson → Spanish translation flips OUTDATED, translated again → TRANSLATED; catalog completeness script (non-default catalogs missing keys = CI warning, default catalog missing used key = CI error); RTL smoke suite defined in Part C wired here.

## Module 07 — `@repo/ui` + design system

**Scope:** shadcn CLI 3 init against the shared package (per `MONOREPO_CONFIG §4`, updated for CLI 3 monorepo flow); globals.css ported with fixes A5.2/A5.3/A5.5; curated `next/font/local` families (ADR-005); base components (button, input, dialog, dropdown, table, tabs, toast/sonner, form primitives wired to Zod v4 via react-hook-form resolver); `DataTable` (TanStack Table v8: server pagination/sort/filter, column visibility, selection, bulk actions, CSV export); logical properties only (`ps-/pe-/ms-/me-/text-start`) — lint rule bans physical `pl-/pr-/ml-/mr-` in ui and apps.

**Implementation prompt:** "Initialize shadcn via current CLI into `packages/ui`; do not hand-copy stale component source. Apply globals.css with the review fixes (map `--color-*` to full-value vars, `--font-sans: var(--brand-font-sans)`, add line-height pairs). Every component consumes semantic tokens only — a hex literal in `packages/ui` fails lint. Keep granular exports so Button doesn't pull TanStack."

**Tests:** RTL rendering test per layout-bearing component (`dir=rtl` container, assert start/end alignment); axe on a kitchen-sink page of all components (both modes, both directions); `DataTable` interaction tests (sort/filter/select/export call server callbacks correctly); visual snapshot of kitchen-sink under default theme + one alternate theme (proves token indirection actually works); focus-visible ring present on every interactive component (keyboard-tab test).

**DoD:** kitchen-sink route in a private storybook-style page at `/admin/_dev/kitchen-sink` (dev-only, staff-gated); zero physical-property utilities in repo.

## Module 08 — Navigation & header/footer runtime

**Paused (2026-09-06, ADR-038):** the admin menu-reorder screen
(`/admin/navigation`) is hidden from the Settings hub/sub-nav pending the
owner's move to module-by-module/static site design. `buildNavigation()`
and the public header/footer are untouched — menus keep rendering from
their current `Menu`/`MenuItem` rows exactly as before.

**Scope:** `buildNavigation(menuKey, locale, subject|null)` in `@repo/core`: reads menu tree (cached, tag `navigation`), filters by `isActive`, `visibility`, `requiresFeature` (flags), `requiresPermission` (staff menus), resolves translations with fallback, resolves `routeKey` vs external `url` (exactly-one rule validated by contracts). Public `Header` (logo per mode from `BrandAsset`, main menu with 2-level dropdowns, locale switcher, theme-mode toggle — user-controlled per A5.4, auth state slot, admin-configured CTA, optional announcement bar) and `Footer` (admin-ordered footer menus as columns, `SocialLink` active set in sortOrder, translatable copyright with `{year}`, risk-disclaimer legal setting) as server components in `@repo/ui`/app-level composition.

**Tests:** nav builder truth-table (inactive item pruned; feature-flag-off pruned; permission-gated pruned for learner, present for staff; parent with all children pruned is itself pruned); translation fallback on labels; exactly-one of url/routeKey enforced by contract test; E2E — admin reorders a menu item → public header reflects it without redeploy (tag invalidation round-trip, the demo that proves the whole architecture); a11y: header nav passes axe, keyboard-operable dropdowns, `aria-current` on active item.

## Module 09 — Admin shell, settings screens, theme editor

**Paused in part (2026-09-06, ADR-038):** the theme editor's Layout &
Display tab (border radius, container width, base font size, curated font
pickers) and the Settings → Layout group (header/footer/homepage
structural settings) are hidden pending the owner's move to
module-by-module/static site design. Colors & Branding, Theme Modes,
Presets and Logos & Favicon are unaffected and fully live — this is a
partial pause of the theme editor, not the whole screen.

**Scope:** Admin shell as the `(admin)` route-group root layout (ADR-006) — `export const dynamic = "force-dynamic"`, server-side STAFF re-check, sidebar from a permission-filtered admin menu, breadcrumbs, command palette optional, settings CRUD screens generated from the settings registry (type-driven field rendering: STRING/TEXT/NUMBER/BOOLEAN/JSON/IMAGE/COLOR/SELECT), navigation manager (drag-reorder, nested ≤2, translation side-panel), social links manager, feature flag screen, **theme editor**: tabs per `theme-engine.ts` header (Colors & Branding from `BRAND_FIELD_REGISTRY`, Layout & Display, Theme Modes side-by-side light/dark with live preview iframe, Logos & Favicons via `BrandAsset` upload), inline `validateTheme` results (blocking errors disable save; advisories shown with derived-value remedy text), preset save/switch/activate with instant rollback, per-scope activation with the fixed resolution rule.

**Tests:** E2E per screen: happy path + **permission-denied path** (user without `theme.update` gets 403 and no mutation — asserted at DB level, not just UI); theme editor E2E — set a failing palette → save disabled with correct issue list; set passing palette → save → public surface (second browser context, unauthenticated) shows new brand after reload without deploy; preset switch round-trip; settings write appears in audit log; every screen axe-clean.

## Module 10 — Users, roles, employees

**Scope:** Users list/detail on shared DataTable (filters, bulk activate/deactivate/assign-role/export; row actions permission-gated — Support sees reset-password, not delete); role manager (system roles clone-only; `canAssignRole` level guard enforced server-side; permission matrix editor grouped by `groupName`); per-user permission overrides UI with DENY reason field (audited); employees module (CRUD, department/designation admin, org-chart from `reportingToId`, offboarding flow: employee → TERMINATED while user deactivated + sessions revoked, in one server action, transactional).

**Tests:** integration — escalation attempts rejected (Editor granting Admin-level role → 403 + no write; self-demotion of last super_admin blocked); offboarding transaction atomicity (fault-injection: revocation failure rolls back status change); DataTable server-side pagination/sort correctness against seeded fixtures; export CSV matches filtered set; E2E happy paths + denied paths per screen.

## Module 11 — Content system (courses, lessons, glossary, media)

**Scope:** `@repo/core` services + admin CRUD for Course/Module/Lesson/Glossary with translation workflow (status machine per `ContentStatus`; publish requires `*.publish`; OUTDATED queue screen), rich-text editing with **Tiptap** (locked, Part F #8 — open-source core only; sanitize on save server-side), new `MediaAsset` model + S3 upload (presigned, type/size validated, image variants), `ContentRelation` linking UI, per-locale slugs with redirect creation on slug change (writes `Redirect` row automatically — the SEO-preserving detail that's cheap now and painful later).

**Tests:** service-level status-machine tests (illegal transitions rejected: DRAFT→PUBLISHED without APPROVED, publish without permission); sanitization (script-tag payload in content is stripped — XSS regression suite); slug change → old slug 301s (E2E); translation OUTDATED flow E2E; media upload rejects oversized/wrong-MIME; soft-delete + restore round-trip.

## Module 12 — Public site

**Paused in part (2026-09-06, ADR-038):** the homepage section
order/enable/variant editor (`/admin/homepage`) is hidden pending the
owner's move to module-by-module/static site design. It edits one setting
(`home.sections`); the setting's current value keeps rendering the
homepage exactly as before — only its admin editing screen is
unreachable while paused.

**Scope:** Homepage assembled from admin-configured sections (section registry: hero, featured courses, latest analysis, market ticker, CTA — order/visibility from `layout` settings), learn area (course → module → lesson with prerequisites), glossary (A–Z, categories, per-locale slugs), static pages from new `Page` model, SEO (metadata from settings + per-translation fields, `sitemap.ts` per locale from published content, `robots.ts`, canonical + hreflang pairs, JSON-LD for courses/articles), ISR with tags per Part A caching table, Core Web Vitals budget (LCP < 2.5s on lesson page, enforced by Lighthouse CI budget file).

**Tests:** E2E user journeys (browse course → lesson, glossary search, locale switch preserving route where translation exists / fallback notice where not, dark-mode toggle persists across reload); hreflang/sitemap correctness snapshot; disabled feature 404s (not blank); Lighthouse CI budgets blocking; full axe + RTL suites from Part C.

## Module 13 — Market layer

**Scope:** Provider abstraction in `@repo/core` (interface + AlphaVantage impl; swappable via `MARKET_DATA_PROVIDER`), Redis-cached live rates (TTL = provider refresh; **never** persisted per-tick, per the architecture doc's warning), historical series persistence for charts, economic calendar sync (new models), calculators (pip value, position size, margin — pure functions in `@repo/utils`), admin config screens gated by `market.*`.

**Tests:** calculators — pure-function tables against hand-computed values (90% floor); provider adapter contract test against MSW-mocked API incl. rate-limit and malformed-payload handling (degrade to stale-cache, never crash the page); Redis TTL behavior; calendar sync idempotency.

## Module 14 — Hardening & launch gate (cross-cutting, runs alongside 09–13)

**Scope:** Security headers + CSP (nonce-based, works with the injected `<style id="brand-tokens">` — style element gets the nonce; document in security.md), **per-path policy: stricter CSP and headers on `/admin/*` than on public routes, since both share an origin (ADR-006)**; path-based admin protection at the edge/reverse proxy (IP allowlist / WAF rule on `/admin/*` rather than a hostname); dependency audit in CI (`pnpm audit` + Renovate), backup/restore runbook for MariaDB, error tracking (Sentry latest) + structured logging, load smoke (k6 on lesson page + admin login), pen-test checklist pass (OWASP ASVS L1 self-audit: IDOR probes on every `[id]` route, mass-assignment via contracts-only parsing, SSRF on media fetch).

**Tests/gate:** CSP report-only soak then enforce; IDOR automated suite (authenticated-as-A requests B's resources across all admin APIs → 403/404) **plus the cross-surface probe: an authenticated LEARNER session against every `/admin/*` route and admin API handler → 403/404, never 200**; the full CI matrix green; Lighthouse budgets green (blocking — this is the bundle-isolation backstop under one app); **launch checklist in DEVLOG signed off**.

## Module 15 — News & Analysis (articles)

Added after this document was written; spec'd by
`docs/news-analysis-module-plan.md` as reconciled by **ADR-015**, standards
in `.claude/skills/articles/`. Comments are designed but unbuilt (ADR-019).

## Module 16 — Website builder (CMS)

> **CANCELLED 2026-09-07 — ADR-042** (supersedes the ADR-037 pause). This
> module is withdrawn: no resume path, no further work planned against it.
> `docs/MBX-Dynamic-Site-Control-Plan-v2.md` is history, not a forward plan.
> The scope below is retained as the record of what was built (Phases 1–3
> plus PR 4.3) — the code, models, seeded rows and permissions all still
> exist and are not to be deleted without a further ADR. Read ADR-042 first.

**Scope:** admin-designed public pages **and the global site layer** — one
`Page` model with five kinds (STATIC / COLLECTION / DETAIL / DATA / PART;
`PART` = header, footer, announcement, top bar, mobile nav, mega-menu
panels, per ADR-027, with per-page overrides and menu items extended by
ADR-028), a versioned JSON block tree, a closed
block registry (`@repo/blocks`, the only new package), content/data
providers wrapping the services that already exist, card templates by
reference, and a form-based composer with the visual canvas gated behind a
spike. Plan: `docs/MBX-Dynamic-Site-Control-Plan-v2.md` (v2.2 — §12 has
per-PR checklists, §18 an ADR → touchpoint index). Binding decisions:
**ADR-020…ADR-034** (v2.1 adds ADR-030 widget registry, ADR-031 link targets, ADR-032 node schema, ADR-033 reuse model, ADR-034 media v2). Module 08's navigation/header/footer are **extended,
not replaced** — they remain the fallback rendering path. Repo facts: `docs/cms/00-reconciliation.md`. Standards:
`.claude/skills/website-builder/SKILL.md`.

**Paused (2026-09-06, ADR-037):** admin UI (sidebar/settings entry point,
composer, media-library screen) hidden pending owner request to resume; no
further development in the interim. Code, DB tables/data and the public
renderer are untouched — the homepage and `/news` keep rendering from their
already-published `PageVersion` rows. The status below reflects progress at
the moment of pausing, not current work.

**Status (2026-09-05): Phases 1–2 complete.** Phase 1: `Page`/
`PageTranslation`/`PageVersion`/`ContentReference` migrated and seeded;
`packages/core/src/cms/*` services (CRUD, nested-path derivation with
redirect + shadow handling, the draft optimistic lock, publish/unpublish/
rollback); the public catch-all (`(public)/[locale]/[...slug]/page.tsx` —
a **required** catch-all, not optional, per plan §12 PR 1.4) with
`/api/preview`; `/admin/website/{pages,redirects}` admin screens. Phase 2:
`@repo/blocks` (the one new package, ADR-020) — `defineBlock`/registry,
the two-pass collect→resolve→render pipeline (ADR-029), 25 registered
blocks (24 layout/content + the generic `widget` dispatcher, ADR-030), the
full node/style/responsive/link/widget contracts (ADR-024/031/032) in
`@repo/contracts`; the shared `LinkTarget` resolver
(`@repo/core/src/cms/links.ts`, ADR-031) also powering `buildNavigation`;
real `collectReferences()` (ADR-033 §4); the homepage now renders from a
published `PageVersion` behind `[locale]/page.tsx`'s fallback switch —
hero, newsletter, FAQ and the risk disclaimer are CMS-authored content,
verified against a real dev server end to end (including resolved
`ROUTE` links and the `/es` fallback path). 191/192 `@repo/core` tests
green throughout (the one failure is the same unrelated pre-existing
Module 02 regression, flagged separately every entry). Deliberately
incomplete: the CMS homepage is missing `latest_analysis`/
`glossary_spotlight` until Phase 4's `collection` block lands (accepted —
no production deployment exists yet, plan §5.2). Phase 3 (composer,
preview, translations, Media v2, the Puck spike) is in progress: PR 3.1
(`StylePreset`/`LayoutTemplate`, ADR-033, `/admin/website/{styles,
templates}`) and PR 3.2 (Media v2, ADR-034 — `storeMedia()`, HTTP Range
serving, replace/soft-delete, `/admin/website/media`) are done. PR 3.2
shipped `deleteMedia`'s usage guard wired only for CMS pages
(`PAGE_VERSION`); ADR-035 (same day) closed that for Article (cover +
per-locale OG image) and BrandAsset (logo/favicon), leaving Setting
(`site.faviconUrl`/`seo.defaultOgImage`) and MenuItem/Course usage
deliberately unwired — the former costs more than two settings justify,
the latter have no write path yet to hook into (see ADR-035 for the full
reasoning, DEVLOG 2026-09-05). PR 3.3 (composer core) is done: the
composer at `/admin/website/pages/[id]/builder` — tree/layers, block
picker, settings panel generated from each block's new `fields` metadata,
undo/redo, autosave with a revision-based conflict toast, gates surfaced
inline, "Use style/Save as style/Save as template." Two prerequisites
landed with it: the catch-all public route renders real layouts for the
first time (was a Phase-1 placeholder), and `resolveMediaUrl` became a
real batched `resolveMediaUrls` now that Media v2 exists. Verified against
the real seeded homepage, not just a scratch page. Reorder is up/down
buttons, not drag — the drag precedent ADR-026/the plan both cite doesn't
actually exist in this repo (checked). PR 3.4 (gates + data budget) is
done: `runPublishGates` (moved to `packages/core/src/cms/gates.ts`, now
async — two checks need the DB) grew from Phase 1's bare schema check
into heading order, the ADR-032 §2 overlay gate, style-preset existence,
and the `cms.dataBudget` block/warn thresholds (seeded, ADR-029 §5's own
numbers); duplicate anchors, depth > 3, and empty translatable props warn
without blocking. Two of the plan's eight named checks (dangling
`bindingId`, missing card template) and the budget's blindness to widget
needs are honestly unimplemented — nothing exists yet for them to check
(Phase 4/a widget registry), named in DEVLOG rather than faked. Verified
live: a heading-order violation appeared in the composer's gate panel
within one autosave cycle and cleared on the next after fixing it. PR 3.5
(preview/versions/translations) is done: a device-width toggle
(375/768/1440) above the existing live preview; a Versions panel (publish
history with resolved author names, "Restore as draft" per version,
"Discard draft"); a Translations panel (every string-typed translatable
field × every non-default locale, MISSING badges, inline editing).
`restoreVersionAsDraft`/`discardDraft` deliberately bypass the ADR-032 §6
optimistic lock — one-shot explicit admin actions, not a concurrent-
editing race. Scoped down, named in DEVLOG: "preview any version through
draft mode" became restore-then-preview (a version-parameterized preview
pipeline is real, separate plumbing not built here); Translations shows
MISSING only, not OUTDATED (no source-hash mechanism exists yet). A real
UI bug found live — both version-panel confirm dialogs read "Delete"
(a copy-paste of the block-delete dialog's shared label) — was fixed and
re-verified in the browser. Verified against the real seeded homepage,
including a full sign-out/reload round-trip proving a translation edit
persists server-side. PR 3.6 (SEO suggestions + JSON-LD) is done:
`buildPageSeo` (`packages/core/src/cms/seo.ts`, pure tree-walking, no DB)
— explicit `PageTranslation` fields win, else title/description/OG image
are suggested from the page's first heading/paragraph/image, locale-aware,
matching the renderer's own translation-merge order; JSON-LD (`WebPage` or
an admin-set `schemaType`) on the catch-all route and, opportunistically,
`[locale]/page.tsx` (Home) — a real pre-existing gap: Home had zero
CMS-driven metadata despite `home` having real SEO fields since Phase 1.
Named scope cut: hreflang alternates need a `PublicPageRow` lookup change
not built here. Verified against the real seeded homepage and a scratch
page via `curl`, both the suggestion path and the explicit-override path.
PR 3.7 (Puck spike) is done, resolved **reject** (ADR-036): 4 of ADR-026's
5 gates pass cleanly or with only a named, containable future CSP risk (an
un-nonced `<style>` tag in Puck's canvas-iframe CSS mirroring — irrelevant
under today's report-only, nonce-less public CSP); the fifth (real render
fidelity against this repo's `fields` vocabulary) can't be verified without
installing Puck, which ADR-026 forbids before this ADR exists. Real
evidence throughout — `npm view`/`npm pack`/a scratch dry-run install
pinned to React 19.2.8, all outside this repo, deleted afterward; `git
status` confirms zero dependency trace. Correction to the record: Puck's
real `latest` is 0.20.2, not "0.23.x." Not permanent — the composer already
delivers everything ADR-026 asked of it and nothing later in this plan
depends on a canvas, so revisiting is optional. **Phase 3 is complete**
(PR 3.1–3.7). Phase 4 (dynamic collections, card templates, content-type
registry) is in progress: PR 4.1 (providers) is done —
`CollectionProvider`/`DataProvider` in `@repo/contracts`, `news`/
`analysis`/`trade-idea`/`glossary` providers in `packages/core/src/cms/
providers/` composing the existing article/glossary services (never
re-deriving their visibility rules), a `collectionProviders` registry in
`apps/web/app/_cms/registry.ts`, a 9-test conformance suite including the
ADR-022-named "equals `getPublishedArticles`" test. No premium-item
filtering added — `Article.isPremium` isn't enforced anywhere publicly
today and `FeatureVisibility.PREMIUM` means staff-only here (ADR-012),
so conflating the two would be wrong; the real visibility rule is already
enforced upstream by the renderer. From this PR on, verification leans on
integration tests over live-browser sessions for PRs with no new UI
surface — Phase 4 alone is 6 PRs and the user has asked to proceed through
all remaining phases, so matching Phase 3's full ceremony on every PR
isn't sustainable; live checks resume for PRs that ship something visible.
PR 4.2 (collection blocks) is done: `collection`/`featured-content`/
`collection-filter`/`collection-search`/`collection-sort`/
`collection-pagination`, a real Pass 0 in `render.tsx` resolving each
`collection` node's canonical query via a new injected
`resolveBindingQuery` so companion blocks sharing a `bindingId` dedupe
onto the same result, the dangling-`bindingId` WARN gate. Two real
live-browser-only bugs found and fixed: a `"use client"` block's
`registerBlock()` call never reaching the server registry (split into
`index.tsx` + `client.tsx`), and a function-valued prop crashing any
client component even unused (a new `BlockDefinition.client` flag).
Verified live: a real published article rendering through a `collection`
block, and a real search narrowing/clearing results on the published
public route. PR 4.3 (card templates) is done: `CardTemplate` model +
migration, `cardConfigSchema`, `core/cms/cards.ts` mirroring `styles.ts`'s
exact deletion-guard shape over `ContentReference` (a Phase 2 seam that
needed no change), 4 seeded system templates (`standard`/`featured`/
`compact` checked against `article-list.tsx`'s real code; `horizontal`
built new), `/admin/website/cards` with a real live preview reusing the
public renderer's own `renderCard()`. `collection`/`featured-content`
bumped to schema v2 (`cardTemplateId`) and render through one shared
`card/render-card.tsx`. Verified live: switching a real collection
block's card template between two seeded templates re-rendered two real
published articles into different layouts instantly. PR 4.4 (`/news` as
a COLLECTION page) is next.

This supersedes `docs/MBX-Dynamic-Site-Controle-Plan.md` (v1), which
proposed eight new packages, twelve new models and a two-app topology
against decisions this repo had already locked (ADR-003/004/006/011/012/
015/017/018). The review is `docs/changes/dynamic-site-plan-review.md`.

**Tests:** renderer suite runs with no database (90% floor on
`@repo/blocks`); provider conformance suite; publish-gate refusals;
tag-invalidation integration tests; the authoring and publish-an-article
E2E journeys; the gate extensions in ADR-024 §4 (combination-contrast,
all-blocks axe fixture, Lighthouse on a worst-realistic page).

---

# PART E — UPDATED BUILD ORDER

| Phase                 | Weeks | Modules                             | Exit criteria                                                                   |
| --------------------- | ----- | ----------------------------------- | ------------------------------------------------------------------------------- |
| 0 — Foundation        | 1–2   | 00, 01, 02, 03, 04 (+ Part C infra) | CI matrix green; theme/rbac ≥90% coverage; auth E2E green; ADR-001..005 written |
| 1 — Platform services | 3     | 05, 06                              | settings/i18n suites green; RTL smoke wired                                     |
| 2 — UI & admin shell  | 4–5   | 07, 08, 09                          | theme-editor round-trip E2E green (the architecture's proof-of-concept demo)    |
| 3 — People            | 6     | 10                                  | escalation + offboarding suites green                                           |
| 4 — Content           | 7–9   | 11                                  | status-machine + XSS suites green                                               |
| 5 — Public site       | 10–12 | 12                                  | journeys + Lighthouse budgets green                                             |
| 6 — Market            | 13–14 | 13                                  | provider contract + calculator suites green                                     |
| 7 — Website builder   | —     | 16                                  | plan v2 Phases 1–6 (MVP): homepage, `/news`, article detail + global site layer |
| — Continuous          | all   | 14                                  | launch gate                                                                     |

Two changes vs the original phasing: **testing/governance is Phase 0 work, not an afterthought** (the original plan had no test line at all), and Module 08 (navigation runtime) moved ahead of the admin shell so the header/footer requirement is proven end-to-end early.

**Deployment (revised, ADR-006):** one application deploys, not two. Public and admin ship together on the same release; a change to an admin screen redeploys the public surface too. Turborepo's cache still avoids rebuilding untouched _packages_, but the app-level "admin change doesn't rebuild web" benefit is gone — accepted deliberately. `packages/db` migrations remain a separate pre-deploy step, run once. Admin network restrictions become path-based on `/admin/*`; if host-level isolation is ever needed, the same app can be served at `admin.<domain>` via a host rewrite with no code change.

# PART F — KICKOFF DECISIONS (status as of 31 Aug 2026)

| #   | Decision               | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Record                                                                      |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Auth library           | **OPEN — Better Auth recommended**; 2-day compatibility spike (MariaDB adapter, Argon2id hasher, admin/2FA plugins), then lock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ADR-001 (write after spike, day 2–3)                                        |
| 2   | Prisma 7 vs 8          | **RESOLVED (Day 1, 31 Aug 2026)** — Prisma 8 is still `8.0.0-rc.12`; `@prisma/client` stable is 7.10.0. **Locked to Prisma 7.10.x.** Revisit after 8.0 GA.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ADR-002                                                                     |
| 3   | App topology           | **LOCKED (revised 31 Aug 2026)** — **one** Next.js app at `apps/web` containing both surfaces as `(public)` and `(admin)` route groups, each with its own root layout. `apps/admin` is not created. Packages-first structure unchanged so `apps/mobile` / `apps/desktop` drop in later; platform-specific UI goes in new packages (e.g. `packages/ui-native`), never by coupling shared packages to Next.js.                                                                                                                                                                                                                                                                 | ADR-006                                                                     |
| 4   | Launch locale          | **LOCKED** — English (`en`) only at launch; i18n + RTL machinery built and tested from Phase 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ADR-007                                                                     |
| 5   | Dark/Light mode        | **LOCKED** — user-controlled; admin cannot disable or override; `Theme.allowUserToggle` removed (A5.4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ADR-008                                                                     |
| 6   | Theme branding         | **LOCKED** — admin-controlled dynamic branding via theme engine; hover/active colors remain derived, never directly editable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ADR-003                                                                     |
| 7   | Fonts                  | **LOCKED** — curated self-hosted fonts only (allowlist via `next/font/local`); no arbitrary font URLs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ADR-005                                                                     |
| 8   | Rich-text editor       | **LOCKED: yes, WYSIWYG editing** — library: **Tiptap** (open-source MIT core; the consensus default for CMS/admin content in React as of 2026; ProseMirror-based, mature extension ecosystem, works headless with shadcn styling). Free core only — no paid cloud add-ons in v1. Server-side sanitization on save is mandatory regardless of editor.                                                                                                                                                                                                                                                                                                                         | ADR-009 (Phase 4 kickoff: pin exact version, confirm React/Next peer range) |
| 9   | Exact package versions | **LOCKED process** — pinned in `docs/memory/stack.md` on kickoff Day 1 after a registry sweep; plan names version lines only. Day-1 sweep done 31 Aug 2026; three of the plan's own stated lines had already moved (pnpm 10→11, Node 22→24, TypeScript 5.9→6.0.3-not-7).                                                                                                                                                                                                                                                                                                                                                                                                     | `stack.md`, ADR-010                                                         |
| 10  | Architecture changes   | **LOCKED rule** — any deviation from this plan requires an ADR _before_ the code; enforced by `governance:check` + review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `.claude/rules/architecture.md`                                             |
| 11  | Website builder (CMS)  | ~~**LOCKED (4 Sep 2026)** — Module 16 ships as `docs/MBX-Dynamic-Site-Control-Plan-v2.md`: one new package (`@repo/blocks`), four new models, provider registry, token-only authored styling, renderer before canvas. v1 (`MBX-Dynamic-Site-Controle-Plan.md`) is superseded history and must not be implemented from.~~ **Update 2026-09-07 — UNLOCKED AND CANCELLED (ADR-042).** The programme is withdrawn: v2.2 joins v1 as history and neither is to be implemented from. Built code, models, seeded rows and permissions are retained (deleting them needs its own ADR); ADR-020…036 stand as accurate history with no forward force. The replacement position is #12. | ADR-042 (supersedes ADR-037/038; ADR-020…036 = history)                     |
| 12  | Site design ownership  | **LOCKED (7 Sep 2026)** — site design (layout structure, navigation, homepage composition, theme layout tokens and fonts) is built module-by-module in code or statically, never through admin-configurable dynamic composition. Only content _data_ is dynamic and admin-managed. Changing menu order, homepage composition or layout tokens is a code change, permanently.                                                                                                                                                                                                                                                                                                 | ADR-042 (philosophy first stated in ADR-038)                                |

**Kickoff Day 1–3 sequence:** (1) Day 1 morning — ~~Prisma 8 GA check~~ **done**: 8 is still RC → ADR-002 locks Prisma 7.10.x; `stack.md` written with exact pins; ADR-010 pins TypeScript 6.0.3 over the TS 7 native compiler. (2) Day 1–2 — Better Auth spike (schema generation against MariaDB, Argon2id custom hasher, session revocation round-trip). (3) Day 2–3 — ADR-001 locked either way; Module 00 scaffold proceeds in parallel since it's auth-agnostic. Only Module 01's auth tables wait on ADR-001.

**Architecture revision (31 Aug 2026):** app topology changed from two apps to one before any feature code was written — ADR-006. The change was made during Module 00, so no module has been implemented against the superseded shape; nothing needs unwinding.
