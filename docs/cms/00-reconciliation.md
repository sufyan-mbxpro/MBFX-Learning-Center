# CMS Phase 0 — Repository Reconciliation

**Date:** 2026-09-04
**Replaces:** Section 3 ("Existing-System Audit") of
`docs/MBX-Dynamic-Site-Controle-Plan.md` (v1)
**Feeds:** `docs/MBX-Dynamic-Site-Control-Plan-v2.md`, ADR-020 … ADR-026

v1 Section 3 opens with "I cannot see your repository" and defines a
12-part blind audit as a hard gate before any builder code. That audit is
answered here, from the code. Everything below is a **verified fact about
this repo as of 2026-09-04**, not a plan; where a fact contradicts v1, the
contradiction is named and the v2 plan resolves it.

---

## 1. Monorepo & tooling (v1 §3.1)

**One app.** `apps/web` only, with `app/(public)` and `app/(admin)` route
groups, each owning a root layout. There is no `apps/admin` and none will
be created — **ADR-006**. v1's §4.1 diagram (an `apps/admin` column facing
an `apps/web` column) is wrong on this repo.

**Ten packages**, all shipped: `db`, `auth`, `rbac`, `theme`, `ui`,
`i18n`, `settings`, `core`, `contracts`, `utils`. Plus `tooling/`
(eslint-config, typescript-config, tailwind-config).

**Pinned versions** (`docs/memory/stack.md`, never bumped ad hoc): Next
**16.3.3**, React **19.2.8**, Tailwind **4.3.x**, TypeScript **6.0.3
exact** (ADR-010, do not take 7.x), Prisma **7.10.x** (ADR-002), Better
Auth 1.7.2, Zod 4.5.x, next-intl 4.14.x, pnpm 11.24.0, Node 24. Supply
chain: `minimumReleaseAge: 1440` and `onlyBuiltDependencies` are on — **a
new dependency cannot be installed the day it publishes.**

**Admin-only dependencies already live in `apps/web`**, not in a package:
Tiptap 3.31.0, `@tanstack/react-table` 8.21.3, recharts 3.10.1. The import
boundary (architecture.md #5) plus a blocking Lighthouse budget keeps them
out of public bundles. **This is the precedent for where a visual editor's
client code belongs** — see ADR-026.

**Governance is enforced, not advisory.** `pnpm governance:check` fails a
branch that changes `packages/*` without a DEVLOG entry, and fails any
modification to an existing ADR body (only the `Status` / `Superseded by`
header lines may change). Other CI scripts: `check-permission-keys`,
`check-phantom-deps`, `check-catalog-completeness`, `check-home-sections`.

## 2. Database & Prisma (v1 §3.2)

- Prisma 7, `prisma-client` generator with custom output, real FKs (no
  `relationMode`), MariaDB driver adapter.
- **PascalCase models, `String @id @default(cuid())`** throughout. v1 §5's
  preamble ("naming below uses snake_case tables") does not apply.
- Translation-table convention: `XTranslation` with
  `@@unique([xId, locale])` and `@@unique([locale, slug])`, a
  `TranslationStatus` enum, soft delete via `deletedAt`, and a
  `ContentStatus` state machine for publishable content.
- **Already exist — and v1 proposes a duplicate of every one:**

  | Exists today                                              | v1 proposes                          | Verdict                                           |
  | --------------------------------------------------------- | ------------------------------------ | ------------------------------------------------- |
  | `AuditLog` + `recordAudit()` (ADR-011)                    | `CmsAuditLog`                        | duplicate — reuse                                 |
  | `Redirect` + page-level 301s (ADR-015 #1)                 | `CmsRedirect`                        | duplicate — reuse                                 |
  | `MediaAsset` + `storeImage()` (ADR-017)                   | `Media`, `MediaFolder`, `MediaUsage` | extend, don't fork                                |
  | `Theme`, `BrandAsset`, `Setting`                          | `CmsThemeSettings`                   | parallel theme store — forbidden by v1's own text |
  | `FeatureFlag`, `FeatureVisibility`, `isPremium` (ADR-012) | `AccessRule`                         | reuse the enum; no second engine                  |
  | `Menu`, `MenuItem`, `MenuItemTranslation` (Module 08)     | `CmsMenu`, `CmsMenuItem`             | shipped — reuse                                   |

- **`Page` / `PageTranslation` do not exist.** `plan.md` A7 already names
  them as a known gap ("needed for a highly dynamic public site"). The CMS
  page model **is** that gap being filled — not a parallel `CmsPage`.

## 3. News & Analysis (v1 §3.3) — shipped, and locked

Module 15 is `core complete` under **ADR-015**. Live routes:
`(public)/[locale]/news`, `/news/[slug]`, `/news/category/[slug]`,
`/news/tag/[slug]`, `/news/preview/[id]`, `/analysis`, `/news/rss.xml`.

- Services: `packages/core/src/public-articles.ts` (public reads),
  `articles.ts` (mutations), `search.ts`, plus `getArticleFacets()`.
- **The visibility rule is frozen** in one place — `publicArticleWhere(now)`
  — composing: not deleted, `isActive`, active category, PUBLISHED or
  due-SCHEDULED, plus the page-level feature flag. Any CMS collection block
  over articles **must** go through it, never re-derive it.
- Search params are already parsed, never cast: `publicArticleSearchSchema`
  (`q`, `page`) — security.md #6.
- Reusable UI exists today: `article-list.tsx` (`ArticleCards`, variants
  standard/featured/compact), `article-sidebar.tsx`, `listing-header.tsx`,
  `numbered-pagination.tsx`, `share-row.tsx`.
- Bodies are **sanitized HTML** (ADR-009 / ADR-015 #2), not Tiptap JSON.
  There is no `packages/article-renderer` and one must not appear.
- Scheduling is cache-driven (`cacheLife({revalidate: 300})`), not cron.

**Consequence for v1 Phase 6** ("refactor News UI into reusable components
(no behavior change); convert `/news` into a CMS page"): this is not
greenfield integration, it is a rewrite of shipped, locked code. The DEVLOG
entry of 2026-09-04 documents a container-query grid bug in exactly these
components that a build-only check could not catch. v2 therefore **wraps
rather than rewrites**, behind a fallback switch.

## 4. Courses / Learning (v1 §3.4)

`Course` / `Module` / `Lesson` / `GlossaryTerm` + translations exist
(Modules 01/11). Services: `content.ts`, `public-content.ts`. The public
surface is glossary + homepage only; the learn area is **deferred**. Course
listing/detail pages do not exist — so for courses the CMS is greenfield,
unlike news.

## 5. Auth, roles, permissions (v1 §3.5)

- Better Auth (ADR-001), DB sessions, STAFF gate in `proxy.ts` **and**
  re-checked server-side.
- `@repo/rbac`: `can()` / `requirePermission()` / `requireAnyPermission()`,
  evaluation order **frozen: deny > super_admin > allow**.
- Permission keys are seeded and **CI-cross-checked** — every string passed
  to `requirePermission` must exist in the seed registry. New CMS
  permissions must be seeded in the PR that first uses them.
- `recordAudit()` lives in `@repo/core` (ADR-011); every mutation writes one.
- `FeatureVisibility` = `PUBLIC | AUTHENTICATED | PREMIUM | ADMIN`, and
  **ADR-012 freezes `PREMIUM` as staff-only** until entitlements exist.
  That is exactly the vocabulary v1's `AccessRule.visibility` invents —
  reuse it and ADR-012's semantics come along for free.

## 6. Settings, theme, branding (v1 §3.6)

- `@repo/theme` (Module 02): DB tokens → CSS variables, **derived**
  interactive colours (ADR-003 — `--primary-hover` is computed, never
  authored), WCAG validation with blocking and advisory rules, and a
  **property-based contrast contract test** over random palettes.
- **ADR-018**: public motion is CSS-first, no animation library; brand
  primary is `#E8B98C`; reveal / counter / marquee / image-reveal /
  page-loader are shipped `@repo/ui` components.
- Dark/light is **user-controlled** (next-themes, ADR-008); admins set
  per-mode token values and can never force a mode.
- `code-style.md` #1: **a hex literal outside `@repo/theme` fails lint.**
  v1 §9.2's per-block custom light/dark colour pickers would write hex into
  page JSON and render it as inline style — outside the token system, past
  the contrast contract, past the lint rule. Resolved in **ADR-024**.
- **The homepage is already composed from data.** The `home.sections`
  setting is an ordered list of `{key, enabled, order, variant, limit}`
  descriptors, validated by `HOME_SECTION_VARIANTS` in `@repo/contracts`,
  mapped to components by `app/(public)/[locale]/_sections/registry.ts`,
  kept in sync by `check-home-sections.mjs`, with unbuilt keys rendering an
  honest stub. **This is a working proto-CMS** — it already proves the
  data→layout round trip, and is the natural first migration target for the
  page model (v2 Phase 2) rather than something left stranded beside it.

## 7. Media (v1 §3.7)

**ADR-017 already shipped the pipeline v1 §12 describes:** `storeImage()`
in `packages/core/src/media.ts` — 5 MB cap, **magic-byte MIME sniffing**
(client `File.type` ignored), random object key, `StorageDriver { put, get }`
with a local-disk driver and S3 as the named seam, a `MediaAsset` row, an
audit entry; served by `GET /uploads/[file]` (table lookup, `nosniff`,
immutable cache). Missing: the **library UI** (folders, search, tags,
replace, usage tracking) — Module 11 deferred work. The builder's media
picker depends on it, so v2 schedules it as a dependency instead of
re-specifying the pipeline.

_Updated 2026-09-04: ADR-034 delivers that library inside Module 16 Phase 3
— `storeMedia()` for four kinds, metadata, replace, usage-guarded delete —
keeping ADR-017's validation and driver seam unchanged._

## 8. i18n (v1 §3.8)

next-intl 4.14, `localePrefix: "as-needed"` (default locale unprefixed),
static locale list `["en","es","ar","ur"]` plus DB `Locale.isActive` as the
runtime source of truth, `LOCALE_DIRECTION` for `<html dir>`, message
catalogs with a completeness CI script, `ar`/`ur` inactive at launch
(ADR-007). Content translation tables carry `TranslationStatus` and a
`sourceHash`-driven OUTDATED flow.

**Consequence:** a CMS catch-all route must live _inside_
`app/(public)/[locale]/`, and `as-needed` means the published path for the
default locale carries no prefix — the `(locale, path)` uniqueness in v1
§5.1 must account for that.

## 9. Menus, header, footer (v1 §3.9)

Shipped in Module 08: `buildNavigation(menuKey, locale, subject)` with
`isActive` / `visibility` / `requiresFeature` / `requiresPermission`
filtering, translation fallback, exactly-one-of `url`/`routeKey`, an admin
drag-reorder UI at `/admin/navigation`, and header/footer settings (logo per
mode, CTA, sticky, announcement bar, footer columns, social links,
translatable copyright, risk disclaimer). Cache tag `navigation`.

**Consequence:** v1 §13 and Phase 8 (menu models, menu builder, header/
footer as PART templates, migration script) are **~80% already built**. v2
does not rebuild them; header/footer stay settings- and menu-driven and are
out of the builder's MVP scope.

_Superseded 2026-09-04 by ADR-027/028 (header, footer, announcement and
mega-menu panels are `PART` pages inside the builder; `MenuItem` is
extended, not replaced) and by ADR-031 (menu targets and block links share
one `LinkTarget` resolver). The ~80%-built finding still holds — the
shipped components remain the fallback path._

## 10. Caching & deployment (v1 §3.10)

- **Cache Components (ADR-004)**: `"use cache"` + `cacheTag()` +
  `cacheLife()`. `unstable_cache` and `export const revalidate = N` are the
  legacy path and must not be introduced. `revalidateTag` takes a
  **mandatory second argument** in Next 16 — the repo always calls
  `revalidateTag(tag, { expire: 0 })`.
- **The real tag vocabulary is coarse.** Verified across `packages/*/src`:
  `theme`, `settings:{group}`, `navigation`, `rbac:{userId}`, `content`,
  plus `FEATURE_FLAGS_TAG` and `LOCALES_TAG`. **All content invalidation
  goes through the single `content` tag.** v1 §7.3 lists `articles`,
  `article:{id}`, `category:{id}`, `tag:{id}` as "existing News queries
  (keep)" — **those tags do not exist.** architecture.md #12 calls the
  vocabulary frozen API, so adding `page:{id}` requires an ADR (→ ADR-025).
- Public routes are static/PPR shells; `(admin)` is `force-dynamic`.
  architecture.md #6: do not fix a caching problem by making public routes
  dynamic.
- Single-app deployment; migrations are a separate pre-deploy step.
- **Known local constraint:** `pnpm --filter=@repo/web build` has OOM'd on
  the owner's machine during Turbopack static generation (DEVLOG
  2026-09-04). Any phase that adds routes must budget for this.

## 11. UI inventory (v1 §3.11) — what block renderers already have

`@repo/ui/components`: accordion, alert, alert-dialog, aspect-ratio, avatar,
badge, button, card, checkbox, command, confirm-dialog, **container**,
counter, **cta-band**, data-table, dialog, dropdown-menu, empty, field,
form, **icon-card**, **image-reveal**, input, kbd, label, **marquee**,
mode-toggle, **page-loader**, **pagination**, **process-step**, **reveal**
(+ reveal-observer), scroll-to-top, **section**, **section-heading**,
select, separator, sheet, skeleton, sonner, spinner, **stat-card**, switch,
table, tabs, textarea, theme-provider.

Public compositions in `apps/web`: header, footer, top-bar,
announcement-bar, mobile-nav, locale-switcher, mode-toggle, newsletter-form,
and six homepage sections (hero, latest-analysis, glossary-spotlight,
newsletter, faq, risk-disclaimer).

Token discipline holds: zero hex outside `@repo/theme`; logical properties
only — physical `pl-`/`pr-`/`ml-`/`mr-` fail lint.

**Consequence:** the MVP block set is mostly _wrapping existing components
with a schema_, not writing new UI.

## 12. Security posture the builder must satisfy

- `requirePermission()` is the first line of every mutation; `<Can>` and the
  proxy are UX, not security.
- **Rich text is sanitized server-side on save** — `sanitizeRichText()`,
  with an XSS regression suite (`sanitize-tiptap.test.ts`).
- **No SSRF**: the app never fetches an arbitrary URL on an admin's behalf
  (security.md #9). Any embed design must be a static allow-list with
  locally-constructed iframe URLs — exactly what ADR-015 #9 already does for
  article videos (`videoUrl` validated against a `@repo/utils` provider
  whitelist; the iframe is built at render, never stored).
- **CSP** ships report-only, per path: admin gets a per-request nonce,
  `X-Frame-Options: DENY`, `frame-ancestors 'none'`; public gets
  `SAMEORIGIN` / `frame-ancestors 'self'` and a **nonce-less** `style-src`,
  because a per-request nonce would force public routes dynamic.
  → An editor canvas that iframes a **public** preview URL from an admin page
  works (same origin, `'self'`). An iframe of an **admin** URL does not.
  And authored inline `style` attributes are only tolerable while
  `style-src-attr 'unsafe-inline'` stands — another reason ADR-024 keeps
  authored styling in tokens and classes rather than arbitrary CSS.

## 13. Quality gates that currently cannot see admin-authored content

All of these run against **code**. None runs against a page tree an admin
composes at runtime:

| Gate                                 | Where it runs today      | Blind spot                                   |
| ------------------------------------ | ------------------------ | -------------------------------------------- |
| Theme contrast contract (fast-check) | `@repo/theme` unit tests | authored per-block colours                   |
| axe a11y                             | component + page tests   | authored heading order, landmarks, link text |
| Lighthouse budgets                   | fixed public routes      | an authored page with 12 dynamic blocks      |
| Logical-property lint                | source files             | authored spacing/alignment props             |
| Catalog completeness                 | message catalogs         | authored text with no translation            |

This is the largest unfunded risk in v1 (its §18 covers it with bullets, not
gates). v2 makes "the gates extend to authored pages" a phase deliverable —
see ADR-024 §Compliance.

## 14. Residual unknowns — the only things that still need a spike

1. **Puck × this stack.** Puck 0.23.x against React 19.2.8 / Next 16.3.3 /
   Tailwind 4.3 / Base UI, inside an admin route under a nonce-based CSP,
   with `minimumReleaseAge` and `onlyBuiltDependencies` in force. Nobody has
   tried it here. → ADR-026 gates adoption on a timeboxed spike.
2. **Filtered-collection caching.** A COLLECTION page reads `searchParams`
   (dynamic on params) while its data fetch wants `"use cache"` + tags.
   `/news` already lives with this shape; the CMS version must formalise it.
   → ADR-025.
3. **Build memory.** The `@repo/web` production build OOM must be resolved
   or worked around before a phase that multiplies static params.
