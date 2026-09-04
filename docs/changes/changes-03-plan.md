# changes-03 — Public design system overhaul (plan)

**Status:** proposed — no code written yet. Re-verified against the working
tree on 2026-09-03; §2.1's risk is now resolved (below), everything else holds.
**Source brief:** `docs/changes/changes-03.md` (ForTradex visual reference,
brand palette, home + blog-grid page sources, `image-9.png` / `image-10.png`).
`docs/changes/changes-04.md` is a **byte-identical copy** of that brief
(`cmp` clean, 273,474 bytes) — this document covers both; there is no separate
changes-04 plan.
**Governing rules:** `claude.md`, `.claude/rules/{architecture,security,code-style,testing}.md`,
`docs/plan.md` Part D/F.

---

## 0. Scope contract

**In scope:** the public surface (`app/(public)/[locale]/**`), `@repo/ui`
primitives, `@repo/theme` default palette, presentation-control settings in
`@repo/contracts` + seed, and the `@repo/core` read functions those screens
need.

**Out of scope (explicit):** architecture changes, WordPress/Elementor
concepts, the admin surface's own look, the dynamic theme flow (the engine
stays exactly as ADR-003/ADR-008 define it — we change _default values_, not
the mechanism), and any copied ForTradex markup, CSS, asset or copy. The
reference informs proportion, rhythm and motion only.

**Hard constraints carried from the rules:**

- No colour literals outside `@repo/theme` token definitions (lint-enforced).
- No hardcoded user-facing strings — every new label lands in all four
  catalogs (`en/es/ar/ur`), enforced by `pnpm check:catalog-completeness`.
- Logical properties only (`ps-/pe-/ms-/me-/text-start`); the reference is
  LTR-only, we are not.
- Public routes stay ISR + cache-tagged; nothing here may make them dynamic.
- Nothing under `(public)` may import admin-only dependencies.
- Public bundle weight is a blocking budget (architecture #5).

---

## 1. Audit — current UI architecture

### 1.1 What exists today

| Layer         | State                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@repo/theme` | 7 brand colours + light/dark surface palettes + layout tokens; hover/active **derived** (ADR-003); emits `<style id="brand-tokens">`; contrast validation |
| `@repo/ui`    | 34 shadcn/Base UI components (ADR-013), granular `./components/*` exports, one `globals.css`, `.card-hover` utility, `--height-header`, `.container-page` |
| Public layout | `[locale]/layout.tsx` — html lang/dir, brand tokens, ThemeProvider, header/footer, `instant = false`                                                      |
| Header        | 145 lines: announcement bar, mobile nav, logo/brand assets, flat nav + dropdowns, locale switcher, mode toggle, auth chip, optional CTA                   |
| Footer        | 123 lines: brand + socials, N menu columns, optional newsletter placeholder, disclaimer + copyright                                                       |
| Homepage      | 121 lines: `home.sections` registry drives order/visibility; 4 real sections (hero, latest analysis, glossary spotlight, risk disclaimer), 9 dashed stubs |
| News/Analysis | `ArticleCards` grid + prev/next `ListingPagination`; category/tag/preview routes                                                                          |
| Motion        | none — no animation library, no reveal/counter/ticker; the global `prefers-reduced-motion` reset is in place                                              |

### 1.2 Reusable as-is

`Button`, `Badge`, `Card` (+ `.card-hover`), `Separator`, `Skeleton`,
`Spinner`, `PageLoader`/`SectionLoader`, `Sheet` (mobile nav), `DropdownMenu`,
`Tabs`, `Input`, `ModeToggle`, `ThemeProvider`, `container-page`, the whole
theme token pipeline, `buildNavigation`, `getPublishedArticles`,
`getBrandAssets`, `getActiveSocialLinks`.

### 1.3 Needs improvement (not replacement)

1. **`Button`** — no `xl`/hero size, no pill radius option, no icon-slide
   hover. Add variants; do not fork the component.
2. **`Badge`** — the reference uses pill "eyebrow" chips above every section
   heading and category pills on cards. Add `pill` + `eyebrow` variants.
3. **`Card`** — one visual treatment today. Add `variant`:
   `default | elevated | bordered | featured` on the existing component.
4. **`ArticleCards`** — single layout. Needs `standard | featured | compact`
   variants, an author/date row, a category pill, image zoom on hover.
5. **`ListingPagination`** — prev/next only. The reference uses numbered pills.
6. **Header** — no top bar, no search affordance, no sticky-shrink; the
   dropdown trigger is a ghost `Button` rather than a nav item.
7. **Footer** — menu columns render with **no heading** (`buildNavigation`
   returns items, not the menu's name), no payment/app badges, and the
   newsletter is an empty placeholder.
8. **Homepage** — 9 of 13 configured sections are dashed stubs.
9. **`globals.css`** — no section-rhythm, elevation-tier, duration or easing
   tokens; every page hand-rolls `flex flex-col gap-N py-N`.

### 1.4 New primitives required

`Container`, `Section`, `SectionHeading`, `Reveal`, `Counter`, `Marquee`,
`ImageReveal`, `SiteLoader`, `ScrollToTop`, `StatCard`, `IconCard`,
`ProcessStep`, `CtaBand`, `NewsletterForm`, `ArticleSidebar`, `Pagination`.

---

## 2. Design tokens

### 2.1 Brand palette — the one value that changes

The brief pins the palette. Six of the seven already match `DEFAULT_BRAND`:

| Token       | Current   | Brief         | Action     |
| ----------- | --------- | ------------- | ---------- |
| `primary`   | `#C28D5A` | **`#E8B98C`** | **change** |
| `secondary` | `#2A2A29` | `#2A2A29`     | none       |
| `success`   | `#2D72C7` | `#2D72C7`     | none       |
| `error`     | `#D93A34` | `#D93A34`     | none       |
| `warning`   | `#FFA310` | `#FFA310`     | none       |
| `info`      | `#004284` | `#004284`     | none       |
| `accent`    | `#EAE5DE` | `#EAE5DE`     | none       |

The screenshot's read-only derived pair (`#8b6f54` light / `#e8b98c` dark) is
exactly `deriveInteractive("#E8B98C", …)` — which confirms the mapping and
confirms that **the derived-state flow stays untouched** (ADR-003 holds).

Files: `packages/theme/src/index.ts` (`DEFAULT_BRAND.primary`),
`packages/db/prisma/seed.ts` (imports the constant — no edit expected),
`packages/theme/src/index.test.ts` (the `#C28D5A ≈ 2.90:1` assertions document
the _old_ value — retarget them), `packages/theme/src/__snapshots__/*`.

#### Verified 2026-09-03 — the palette change is safe (risk closed)

The engine's own maths (`contrastRatio` / `shade` / `deriveInteractive` /
`readableOn`, re-run against `#E8B98C`) gives:

| Value                                     | Result                            | Verdict                             |
| ----------------------------------------- | --------------------------------- | ----------------------------------- |
| `--primary` on `#FFFFFF`                  | **1.79:1** (old: 2.90:1)          | never used as text — see rule below |
| `--primary` on dark bg `#141413`          | 10.31:1                           | fine                                |
| `--primary-foreground` (fill ink)         | `#1A1A1A` @ **9.74:1**            | passes — the tan button is legible  |
| `--primary-interactive` light             | **`#8B6F54`** @ 4.67:1            | passes                              |
| `--primary-interactive` dark              | **`#E8B98C`** @ 10.31:1           | passes                              |
| `--primary-hover` / `-active` / `-subtle` | `#C89F78` / `#AC8968` / `#FCF5EE` | derived, ADR-003 intact             |

`#8B6F54` / `#E8B98C` is **exactly** the "Derived states (read-only)" pair the
brief's admin screenshot shows — the mapping is confirmed, and the dynamic
colour flow needs no change, only the default value.

`validateMode` outcome: the blocking button-label check **passes** (best ink
9.74:1 ≥ 4.5). The only issue emitted is the existing advisory
`severity: "warning"` — _"primary used directly as link text"_ — which is
informational and already the designed behaviour. **No blocking error**, so
Phase 1 is unblocked.

> **New design-system rule this creates.** At 1.79:1 on white, `--primary`
> clears neither the 4.5:1 text bar nor the 3:1 non-text bar. The validator
> only checks it as _text_, so nothing fails lint or CI — but a tan 1px
> border, a small icon glyph or an eyebrow-pill label drawn in raw
> `--primary` on a light surface is effectively invisible. The reference
> design uses its primary colour for exactly those small elements, so this
> is a live trap, not a hypothetical one.
>
> **Rule: `--primary` is for fills and large shapes only. Any thin, small
> or text-adjacent primary-coloured element uses `--primary-interactive`.**
> Belongs in ADR-018 (§8); binding on `Badge`'s new `eyebrow` variant,
> `IconCard`, `ProcessStep` and the bordered/featured `Card` variants.

### 2.2 New CSS tokens (`packages/ui/src/styles/globals.css`, `@theme inline`)

No literals beyond the same neutral-shadow exception the file already
documents.

```
/* Section rhythm — one scale, every public section uses it */
--space-section-sm / -md / -lg      (48 / 80 / 112px, fluid via clamp)
--space-section-gap                 (heading → content)

/* Elevation tiers (extends the existing --shadow-*) */
--shadow-card / --shadow-card-hover / --shadow-float

/* Motion — durations and easings, so nothing hand-picks a number */
--duration-fast / -base / -slow     (150 / 250 / 450ms)
--ease-out-quint / --ease-spring
--reveal-distance                   (translate offset for Reveal)

/* Container widths — .container-page keeps --container-width (admin-set);
   add --container-wide and --container-narrow for hero/prose */
```

Plus utilities in `@layer utilities`, siblings of the existing `.card-hover`:

- `.media-zoom` — image scale on hover (transform only, GPU-safe).
- `.link-underline` — animated underline sweep, direction-aware.
- `.reveal` / `.reveal-up` / `.reveal-left` / `.reveal-right` — see §3.
- `.marquee` — CSS keyframe track; direction flips under `[dir="rtl"]`.

### 2.3 Typography

The reference's scale is much larger than our 14px-base admin scale. Do **not**
change the global `--text-*` ramp — it is shared with the admin surface and
was already the subject of the spacing-namespace incident documented in
`globals.css`. Instead:

- `SectionHeading` and `Hero` own display sizes via `clamp()` utilities scoped
  to the public surface (`--text-display-*` tokens).
- Base body size stays `--brand-base-font-size` (admin-controlled).

---

## 3. Animation strategy

**Decision: zero new runtime dependencies.** Everything the brief asks for is
achievable with CSS plus one small `IntersectionObserver` hook. Adding
`motion` would cost ~30–50 KB on public routes that carry a blocking
Lighthouse budget, plus a `pnpm-workspace.yaml` dependency review.

| Effect            | Technique                                                                                                     | Component boundary                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Scroll reveal     | CSS `animation-timeline: view()` where supported; `@supports not` → `IntersectionObserver` adds `.is-visible` | `Reveal` renders a **server** wrapper; the observer is one small client island per page, not per element |
| Card/image hover  | pure CSS `transition` on `transform`, `box-shadow`, `--tw-ring-color`                                         | server                                                                                                   |
| Counters (`150+`) | `rAF` count-up on first intersection                                                                          | `Counter` — client                                                                                       |
| Marquee / ticker  | CSS `@keyframes` translate + duplicated track; pause on hover/focus                                           | server (CSS-only)                                                                                        |
| Page loader       | CSS-only overlay removed on `load`, hard-capped                                                               | `SiteLoader` — client, see §3.1                                                                          |
| Route transitions | `loading.tsx` + the existing `PageLoader`/skeletons                                                           | server                                                                                                   |
| Scroll-to-top     | `IntersectionObserver` on a sentinel                                                                          | client, ~1 KB                                                                                            |

**Non-negotiables for every one of these:**

1. Content is **visible in the server HTML**. `Reveal` never ships
   `opacity: 0` without a companion rule restoring visibility when
   scroll-driven animation is unsupported _and_ JS has not run. No-JS and
   crawler renders show the finished state.
2. `prefers-reduced-motion` short-circuits all of it — the global reset in
   `@layer base` already neutralises durations; `Counter` additionally jumps
   straight to its final value and `Marquee` renders static.
3. Transform/opacity only — no layout-triggering properties.

### 3.1 The page preloader — deliberate deviation

The reference ships a full-screen letter-animation preloader. Copied
faithfully onto a server-rendered Next.js app it **delays LCP for every
visitor on every navigation** and would fail the Module 12/14 Lighthouse
budget that backstops ADR-006.

Plan: build `SiteLoader`, but as a **first-visit-only, CSS-only overlay** that
(a) never blocks paint of the content beneath it, (b) self-dismisses on
`window.load` or after a hard 900 ms cap, whichever is first, (c) is skipped
entirely under `prefers-reduced-motion`, and (d) is gated by a new
`layout.pageLoader` boolean setting so it can be switched off without a
deploy. Rationale goes in the ADR (§8).

---

## 4. Component plan

### 4.1 New primitives — `packages/ui/src/components/`

| File                  | Kind                          | Notes                                                                 |
| --------------------- | ----------------------------- | --------------------------------------------------------------------- |
| `container.tsx`       | server                        | `size: page \| wide \| narrow`; wraps `.container-page`               |
| `section.tsx`         | server                        | `spacing: sm\|md\|lg`, `tone: default\|muted\|inverted\|accent`, `id` |
| `section-heading.tsx` | server                        | eyebrow `Badge` + `h2` + optional lead + `align: start\|center`       |
| `reveal.tsx`          | server + tiny client observer | `variant: up\|left\|right\|fade\|scale`, `delay`                      |
| `counter.tsx`         | **client**                    | `value`, `suffix`, `duration`; reduced-motion aware                   |
| `marquee.tsx`         | server                        | `speed`, `direction`, `pauseOnHover`; RTL-flipping                    |
| `image-reveal.tsx`    | server                        | aspect-ratio box + `next/image` + `.media-zoom` + clip-path wipe      |
| `site-loader.tsx`     | **client**                    | §3.1                                                                  |
| `scroll-to-top.tsx`   | **client**                    | fixed, logical-inset positioned                                       |
| `stat-card.tsx`       | server                        | wraps `Counter`                                                       |
| `icon-card.tsx`       | server                        | lucide icon + title + body + optional link                            |
| `process-step.tsx`    | server                        | numbered step, connector line                                         |
| `cta-band.tsx`        | server                        | `variant: default \| full-width`                                      |
| `pagination.tsx`      | server                        | numbered pills, `aria-current="page"`                                 |

Every one is added to the existing granular `./components/*` export map — no
barrel file, so a page importing `Counter` does not pull `Marquee`.

**Gap found on re-verification (2026-09-03):** §4.3's `about-accordion.tsx`
section has no primitive behind it — `@repo/ui` has **no Accordion**
(confirmed: nothing matching `accord` in `packages/ui/src/components/`), and
the reference's "Who we are / What we do / How it works" block plus the
homepage FAQ section both need one. Add `accordion.tsx` to the table above
via `shadcn add accordion` against the Base UI registry (ADR-013) — do **not**
hand-roll a `<details>` cluster, and do not hand-copy stale source
(Module 07 SKILL.md). It carries the same RTL + focus-ring checklist as every
other component here.

### 4.2 Improved existing components

- `button.tsx` — add `size: xl`, a pill radius variant, optional
  trailing-icon slide.
- `badge.tsx` — add `eyebrow` and `pill` variants.
- `card.tsx` — add `variant: default | elevated | bordered | featured`,
  reusing `.card-hover` (no second hover treatment).
- `page-loader.tsx` — unchanged; `SiteLoader` is a sibling, not a rewrite.

### 4.3 Public section components — `app/(public)/[locale]/_sections/`

Thin composition over `@repo/ui` primitives; data comes from settings,
`@repo/core` and the catalogs. One file per section:

`hero.tsx` (`centered | split | background`), `trust-logos.tsx`,
`account-cards.tsx`, `about-accordion.tsx`, `stats.tsx`, `things-we-trade.tsx`,
`market-band.tsx`, `how-it-works.tsx`, `awards.tsx`, `download-app.tsx`,
`latest-news.tsx`, `glossary-spotlight.tsx`, `newsletter-cta.tsx`,
`risk-disclaimer.tsx`.

`_sections/registry.ts` maps a section `key` → component + accepted variants,
replacing the `switch` in `page.tsx`. Unknown keys still render the existing
honest stub.

---

## 5. Content / display management strategy

### 5.1 Presentation control (no schema change) — Phase A

Extend `home.sections` in `packages/contracts/src/settings.ts`:

```ts
const homeSectionSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  order: z.number().int(),
  variant: z.string().optional(), // validated against the registry
  limit: z.number().int().min(1).max(24).optional(),
});
```

Additional new settings (group `layout`, all `isPublic`):

- `layout.pageLoader: boolean`
- `header.topBar: { enabled, phone, promoText, promoUrl }`
- `header.showSearch: boolean`
- `footer.showPaymentBadges: boolean`, `footer.appLinks: [{ platform, url }]`

Structural copy (section headings, eyebrows, CTA labels) lives in the **i18n
catalogs**, per code-style rule #2 — that is the translatable home for
interface text, and it keeps four locales in lockstep via CI.

Real content keeps coming from the sources that already own it: articles
(`getPublishedArticles`), glossary (`getPublishedGlossary`), navigation
(`buildNavigation`), social links, brand assets, legal settings.

### 5.2 Admin-authored section content — Phase B (needs a decision)

The brief asks that titles, descriptions, **images**, buttons, featured status
and ordering all be admin-managed. Phase A covers ordering, visibility,
variant, item counts and CTA URLs. It does **not** cover admin-authored,
per-locale card copy with uploaded images for the marketing sections
(accounts, things-we-trade, awards, download-app).

That genuinely requires storage — a Settings JSON blob cannot carry
translations or media relations without duplicating the translation workflow.
Phase B would add, behind a new ADR:

- `HomeSectionItem` (+ `HomeSectionItemTranslation`) in `packages/db`, with a
  `MediaAsset` relation reusing the ADR-017 upload pipeline;
- a `@repo/core` service `listHomeSectionItems(sectionKey, locale)` plus admin
  CRUD guarded by `requirePermission` + `recordAudit`;
- an admin screen under `/admin/appearance/homepage`.

**This is the one fork in the plan and it is the user's call** — see §10.

### 5.3 Small `@repo/core` additions (no schema change, both phases)

1. `buildMenu(menuKey, locale, subject) → { key, name, items }` — the footer
   needs the menu's own name for its column heading. Same `navigation` cache
   tag.
2. `getArticleFacets(locale) → { categories, tags, archives, latest }` — the
   blog sidebar. Cached, tagged with the existing article tag.
3. `q` (title/excerpt search) added to `ListPublishedArticlesOptions`, parsed
   through a `@repo/contracts` schema at the route boundary.

---

## 6. Page-by-page plan

### 6.1 Header

Top bar (contact + promo, settings-gated) → sticky main bar with logo, centred
nav, search toggle, mode/locale/auth cluster, pill CTA. The sticky bar shrinks
on scroll via CSS `position: sticky` + scroll-driven `animation-timeline:
scroll()` — no scroll listener. Dropdowns become proper nav items with an
underline sweep instead of ghost buttons. Mobile keeps the existing `Sheet`.

Search: the public surface has **no search backend today**
(`admin-search.tsx` is admin-only and must not be imported here —
architecture #5). Phase A ships the toggle wired to `/news?q=` using the new
`q` option from §5.3. Full-site search stays out of scope.

### 6.2 Homepage

Sections per §4.3, assembled by the registry, ordered and toggled by
`home.sections`. Hero gains `centered | split | background` variants; `split`
is the default and reuses `ImageReveal`.

### 6.3 News & Analysis (`image-10.png`)

- Page header band: title + breadcrumbs (honours `layout.showBreadcrumbs`).
- 2-column card grid + sticky sidebar (search, categories, latest posts,
  popular tags, archives) from `getArticleFacets`.
- Card: image zoom on hover, category pill, title, excerpt, author + date row
  (respecting `articles.showAuthor` / `articles.showReadingTime`).
- Numbered `Pagination`.
- `variant: standard | featured | compact` on `ArticleCards`; `/analysis`,
  category and tag archives reuse the same component.
- Subscribe CTA band above the footer.

### 6.4 Footer

Four titled menu columns (via `buildMenu`), brand block with app badges and
payment badges (both settings-gated, admin-uploaded assets — **no third-party
logos committed to the repo**), social row, disclaimer, copyright. The
newsletter form becomes real: progressive-enhancement server action, honeypot
plus per-IP rate limit per security rule #13.

### 6.5 Remaining public pages

Glossary index/detail, `/analysis`, article detail, sign-in and the
error/not-found pages get the `Section` + `Container` + `SectionHeading`
rhythm, so nothing hand-rolls spacing after this lands.

---

## 7. Implementation phases

Each phase is independently shippable, ends green on
lint → typecheck → test → build, and gets a DEVLOG entry.

| #   | Phase                     | Main files                                                                                                                           |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Tokens + palette          | `packages/theme/src/index.ts`, its tests + snapshots, `packages/ui/src/styles/globals.css`                                           |
| 2   | `@repo/ui` primitives     | 14 new `components/*.tsx`, `button`/`badge`/`card` variant additions, unit tests                                                     |
| 3   | Settings + core reads     | `packages/contracts/src/settings.ts`, `packages/db/prisma/seed.ts`, `packages/core/src/{navigation,public-articles}.ts`, catalogs ×4 |
| 4   | Header + footer           | `_components/{header,footer,top-bar,newsletter-form}.tsx`                                                                            |
| 5   | Homepage sections         | `_sections/*`, `_sections/registry.ts`, `page.tsx`                                                                                   |
| 6   | News & Analysis           | `news/_components/{article-list,article-sidebar}.tsx`, `pagination`, `news/page.tsx`, `analysis/page.tsx`, archives                  |
| 7   | Remaining pages + cleanup | glossary, article detail, sign-in, error/not-found; delete superseded ad-hoc spacing/hover CSS                                       |
| 8   | Verification              | §9                                                                                                                                   |
| —   | _Phase B (optional)_      | DB models + admin screen, only if approved                                                                                           |

---

## 8. Governance

**ADR-018 — Public design system and motion strategy** (written _before_ Phase
1 code, per plan Part F #10). Records: CSS-first motion with no animation
library and why; the `Reveal` server-wrapper + single-observer pattern; the
no-JS/reduced-motion visibility guarantee; the preloader deviation (§3.1) with
its 900 ms cap and kill switch; the public-only display type scale.

**ADR-019 — Homepage section content model** — only if Phase B is approved.

**DEVLOG:** one append-only entry per phase (date, module, what shipped,
decisions, test results). The Modules 07/08/12/15 rows in `claude.md`'s index
get their status lines updated at the end.

No existing ADR is edited. Nothing here contradicts ADR-003, ADR-004, ADR-006,
ADR-008, ADR-013 or ADR-017.

---

## 9. Testing & verification

Per `.claude/rules/testing.md`:

- **Unit (`@repo/ui`, vitest + RTL):** each new primitive renders; `Reveal` is
  visible without JS; `Counter` jumps to its final value under reduced motion;
  `Marquee` and `ScrollToTop` use logical properties (extend the existing
  `rtl.test.tsx`); `Pagination` marks `aria-current`.
- **`@repo/theme`:** retarget the `#C28D5A` contrast assertions to `#E8B98C`,
  refresh snapshots, keep the fast-check property test green (90% floor).
- **`@repo/contracts`:** the extended `homeSectionSchema` rejects an unknown
  variant and an out-of-range `limit`; the registry-completeness test still
  passes both directions.
- **`@repo/core`:** integration tests (Testcontainers) for `buildMenu` and
  `getArticleFacets`; search `q` returns only published rows (80% floor).
- **CI scripts:** `check-catalog-completeness` (four locales),
  `check-phantom-deps` (new imports declared), `governance:check`.
- **Manual/tooling sweep** — E2E remains deferred repo-wide, so this is the
  closing gate, run with Chrome DevTools MCP: desktop/tablet/mobile,
  light/dark, `en` + `ar` (`dir=rtl`, no horizontal overflow),
  `prefers-reduced-motion`, keyboard focus order, loading and hover states,
  and a Lighthouse run on `/` and `/news` against the public budget.
- **Cleanup pass:** remove superseded ad-hoc spacing/hover CSS and any section
  markup the primitives replace.

---

## 10. Open decision — RESOLVED 2026-09-03

**Decision: Phase A only.** Phase B (§5.2) is **not** being built. Admins get
ordering, visibility, layout variant, item counts and CTA URLs; all structural
copy and section headings come from the i18n catalogs across `en/es/ar/ur`,
per code-style rule #2. No DB schema change, no ADR-019, no
`/admin/appearance/homepage` screen — which keeps the brief's "do not change
backend/database architecture unless genuinely required" line intact.

Recorded so the tradeoff is not rediscovered later: `Setting.isTranslatable`
exists as a flag on the `Setting` model but has **no translation table behind
it**, so settings-authored marketing copy would be single-locale today. That
is the real argument for Phase B, and it is why catalog-translated copy — not
a settings blob — is the Phase A answer. Phase B stays available as a future
increment behind its own ADR; nothing in Phase A forecloses it.

---

## 11. Risks

1. ~~**`#E8B98C` contrast.**~~ **Resolved 2026-09-03** — measured against the
   engine: button ink passes at 9.74:1 and `validateMode` emits no blocking
   error. Superseded by a narrower constraint: raw `--primary` is unusable
   for thin or small elements on light surfaces (§2.1's new rule).
2. **Lighthouse budget.** Reveal/marquee/counter are cheap; the preloader and
   hero imagery are not automatically so. The budget check is a gate, not a
   formality.
3. **Scroll-driven animation support.** `animation-timeline` is not universal;
   the `@supports` fallback path needs a real browser check, not a spec read.
4. **Reference fidelity vs. RTL.** Several reference effects are
   direction-hardcoded; each gets a logical-property equivalent, verified in
   `ar`.
5. **Scope.** Seven phases across four packages and the whole public surface.
   Phases are ordered so each is independently shippable if the work is cut
   short.

---

## 12. Phase 9 — Admin management of the design system (PLAN, not yet built)

**Status:** proposed 2026-09-04, after Phases 1–8 shipped. Nothing below is
implemented.

The brief asked for "a manageable homepage section system where sections can be
enabled/disabled and ordered from the admin without duplicating frontend code."
Phases 3–5 built the **data contract** and the **frontend** for that; what is
still missing is the **admin UI**. Today an admin configures the entire public
design system by hand-editing raw JSON in a textarea.

### 12.1 Audit — what the admin surface actually does today

`settings-group-form.tsx` renders one control per setting, chosen by TYPE plus
the `SETTING_WIDGETS` hints in `@repo/contracts`
(`timezone`/`locale`/`select`). Every `JSON`-typed key falls through to a
`<Textarea rows={6} className="font-mono">` holding
`JSON.stringify(value, null, 2)`.

So all six of these are hand-edited JSON blobs:

| Key                      | Shape                                          | Added        |
| ------------------------ | ---------------------------------------------- | ------------ |
| `home.sections`          | 13 × `{key, enabled, order, variant?, limit?}` | Phase 3      |
| `header.topBar`          | `{enabled, phone, promoText, promoUrl}`        | Phase 3      |
| `footer.appLinks`        | `[{platform, url}]`                            | Phase 3      |
| `header.cta`             | `{enabled, label, url}`                        | pre-existing |
| `header.announcementBar` | `{enabled, text, dismissible}`                 | pre-existing |
| `footer.menuColumns`     | `[{menuKey, order}]`                           | pre-existing |

`home.sections` is the worst of these: 13 objects, ~60 lines of JSON, where a
mistyped `variant` is now _correctly rejected_ by Phase 3's `superRefine` — but
the admin gets a validation error with no way to discover which variants a
section actually accepts.

**What is already correct and must NOT be rebuilt:** `updateSettingsAction`
already requires `settings.update`, parses through `updateSettingsBatchSchema`,
rejects unknown keys, validates every value against `SETTINGS_SCHEMAS` before
writing any, and writes one audit row per key. **No new server action and no new
permission key are needed for any screen below** — they all submit through the
existing action. This is the single biggest simplification available, and the
plan depends on it.

### 12.2 The registry drift this exposes (measured, not hypothetical)

Three lists are keyed by the same section strings and nothing keeps them in
agreement:

- `packages/db/prisma/seed.ts` — **13** seeded keys
- `HOME_SECTION_VARIANTS` (`@repo/contracts`) — **9** keys
- `SECTION_COMPONENTS` (`_sections/registry.ts`) — **6** keys

Which leaves, as of today:

- **Variants declared but no component** (renders the "coming soon" stub, yet
  the admin can pick a variant for it): `learning_paths`, `featured_lessons`,
  `popular_tools`, `forex_rates`
- **Component but no variants** (correct — it takes none): `risk_disclaimer`
- **Seeded but in neither registry**: `economic_events`, `market_sentiment`,
  `trading_sessions`

None of this is a bug today (unknown keys stub honestly, by design), but an
admin screen must not offer a variant dropdown for a section that has no
component behind it without saying so.

### 12.3 Scope

**In:** an admin screen for `home.sections`; structured editors for the
JSON-shaped `layout`-group keys; the nav/hub wiring; catalogs ×4; tests.

**Out, deliberately:**

- **Phase B** (per-locale admin-authored marketing copy + images, its own DB
  models) — unchanged from the Phase 3 decision.
- **The design tokens themselves.** Section spacing, elevation tiers, easings
  and the display type scale are NOT admin-editable and must not become so —
  same reasoning as ADR-003's derived hover states: an admin sets brand
  colours, the system derives everything that can fail.
- **A generic page builder.** The brief rules it out explicitly.

### 12.4 Part A — Homepage sections manager

New screen at **`/admin/homepage`** (flat, matching the existing
`/admin/{features,navigation,social,theme}` convention — not a new
`/admin/appearance/*` tree for one page).

- **Files:** `app/(admin)/admin/homepage/page.tsx` (server: permission + data)
  and `homepage-sections.tsx` (client: the editor).
- **Permission:** `requirePermission("settings.update")` on the page;
  `updateSettingsAction` re-checks it server-side (the screen gate is UX, never
  the authorization — security.md #1).
- **Rows** come from the union of the saved value and the known keys, so a
  section an admin previously removed is still re-addable.
- **Per row:** ArrowUp/ArrowDown reorder, enable/disable `Checkbox`, a `variant`
  `Select` populated from `HOME_SECTION_VARIANTS[key]`, and a `limit` number
  input (min 1 / max 24, mirroring the schema). A section with no declared
  variants shows no dropdown rather than an empty one.
- **Honesty requirement:** rows whose key is absent from the built-keys list
  render a "not built yet — shows a placeholder" badge. An admin should not
  discover that by publishing.
- **Save:** collect the array →
  `updateSettingsAction([{ key: "home.sections", value }])`. One Save for the
  screen, matching the changes-02 "one section = one form = one Save" rule.
- **Reuse:** ordering follows `MenuItemControls`' ArrowUp/ArrowDown idiom, but
  reorders a LOCAL array (one JSON setting) instead of calling a per-item
  action — no new action, no per-row round trip.

`SECTION_COMPONENTS` lives in the `(public)` tree and **must not be imported by
`(admin)` code** (architecture #5). The screen needs the list of built keys, so
export a plain `HOME_SECTION_BUILT_KEYS: readonly string[]` from
`@repo/contracts` and have the public registry be checked against it (12.6),
rather than reaching across surfaces.

### 12.5 Part B — Structured editors for JSON settings

Rather than six bespoke forms, extend the mechanism that already exists. Add to
`@repo/contracts` a `SETTING_FIELDS` registry: setting key → an ordered list of
field descriptors (`{name, type: "string" | "boolean" | "url" | "select",
label, options?}`), plus `"object"` and `"list"` as two new `SettingWidget`
kinds.

`settings-group-form.tsx` then grows two renderers — `ObjectField` and
`ListField` (add / remove / reorder rows) — and the raw JSON textarea becomes
the **fallback** for keys with no declared fields, not the default.

Covers `header.topBar` and `footer.appLinks` (Phase 3's additions) and retrofits
`header.cta`, `header.announcementBar` and `footer.menuColumns` for free.
`footer.menuColumns`' `menuKey` becomes a Select of real menus rather than a
free-text string an admin can typo.

**Why registry-driven rather than per-key components:** it is the same choice
`SETTING_WIDGETS` already made, it keeps the field list beside the Zod schema
that validates it, and it makes the next JSON setting a data change rather than
a new form.

### 12.6 Part C — Cross-cutting

- **Catalogs ×4** for every new label (`en/es/ar/ur`), real translations —
  `check:catalog-completeness` only checks presence, so an en-copy would pass CI
  while shipping English into an RTL page.
- **New CI check** (`scripts/check-home-sections.mjs`): every key in the seeded
  `home.sections` default must appear in `HOME_SECTION_BUILT_KEYS` **or** be
  explicitly listed as a known stub; and every key in `HOME_SECTION_VARIANTS`
  must be a real seeded key. This is what stops 12.2's three-way drift from
  getting worse silently.
- **Tests:** contracts — `SETTING_FIELDS` covers every JSON-typed key or
  explicitly opts out; `HOME_SECTION_BUILT_KEYS` agrees with the public
  registry. Web — the sections editor reorders/toggles and submits exactly one
  batched entry; a section with no variants renders no dropdown; a not-built
  section is labelled.

### 12.7 Phases

| #   | Phase                    | Main files                                                                                                                                      |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 9a  | Contracts + CI check     | `packages/contracts/src/settings.ts`, `scripts/check-home-sections.mjs`, tests                                                                  |
| 9b  | Homepage sections screen | `app/(admin)/admin/homepage/{page,homepage-sections}.tsx`, `admin-shell.tsx` (sidebar entry), `settings-shared.ts` (hub/nav entry), catalogs ×4 |
| 9c  | Structured JSON editors  | `settings-group-form.tsx` (+ `ObjectField` / `ListField`), catalogs ×4                                                                          |

Each ends green on lint → typecheck → test → build and gets its own DEVLOG
entry. 9a is a prerequisite for 9b; 9c is independent and can ship first or
last.

### 12.8 Governance

**No new ADR is required.** Nothing here deviates from a locked plan line: Part
A is the admin half of the section system plan.md already calls for, Part B
extends an existing registry, and no new permission, model or migration is
introduced. If Part B's field registry grows into anything resembling a form
BUILDER, that crosses the brief's "no page builder" line and needs an ADR first.

### 12.9 Risks

1. **Scope creep into a page builder.** The field registry is deliberately flat
   (no nesting, no conditionals). If a setting needs more than that, it wants
   its own screen, not a richer registry.
2. **Registry drift** — mitigated by 12.6's CI check; without it, Part A's UI
   will confidently offer variants for sections that do not render.
3. **`home.sections` is a single JSON value.** Two admins saving the screen
   concurrently last-write-wins the whole array. Acceptable at this scale and
   consistent with every other settings screen, but worth stating rather than
   discovering.
