# Forex Learning Portal — Monorepo Architecture

> Revised 2026-08-31 per ADR-006 (single-app) and the Day-1 version sweep.

**Stack:** Turborepo 2.10 + pnpm 11.24 · Node 24 LTS · Next.js 16.3 (App Router) · React 19.2 · TypeScript 6.0.3 · shadcn/ui · Tailwind CSS 4.3 · MariaDB (Prisma 7) · next-intl 4 · Better Auth

**Scope now:** Web only — **one** Next.js app carrying both the public site and the admin portal, separated by route groups with their own root layouts (ADR-006).
**Scope later:** Mobile (Expo) and desktop (Tauri/Electron) join as siblings of `apps/web` and reuse the same packages without touching app code.

---

## 1. Why a monorepo, and what actually goes in it

The rule that makes future mobile/desktop cheap: **apps contain routing and rendering only. Everything else lives in packages.**

If a piece of logic would need to be rewritten for a React Native screen, it is in the wrong place. Data access, permission checks, validation schemas, theme resolution, and translation loading are all package-level concerns.

```
mbx-learning-center/
├── apps/
│   └── web/                        # The one app: public site + admin portal
│       ├── app/
│       │   ├── (public)/           # own <html> root layout — locale, dir, theme
│       │   │   ├── layout.tsx
│       │   │   └── [locale]/…      # learn, tools, markets, analysis
│       │   ├── (admin)/            # own <html> root layout — force-dynamic
│       │   │   ├── layout.tsx
│       │   │   └── admin/…         # /admin/* — CMS, settings, users, employees
│       │   └── api/                # thin route handlers → packages/core
│       ├── proxy.ts                # Next 16 (was middleware.ts): i18n + STAFF gate
│       └── next.config.ts
│                                   # later, as siblings: apps/mobile (Expo),
│                                   # apps/desktop (Tauri/Electron) — see §1.1, §9
│
├── packages/
│   ├── db/                   # Prisma schema, client, migrations, seeders
│   ├── auth/                 # Better Auth config, session, tokens for native clients
│   ├── rbac/                 # Permission registry + can() evaluator
│   ├── ui/                   # shadcn/ui components (shared, themable, web-only)
│   ├── theme/                # Theme engine: DB tokens → CSS variables
│   ├── i18n/                 # next-intl config, message catalogs, locale utils
│   ├── core/                 # Domain services (courses, glossary, tools, market)
│   ├── contracts/            # Zod schemas + shared TS types (API contract)
│   ├── settings/             # Settings registry, cached readers, feature flags
│   └── utils/                # Formatting, slugs, dates, currency, colors
│
├── tooling/
│   ├── eslint-config/        # flat config, shared
│   ├── typescript-config/    # shared tsconfig bases
│   └── tailwind-config/      # Shared preset consumed by ui + the app
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 1.1 One app, two root layouts

Public site and admin ship as a **single Next.js app** with route groups that each own an `<html>` root layout — `app/(public)/layout.tsx` and `app/(admin)/layout.tsx`. Admin URLs are `/admin/*`. This is the multiple-root-layouts pattern: the two surfaces share a runtime without sharing a shell. The decision is recorded and locked in **ADR-006**; `apps/admin` does not exist.

An earlier revision of this document argued for two apps, and the argument was not frivolous — it bought four things. Deleting it would hide what was traded, so here it is, with what replaces each item.

- **Bundle isolation.** Admin ships a rich-text editor (Tiptap), TanStack Table, color pickers and chart config UI; none of it belongs in the dependency graph of pages judged on Core Web Vitals and SEO. Next.js code-splits per route, so those land only in `(admin)` chunks _as long as nothing in `(public)` or a shared module imports them_. That "as long as" is the whole cost: what a separate app enforced by construction is now enforced by rules. `.claude/rules/architecture.md` bans importing admin-only modules from `(public)` or from shared app-level code, an ESLint `no-restricted-imports` boundary rule enforces it mechanically, and Lighthouse CI budgets on public routes become a **blocking** gate — the backstop for a leak the lint rule misses.
- **Different rendering profiles.** Public is mostly static/ISR with cache tags; admin is entirely dynamic and authenticated. The `(admin)` root layout sets `export const dynamic = "force-dynamic"`. Mixing profiles turns out to be a per-segment config problem, not an app-boundary problem.
- **Different deploy cadence and access.** One deployment instead of two independent ones. Admin can no longer be protected by _hostname_ at a WAF/IP allowlist; protection becomes **path-based** on `/admin/*` at the edge or reverse proxy. If host-level isolation is later required, the same app can be served at `admin.<domain>` through a host rewrite, with no code change.
- **Separate auth cookie surfaces.** This one is genuinely lost, and it is the real cost. Learner and staff sessions now share an origin, so cookie-scope isolation no longer reduces blast radius. The compensating controls in §5.3 are mandatory, not optional.

What the apps used to share, they now simply are: one database, one set of design tokens, one UI package, one visual identity.

Nothing here forecloses splitting later. Because all logic lives in `packages/*`, promoting `(admin)` into its own app is mechanical rather than a rewrite — see §11.2.

### 1.2 Do you need `apps/api`?

**Not yet.** For web-only, Next.js Route Handlers and Server Actions inside the app are enough, and adding a second runtime is cost with no benefit today.

**When mobile arrives**, you have two options, and the architecture supports both:

- **Option A (recommended):** promote `apps/web/app/api/v1/*` — the versioned handlers in the one app — into a public API. Handlers stay thin: they call `packages/core` services, which already contain the logic.
- **Option B:** add `apps/api` (Hono or NestJS) as a sibling of `apps/web` that imports the same `packages/core` and `packages/db`. Zero logic duplication because the services already exist.

The decision is deferred safely as long as route handlers never contain business logic.

---

## 2. Dynamic theming with shadcn/ui

This is the part most teams get wrong. shadcn/ui is not a component library you install — it is source code copied into your repo, styled entirely through CSS variables. That makes it an unusually good fit for admin-controlled branding.

### 2.1 How it works end to end

```
Admin edits colors  →  themes table (MariaDB)
                    →  revalidateTag('theme')
                    →  Each root layout (RSC) reads active theme
                       — (public) and (admin) resolve it independently
                    →  Renders <style> with :root{} and .dark{}
                    →  Tailwind utilities + shadcn components pick it up
```

No client-side flash, no hydration mismatch, no rebuild. Changing the primary colour is a database write.

### 2.2 Token mapping

The MBX Pro design system defines brand tokens. shadcn expects semantic tokens. The theme engine maps one to the other, so both vocabularies work:

| MBX Pro token              | shadcn variable          | Notes                                 |
| -------------------------- | ------------------------ | ------------------------------------- |
| `primary` `#C28D5A`        | `--primary`              | Buttons, links, active states         |
| `text-inverse` `#FFFFFF`   | `--primary-foreground`   | Auto-computed for contrast            |
| `background` `#FFFFFF`     | `--background`           |                                       |
| `text-primary` `#1A1A1A`   | `--foreground`           |                                       |
| `surface-light` `#F8F8F8`  | `--muted`, `--secondary` |                                       |
| `text-secondary` `#666666` | `--muted-foreground`     |                                       |
| `accent` `#EAE5DE`         | `--accent`               | Sidebar active, subtle highlights     |
| `border-light` `#E5E5E5`   | `--border`               |                                       |
| `border-medium` `#D0D0D0`  | `--input`                |                                       |
| `success` `#3382E2`        | `--ring`, `--success`    | Focus ring uses success blue per spec |
| `error` `#E23C36`          | `--destructive`          |                                       |
| `warning` `#FFA310`        | `--warning`              | Custom, not in stock shadcn           |
| `info` `#004284`           | `--info`                 | Custom                                |
| `radius-md` `4px`          | `--radius`               | Drives all component corners          |

`--primary-foreground` and friends are **derived**, not stored. The engine computes relative luminance and picks white or near-black, so an admin who sets a pale primary doesn't produce invisible button text. This is an accessibility guardrail, not a convenience.

### 2.3 Light and dark are two token sets, not an inversion

The `themes` table stores `lightTokens` and `darkTokens` as separate JSON columns. Naively inverting a light palette produces muddy, low-contrast dark mode — brand colours in particular need to be lifted in dark mode, not flipped.

The admin UI edits both, side by side, with a live preview and a contrast checker that flags any pair falling below WCAG AA (4.5:1 for text, 3:1 for UI). Saving is blocked on failures rather than warned about, because a warning gets clicked past.

`next-themes` handles the class toggle (`.dark` on `<html>`), with the mode persisted per user and defaulting to the admin-configured site default.

### 2.4 Theme presets

Admins can save named presets and switch between them. `themes` rows have `isActive` — exactly one is active per scope, where a scope is a surface (`public`, `admin`) rather than a deployed app now that there is only one of those. This gives seasonal branding, A/B tests, and instant rollback if a colour change goes wrong.

**Implementation files:** `packages/theme/` — see `theme-engine.ts` and `globals.css` in the code bundle.

---

## 3. Settings: everything else the admin controls

Colours are one slice. The `settings` table is a typed key-value store covering the rest.

```
settings
├── group          "general" | "seo" | "social" | "features" | "layout" | "legal"
├── key            "site.name", "seo.titleTemplate", "features.forums"
├── value          JSON — string, number, boolean, object, or array
├── type           "string" | "boolean" | "number" | "json" | "image" | "color"
├── isPublic       exposed to the public site bundle, or admin-only
└── isTranslatable whether value is a per-locale map
```

Reads go through `packages/settings`, which caches the query under the tag `settings:{group}` (see §8 for the caching primitive). A write from the admin calls `revalidateTag`, so both surfaces see the change on the next request without a deploy. Secrets (API keys) never live here — they are environment variables, referenced by name.

### 3.1 Feature flags

Feature flags are settings with a visibility dimension rather than a plain boolean, matching the earlier requirement:

```ts
{ enabled: true, visibility: 'public' | 'authenticated' | 'premium' | 'admin' }
```

`isFeatureVisible('courses', user)` is one call, used in navigation building, the request proxy (`apps/web/proxy.ts`), and component rendering. A disabled feature's routes return 404, not a blank page — otherwise you leak the existence of unreleased sections.

### 3.2 Social links

Managed as their own table rather than a settings blob, because they are ordered, individually toggleable, and rendered in several places (header, footer, contact page, article share bar).

```
social_links
├── platform      instagram | facebook | youtube | linkedin | x | ...
├── label         display name, translatable
├── url
├── icon          lucide icon name or uploaded SVG
├── sortOrder
├── isActive
└── openInNewTab
```

Seeded with the six MBX Pro accounts. Admin can reorder by drag, toggle off without deleting, and add platforms not in the seed. The footer component reads the active set in sort order — no hardcoded URLs anywhere in the codebase.

---

## 4. Multi-language

Two distinct problems that need different solutions. Conflating them is the usual mistake.

### 4.1 Interface strings — file-based

Buttons, labels, validation messages, empty states. These ship with the code, change with the code, and belong in version control.

`next-intl` 4.x with `apps/web/app/(public)/[locale]/` routing — locale prefixes are a public-site concern; `/admin/*` is never locale-prefixed (§6.3). Catalogs live in `packages/i18n/messages/{locale}.json`. Type-safe keys generated from the English catalog, so a missing translation is a TypeScript error, not a runtime `undefined`.

### 4.2 Content — database-backed

Lessons, glossary terms, analysis articles, page copy. These change constantly, are written by non-developers, and must be editable in the admin.

Pattern: a base row holding locale-invariant fields, plus a translation table holding everything a translator touches.

```
lessons                    lesson_translations
├── id                     ├── lessonId
├── courseId               ├── locale
├── difficulty             ├── title
├── estimatedMinutes       ├── slug          ← per-locale URLs
├── videoUrl               ├── content
├── isPublished            ├── seoTitle
└── publishedAt            ├── seoDescription
                           └── translationStatus
```

Two consequences worth being explicit about:

- **Slugs are per-locale.** `/en/glossary/pip` and `/es/glosario/pip` are both correct. The base row carries no slug.
- **Translation status is tracked** (`draft` / `translated` / `needs_review` / `outdated`). When the English source changes, dependent translations flip to `outdated` automatically, and the admin gets a queue. Without this, translations silently rot and you ship stale content in your second-biggest market.

Fallback chain: requested locale → site default → English. Configurable per locale, because falling back to English is right for Spanish and wrong for Arabic (an RTL layout with LTR content is worse than a "not yet translated" notice).

### 4.3 RTL

Build with Tailwind logical properties (`ps-4`, `me-2`, `text-start`) from day one rather than retrofitting. Locales carry a `direction` field; the `(public)` root layout sets `lang` and `dir` on its own `<html>`. This is precisely what separate root layouts buy: the `(admin)` layout owns its own `<html>` and is not dragged into the public locale shell. Retrofitting RTL after launch means auditing every component — doing it upfront costs nothing.

---

## 5. Authentication

Better Auth in `packages/auth`, shared by both surfaces of the app and, later, by native clients. Configuration reads `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, with `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` for the social providers.

### 5.1 Sign-up and sign-in

- **Credentials** — email + password, Argon2id hashing. Not bcrypt: Argon2id is the current password-hashing recommendation and resists GPU attacks better.
- **OAuth** — Google and GitHub at minimum. Cheap to add, meaningfully reduces sign-up friction.
- **Email verification** — required before a learner can post comments or access premium. Not required to read.
- **Password reset** — single-use tokens, 30-minute expiry, invalidated on use.

Sessions in the database, not stateless JWTs, so an admin can revoke a session immediately. For a platform with a permission system, "log this user out now" needs to actually work.

### 5.2 Rate limiting and abuse

Sign-in, sign-up, and password-reset endpoints are rate limited per IP and per account. Account lockout after repeated failures uses exponential backoff rather than a hard lock, which otherwise becomes a denial-of-service vector against your own users.

### 5.3 Staff vs learner separation

Same `users` table, but `userType` distinguishes a learner from `STAFF`. `apps/web/proxy.ts` rejects any request to `/admin/*` whose session has `userType !== "STAFF"`, before any route or layout runs. A learner account cannot become an admin by acquiring a role — the type gate comes first. Two locks, not one.

Under ADR-006 the two session kinds share an origin, so they also share a cookie scope. That is a real loss and it is not hand-waved away; it is paid for with a stack of controls that are mandatory, not optional:

- The proxy STAFF gate above, running before any `/admin/*` route or layout.
- The same STAFF check **re-applied server-side** in the `(admin)` root layout and in admin services. The proxy is a gate; it is not the boundary.
- `requirePermission()` at the top of every mutation — the actual boundary, unchanged from §6.3.
- Shorter session lifetime for staff sessions, plus re-authentication before sensitive mutations (role and permission edits, impersonation).
- Stricter CSP and security headers on `/admin/*` than on public paths.
- IDOR probes in the security suite that assert a learner session cannot reach any `/admin/*` route or admin API handler.

Two cookie scopes would have made most of that defence-in-depth rather than load-bearing. It is load-bearing now, which is why none of it is negotiable.

### 5.4 Preparing for mobile

Web uses httpOnly session cookies. Native clients cannot, so `packages/auth` also exposes access/refresh token issuance behind `apps/web/app/api/v1/auth/*`. It is written now and left unrouted — the alternative is rebuilding the auth layer when the mobile app starts, which is exactly what the monorepo is meant to prevent.

---

## 6. Roles and permissions

### 6.1 Model

```
permissions          key: "lessons.publish", group: "content"
roles                key: "editor", isSystem: true
role_permissions     roles ⇄ permissions
user_roles           users ⇄ roles
user_permissions     per-user grant or DENY override
```

Permission keys are `resource.action`: `lessons.create`, `users.delete`, `settings.theme.update`. Flat strings, not a hierarchy — hierarchies invite ambiguity about whether `content.*` includes `content.publish`.

**Deny beats allow.** If any source denies, the answer is no, regardless of role grants. This makes "revoke this one capability from this one person" possible without inventing a bespoke role, which is how permission systems degrade into thirty near-identical roles.

### 6.2 Seeded roles

| Role                | Scope                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Super Admin         | Everything, including permission management. Cannot be deleted or demoted below one remaining holder. |
| Admin               | Everything except permission and role editing                                                         |
| Content Manager     | Full content lifecycle, publish rights                                                                |
| Editor              | Edit and publish; no delete                                                                           |
| Author              | Create and edit own drafts; cannot publish                                                            |
| SEO Manager         | SEO fields, redirects, sitemaps across all content                                                    |
| Market Data Manager | Provider config, instruments, calendar sync                                                           |
| Analyst             | Create and publish analysis only                                                                      |
| Moderator           | Comments and community                                                                                |
| Support             | Read-only users, plus password reset                                                                  |
| Read Only           | View admin, change nothing                                                                            |

System roles (`isSystem: true`) cannot be deleted, only cloned — deleting "Super Admin" while holding it is an unrecoverable lockout.

### 6.3 Enforcement, in three layers

1. **Proxy** — route-level, in `apps/web/proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`; same request-interception role, new filename). One file handles both jobs: i18n locale routing for the public site, and the gate on `/admin/*` that refuses any session with `userType !== "STAFF"`. Beyond the type gate it is also where route-level permission expectations live — `/admin/users` requires `users.view`. Its matcher excludes `/api`, `/_next` and static files, and must never locale-prefix `/admin`.
2. **Server action / route handler** — `requirePermission('users.update')` at the top of every mutation. **This is the real boundary.** The other two are UX.
3. **UI** — `<Can permission="users.delete">` hides what the user cannot do.

A hidden button is not security. Every mutation re-checks server-side, without exception, because the client is not trustworthy. With one app and one origin (ADR-006), layer 1 also carries the staff/learner separation that used to come free from separate deployments — which is why the `(admin)` layout re-checks it too rather than trusting the proxy alone.

---

## 7. Users and employees

These are separate concerns wearing similar clothes.

**`users`** is identity and access: email, password hash, type, status, locale, theme preference, last login.

**`employees`** is HR context: employee code, department, designation, reporting manager, join date, employment status, work email, phone, emergency contact.

An employee record has a `userId` — but nullable, because you may onboard an employee before their login exists. A user may have no employee record, because learners are users too.

Keeping them separate means an offboarded employee's row survives with `status: 'terminated'` for records, while their user account is deactivated and sessions revoked. Merged into one table, you would be choosing between deleting HR history and leaving a live login for someone who left.

### 7.1 Admin listings

Both use a shared `DataTable` from `packages/ui` (TanStack Table + shadcn), giving server-side pagination, sorting, filtering, column visibility, row selection, bulk actions, and CSV export from one component. `@repo/ui` exports per component, so importing `Button` never pulls TanStack in — the mechanism that keeps a shared UI package from defeating the bundle isolation described in §1.1.

**Users list:** avatar, name, email, type, roles, status, last active, joined. Filters on type, status, role, date range. Bulk activate/deactivate, assign role, export. Row actions gated by permission — Support sees "Reset password" but not "Delete".

**Employees list:** photo, code, name, department, designation, manager, status, joined. Filters on department, designation, status, manager. Bulk export and department reassignment. Optional org-chart view built from the `reportingToId` self-relation.

---

## 8. Data access and caching

```
Route Handler / Server Action / Server Component
        ↓  (thin — auth check, parse input, call service)
packages/core service
        ↓  (business rules, permission checks, cache tags)
packages/db  (Prisma → MariaDB)
```

Route handlers never touch Prisma directly. That single discipline is what makes `apps/api` or a mobile backend a configuration change rather than a rewrite.

**Caching strategy:**

| Data                                      | Approach                                                    | Invalidation                   |
| ----------------------------------------- | ----------------------------------------------------------- | ------------------------------ |
| Theme, settings, navigation, social links | Cache Components — `"use cache"` + `cacheTag` / `cacheLife` | `revalidateTag` on admin write |
| Published content (lessons, glossary)     | ISR + tags                                                  | On publish                     |
| Market rates                              | Redis, short TTL                                            | TTL expiry                     |
| User-specific                             | No cache                                                    | —                              |

Next.js 16's Cache Components are the direction: a cached function or component is marked `"use cache"` and declares its tags with `cacheTag()` and its freshness with `cacheLife()`. `unstable_cache` is the legacy path — it still works, and existing code using it is not a bug, but new caching is written the new way. **The tag names do not change**: `theme`, `settings:{group}`, `navigation`, `rbac:{userId}` mean the same thing under either primitive, so `revalidateTag` call sites are unaffected by the migration.

Everything cached under `(admin)` is subject to that route group's `force-dynamic`; caching in the one app is a per-segment decision, which is the point made in §1.1.

Market data is the one thing that never goes into Prisma as a source of truth. Live quotes are cached in Redis with a TTL matching the provider's refresh; only the historical series worth charting is persisted. Writing every tick to MariaDB will destroy the database and the API budget simultaneously.

---

## 9. Environment and deployment

| Variable                                    | Purpose                                                  |
| ------------------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`                              | MariaDB connection                                       |
| `REDIS_URL`                                 | Cache and rate limiting                                  |
| `BETTER_AUTH_SECRET`                        | Session encryption                                       |
| `BETTER_AUTH_URL`                           | Canonical origin Better Auth issues callbacks against    |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth                                                    |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth                                                    |
| `MARKET_DATA_PROVIDER` / `_KEY`             | Swappable provider                                       |
| `S3_*`                                      | Media storage                                            |
| `NEXT_PUBLIC_SITE_URL`                      | Absolute URLs, CORS                                      |
| `NEXT_PUBLIC_ADMIN_URL`                     | Admin base — by default `${SITE_URL}/admin`, same origin |

**One deployment, not two.** `apps/web` builds and ships once, carrying both surfaces. Turborepo's remote cache still earns its keep — a change confined to `packages/*` that the app does not import into a changed graph is a cache hit — but the "admin deploys without rebuilding web" property is gone, and that is the trade named in §1.1.

Because there is no admin _hostname_, edge protection for the admin is **path-based**: WAF rules, IP allowlists and stricter security headers key on `/admin/*` rather than on `admin.<domain>`. If host-level isolation becomes a requirement, the same app can be served at `admin.<domain>` through a host rewrite in front of it — a proxy config change, not a code change.

`packages/db` migrations remain a **separate pre-deploy step**, run once against the database before the app rolls. That does not change with the app count; migrations were never per-app.

---

## 10. Build order

**Phase 0 — Foundation (weeks 1–2).** Monorepo and `tooling/*`, the single `apps/web` scaffold with both route groups stubbed, Prisma schema, migrations, seeders, `packages/ui` with shadcn initialised against MBX Pro tokens, theme engine, auth, RBAC. Nothing user-facing ships. This phase is the entire bet: every later phase either compounds on it or fights it.

**Phase 1 — Admin shell (weeks 3–4).** The `(admin)` route group and its root layout, `proxy.ts` with the i18n rules and the STAFF gate, navigation, settings screens, theme editor, users, employees, roles. The admin must work before content exists, or you will hardcode content to make progress and never undo it.

**Phase 2 — Content system (weeks 5–7).** Courses, lessons, glossary, media library, editorial workflow, translation management.

**Phase 3 — Public site (weeks 8–10).** The `(public)` route group and its root layout, locale routing, learn, glossary, tools, homepage sections driven by admin config.

**Phase 4 — Market layer (weeks 11–12).** Provider abstraction, rates, calendar, calculators.

---

## 11. Decisions worth challenging before you start

1. **Prisma vs Drizzle.** Prisma's migrations and DX are stronger; Drizzle's MariaDB support is thinner but its bundle is smaller and its SQL is more transparent. Recommendation: Prisma 7 (stable; Prisma 8 is still RC), because a CMS-heavy admin benefits more from relation ergonomics than from bundle size. Revisit only if query performance becomes the bottleneck.

2. **Separate admin app — decided, not open.** This entry used to argue for two apps and concede that one app with an aggressive `dynamic` boundary was defensible for a team of one or two. That counter-argument is now the adopted position: **ADR-006** locks a single app with `(public)` and `(admin)` route groups, and §1.1 records what was traded. What remains worth watching is not the decision but its failure mode — a shared or public module importing admin-only code and dragging Tiptap or TanStack Table into a public bundle. The lint boundary rule and the blocking Lighthouse budget exist for exactly that. If they start firing regularly, or if the shared cookie origin (§5.3) proves too costly, splitting `(admin)` into its own app is mechanical because the logic lives in `packages/*` — nothing here forecloses it.

3. **Locales at launch.** Building the i18n plumbing now is cheap. Translating 200 glossary terms and 60 lessons is not. Ship English-only with the machinery in place, and add locales when there is a market reason.

4. **Employees module scope.** As specified, this is a staff directory. If it grows toward leave, payroll, or attendance, that is an HRIS and should be a separate application consuming the same auth — not more tables in a learning platform.
