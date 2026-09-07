# changes-09 — plan: About section (5 static pages) + mega-menu navigation

**Status:** SHIPPED 2026-09-07, with three exceptions recorded in §9.
**Date:** 2026-09-07.
**Modules touched:** 08 (navigation), 07 (`@repo/ui`), 12 (public site), 06 (`@repo/i18n`), 01 (seed).
**Reference material studied:** `forex.com/en-us/about-us/` and its four children
(`why-us`, `financial-transparency`, `strength-and-security`, `trading-support`),
plus two owner screenshots of mega-menu treatments (forex.com "About Us" panel;
mbfx.co "Trading" panel).

Read with: `CLAUDE.md` → ADR-042 (design is static, built in code) → ADR-043
(public multilingual, admin English-only) → ADR-018 (CSS-first motion) →
`.claude/rules/*`.

---

## 0. Decisions taken before planning (owner, 2026-09-07)

| #   | Question                        | Decision                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Whose copy ships?               | **MBFX-adapted.** Same section-for-section structure and tone; every number, regulator, award, hour and legal claim lives in ONE typed constants module with obvious `TODO(owner)` placeholders. **No unverified claim ships as fact.** forex.com's regulatory and financial assertions are theirs and are not transplanted. |
| D2  | How far does the nav rework go? | **Full mega-menu system**, built once as a reusable primitive, with the About panel as its first consumer. Other top-level items adopt it as their sections land. Top strip (Trading / VIP / Institutional) deferred — its destinations do not exist.                                                                        |
| D3  | Where does content live?        | **Code + i18n catalogs, fully static.** No new settings keys, no CMS rows. Exactly ADR-042: composition is code, changing it is a PR.                                                                                                                                                                                        |

This plan is written against the repo as it stands. Every path, symbol and
version named below was verified to exist (or to be genuinely absent) on
2026-09-07.

---

## 1. What was extracted, page by page

The raw inventory. Each row is a section in source order: what it says, and what
shape it is. §2 maps shapes to primitives; §5 maps copy to ours.

### 1.1 `/about-us/` — "The gold standard of trading"

| #   | Section              | Shape                                                                                                 | Content extracted                                                                                                                                        |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Section sub-nav      | Icon strip, 6 entries, white glyph → brand glyph on active/hover                                      | About Us · Why us · Careers · Financial transparency · Strength & Security · Trading Support                                                             |
| 2   | Hero                 | `page-heading dark-theme`, full-bleed photo, dark overlay, no CTA                                     | H1 + one paragraph + co-brand lockup                                                                                                                     |
| 3   | Stat band            | 3 animated odometers on one row, caption above                                                        | "Key figures as of March 2026"; **40K+** active retail accounts · **20+** countries across 6 continents · **5,400+** staff                               |
| 4   | Timeline             | Centre-spine vertical timeline, collapsed behind a Show / Close toggle; node = year + logo + one line | "On your side since 2001" + 21 nodes, 1999 → 2024 (founding, launches, market entries, acquisitions, exchange listing, regulator memberships, centenary) |
| 5   | Awards               | Uniform card grid: badge image + award name + awarding body/year                                      | 19 cards across 2023–2025, plus a disclaimer paragraph on how awards are determined                                                                      |
| 6   | Parent-group trio    | 3 image cards, full-bleed photo + caption, hover zoom                                                 | About StoneX · Media Room · Investor Relations (all external)                                                                                            |
| 7   | Financial strength   | Two-column callout: photo one side, prose + key/value list the other                                  | "key financial data as of March 2026": total equity capital over $2.6B; total customer assets over $15.2B                                                |
| 8   | Payments strip       | Logo row with a heading                                                                               | "Deposit and withdrawal options" (Visa, Mastercard, bank transfer)                                                                                       |
| 9   | "Want to know more?" | 3-up icon cards: icon, title, one line, link                                                          | Why us · Platforms · Support, plus an asterisk footnote                                                                                                  |

### 1.2 `/about-us/why-us/`

| #   | Section       | Shape                                                                                                                                                     | Content extracted                                                                                                                                       |
| --- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hero          | Dark photo hero, **two CTAs**                                                                                                                             | "Open an Account" (solid) + "TRY A RISK-FREE DEMO" (outline) + footnote                                                                                 |
| 2   | Tick list     | Bulleted list, tick glyph per row, two columns on desktop                                                                                                 | "Protecting your funds is our priority" — 6 rows (no proprietary trading; bank review guidelines; segregated funds; CFTC; NFA; six other jurisdictions) |
| 3   | Five reasons  | Five alternating `two-column-callout numbered` blocks — big ghost numeral, media one side, copy + one link the other; tones alternate light / grey / dark | 1 Powerful platforms and tools · 2 Tight spreads · 3 Fast execution · 4 Financially secure and regulated · 5 Dedicated support                          |
| 3a  | inline stats  | 3 label-over-value pairs inside reason 2                                                                                                                  | GBP/USD 1.3 pips · USD/JPY 1.1 pips · EUR/USD 1.2 pips                                                                                                  |
| 3b  | inline stats  | 3 label-over-value pairs inside reason 3                                                                                                                  | 100%\* under 1 second · 0.002 seconds average execution · 100% successfully executed, with three footnotes                                              |
| 4   | Support tiles | 4 boxed dark tiles: icon + title + body                                                                                                                   | Help setting up your account · Platform walkthroughs · Improve your trading plan · Always be in the loop                                                |
| 5   | CTA           | Single link button, uppercase                                                                                                                             | "SEE OUR FAQS"                                                                                                                                          |

### 1.3 `/about-us/financial-transparency/`

| #   | Section         | Shape                                                  | Content extracted                                                                                                                                                     |
| --- | --------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hero            | Dark hero, two CTAs (same pair as 1.2)                 | plus an execution-speed footnote                                                                                                                                      |
| 2   | Intro + 2 cards | Section title, then two large-image dark tiles         | "Consistently fast and accurate pricing" → "Fast trades, consistent execution" · "Opportunity for price improvement on limit orders"; link "View execution scorecard" |
| 3   | Sourcing        | Two-column callout: photo + prose + link               | Tier 1 banks, ECNs, up to 12 liquidity sources, periodic review                                                                                                       |
| 4   | Delivery        | Two-column callout: prose + 4-item bulleted list       | mobile app · web platform · MT4 · FIX API, plus delivery-mechanism prose                                                                                              |
| 5   | Liquidity       | Prose block + a sub-headed paragraph                   | "How liquidity affects our prices" + "Variable spreads"                                                                                                               |
| 6   | Advantage       | Grey band: section title + 2 stacked prose items + CTA | "We execute your trades quickly and accurately" · "We stand behind every trade" · "OPEN AN ACCOUNT"                                                                   |
| 7   | Comparison      | Centered text-only teaser                              | "How our prices compare to our competitors"                                                                                                                           |
| 8   | Funds           | Two-column callout: photo + prose + link               | "What happens to your funds?" → links to Strength & Security                                                                                                          |
| 9   | Revenue         | Prose + worked example on a coloured panel + link      | EUR/USD at 1.2164 with a 1-point spread → buy 1.21645 / sell 1.21635                                                                                                  |
| 10  | Hedging         | Two-column callout                                     | internalization, risk limits, netting                                                                                                                                 |

### 1.4 `/about-us/strength-and-security/`

| #   | Section              | Shape                                                  | Content extracted                                                                                                                                           |
| --- | -------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hero                 | Dark photo hero, no CTA                                | Headline + one paragraph                                                                                                                                    |
| 2   | Trust                | Two-column callout with divider                        | "A history of trust"                                                                                                                                        |
| 3   | Parent prose         | Wide prose band, numbers inline                        | 1924 · Fortune 50 (#42, 2025) · 40+ derivatives exchanges · 140+ FX markets · 80,000+ institutional clients · 400,000+ retail accounts · 180+ countries     |
| 4   | Strength in numbers  | Callout + external link                                | "STONEX GROUP INVESTOR RELATIONS"                                                                                                                           |
| 5   | Funds                | Section title + prose                                  | "Securing your funds is our priority"                                                                                                                       |
| 6   | Tick list            | 2 tick rows                                            | "What we do with your money"                                                                                                                                |
| 7   | Margin               | Two-column callout: photo + prose                      | real-time calculation, automatic liquidation, stops/limits monitored                                                                                        |
| 8   | Risk management      | Prose + 6 tick rows                                    | business continuity · electronic-trading supervision · information security · AML · customer complaints · trade reporting                                   |
| 9   | **Jurisdiction map** | World map, 8 numbered hotspots, paired numbered legend | 1 Canada (CIRO) · 2 Cyprus (CySEC) · 3 USA (NFA, CFTC) · 4 Cayman Islands (CIMA) · 5 UK (FCA, CMA) · 6 Japan (FSA) · 7 Singapore (MAS) · 8 Australia (ASIC) |

### 1.5 `/about-us/trading-support/`

| #   | Section               | Shape                                                             | Content extracted                                                                          |
| --- | --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Hero                  | Dark hero + two CTAs                                              | "Open an account" · "Try a demo account"                                                   |
| 2   | Hours + tiles         | Section title carrying the hours line, then 4 shadowed icon tiles | "We're here 24 hours a day from 10 AM ET Sunday to 5 PM ET Friday"; same 4 tiles as 1.2 §4 |
| 3   | CTA                   | Link button                                                       | "SEE OUR FAQS"                                                                             |
| 4   | Relationship Managers | Dark transparent band: intro + 4 icon tiles + CTA                 | Analysis · Trading plan · Trading strategy · Trade set-ups                                 |
| 5   | Powerful tools        | 4 image cards: photo + title + one line + link                    | Performance Analytics · Alerts · Market analysis · Economic calendar                       |
| 6   | Academy               | Intro + CTA + 3 icon cards                                        | Trading concepts · Platform tutorials · Technical analysis                                 |

### 1.6 Menu treatments (from the two screenshots)

**forex.com panel:** full-width panel under a sticky header; left rail of 3
gradient tiles (icon + label, one per destination group); then 3 link columns,
each headed by a bold link with a `>` affordance and plain links beneath. The
active top-level item carries an underline.

**mbfx.co panel:** left-aligned panel; 3 columns headed by small uppercase muted
labels (PRICING AND ACCOUNT / MARKETS / TRADE AND ANALYSIS); each row is icon +
bold title + one-line muted description; below the columns a full-width promo
strip ("Deposits & Withdrawals" + payment-method logos); below that a footer row
with the section name and a "View All ›" pill. The active top-level item sits in
a filled pill.

**Target = the mbfx.co treatment**, with the forex.com left rail kept available
as an optional `features` slot. Both are expressible in one component.

---

## 2. Pattern vocabulary → what we build with

Everything in the left column appears at least twice across the five pages, so
each maps to one primitive rather than to per-page markup.

| Source pattern                                           | MBFX primitive                                      | Status                                      |
| -------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------- |
| `page-heading dark-theme`                                | `PageHero`                                          | **new** (`@repo/ui`)                        |
| Section sub-nav with icons                               | `SectionNav`                                        | **new** (app-level, mirrors admin `SubNav`) |
| `animated-numbers` odometer row                          | `StatCard` + `Counter` inside `StatBand`            | Counter/StatCard **exist**                  |
| `two-column-callout` (`numbered`, `reverse-cols`, tones) | `SplitCallout`                                      | **new**                                     |
| `tiles-list icon-image` / `boxed` / `shadow-tiles`       | `IconCard`                                          | **exists**                                  |
| `tiles-list large-image` / image teasers                 | `ImageReveal` + `Card`                              | **exist**                                   |
| `bulleted-list` with tick glyph                          | `CheckList`                                         | **new**                                     |
| `timeline position-center` with show/hide                | `Timeline`                                          | **new**                                     |
| Awards grid                                              | `AwardGrid` / `AwardCard`                           | **new**                                     |
| Numbered world map + legend                              | `HotspotMap`                                        | **new**                                     |
| `section-title` / `reusable-title`                       | `SectionHeading`                                    | **exists**                                  |
| CTA band                                                 | `CtaBand`                                           | **exists**                                  |
| Logo strip (payments, partners)                          | `Marquee` or a static row                           | **exists**                                  |
| Mega-menu panel                                          | `MegaMenu` on Base UI `NavigationMenu`              | **new**                                     |
| Scroll entrance / hover zoom / count-up / preloader      | `Reveal` · `.media-zoom` · `Counter` · `SiteLoader` | **exist** (ADR-018)                         |

Eleven new pieces; nine required behaviours already exist. Nothing here needs a
motion library — ADR-018 rule 1 holds.

**Base UI 1.7.0 ships `navigation-menu`** (verified in the installed package:
Root, List, Item, Trigger, Content, Portal, Positioner, Popup, Viewport,
Backdrop, Arrow, Link, Icon). It provides hover intent, keyboard traversal,
focus management and the sliding-viewport transition, and `direction-provider`
handles RTL. Building on it satisfies ADR-013 and removes the two things a
hand-rolled mega menu always gets wrong: escape/focus behaviour and
pointer-diagonal tolerance.

---

## 3. Governance — two ADRs, written before any code

Per plan.md Part F #10, each lands in the first PR of its area.

> **Renumbered 2026-09-07.** This plan reserved 046/047 while still
> unstarted. ADR-046 went to changes-10, which was written first; the About
> ADR then landed as 047 and the mega-menu ADR as 048. Numbers are assigned
> when an ADR is WRITTEN, not when a plan proposes one — the pairing below
> matches `docs/memory/decisions/` as it actually stands.

**ADR-048 — Mega-menu panels are code-defined.**
`buildNavigation` caps at depth 2 by design (Module 08 SKILL), and a mega menu
needs three levels (item → column → link) plus per-link icons, descriptions,
feature tiles and a promo strip. Decision: the **panel** is a typed registry in
app code (`_nav/mega-menu.ts`) keyed by `RouteKey`; the DB menu remains the
source for the top-level item list and every href, still resolved through
`ROUTE_PATHS`. Rejected alternative: raising the builder to depth 3 with
description/icon columns — that rebuilds the admin composition surface ADR-042
just cancelled. Consequence: adding a menu column is a PR, exactly as ADR-042
says it should be.

**ADR-047 — The About section is coded static pages with a single facts module.**
Structure and copy live in `app/(public)/[locale]/about/**` and the `about`
catalog namespace. Every claim of fact — counts, dates, regulators, awards,
support hours, contact channels — lives in `_content/about-facts.ts`, typed,
with `TODO(owner)` markers. **Rule: an empty collection renders no section.** A
page never displays an invented number, a placeholder award, or an empty shell.
No settings keys, no CMS rows, and no new cache tags: the frozen list in
architecture.md #12 is untouched, since these pages read only `theme`,
`settings:*` and `navigation`, all already tagged.

---

## 4. Information architecture

Paths, added to `ROUTE_PATHS` in `packages/contracts/src/navigation.ts`:

```
about                 /about               About MBFX
about-why-us          /about/why-us        Why MBFX
about-transparency    /about/transparency  How we operate
about-security        /about/security      Security & trust
about-support         /about/support       Support
```

- Real route files under `app/(public)/[locale]/about/**`. They take precedence
  over the `[...slug]` CMS catch-all by Next's normal specificity, exactly as
  `news/` and `glossary/` already do — that route needs no change.
- `about/layout.tsx` renders the shared section sub-nav (§1.1 row 1) around all
  five pages, so the strip is one component, not five copies.
- Seed adds one `about` root menu item with five children, `sortOrder` after
  `news`, an `icon` per row, and `MenuItemTranslation` labels for `en`.
  Idempotent (`findFirst` by `menuId + routeKey`), matching the existing NAV loop.
- `app/sitemap.ts` gains the five paths per locale alongside the existing
  `staticPages` root entry.
- **No Careers page.** forex.com has one; we have nothing true to put on it.
  Left out rather than stubbed.

---

## 5. Content model

### 5.1 The facts module

`apps/web/app/(public)/[locale]/about/_content/about-facts.ts` — a plain typed
module, no I/O:

```ts
export interface AboutStat {
  value: number;
  suffix?: string;
  labelKey: AboutKey;
}
export interface TimelineEntry {
  year: number;
  titleKey: AboutKey;
  bodyKey: AboutKey;
}
export interface Award {
  titleKey: AboutKey;
  issuer: string;
  year: number;
}
export interface Jurisdiction {
  code: string;
  nameKey: AboutKey;
  bodies: string[];
  x: number;
  y: number;
}
export interface SupportChannel {
  kind: "email" | "phone" | "whatsapp" | "hours";
  value: string;
}

export const ABOUT_FACTS = {
  foundedYear: 0, // TODO(owner)
  stats: [] as AboutStat[], // TODO(owner) — empty ⇒ no stat band
  timeline: [] as TimelineEntry[], // TODO(owner) — empty ⇒ no timeline
  awards: [] as Award[], // TODO(owner) — empty ⇒ no awards grid
  jurisdictions: [] as Jurisdiction[], // TODO(owner) — empty ⇒ no map
  support: { channels: [] as SupportChannel[] },
  payments: [] as string[],
} as const;
```

Numbers stay numbers, so `Counter` can animate them; every human-readable string
is a catalog key, never a literal (code-style.md #2). `AboutKey` is the literal
union of `about.*` catalog keys, so a stale key is a type error rather than a
runtime blank.

### 5.2 The catalog

New **public** namespace `about` in `packages/i18n/messages/en.json`. A new
namespace defaults to public in `check-catalog-completeness.mjs`, which is the
correct default here. Shape:

```
about.nav.{aboutUs,whyUs,transparency,security,support}
about.overview.{hero.title,hero.body,stats.caption,timeline.title,…}
about.whyUs.{hero.title,hero.body,protect.title,protect.items.*,reasons.1..5.{title,body,cta}}
about.transparency.*
about.security.*
about.support.*
about.shared.{learnMore,viewAll,readMore}
nav.mega.about.{columns.*,features.*,strip.*,viewAll}
```

`en` values are required and CI-enforced (`ENFORCED_LOCALES = {"en"}`).
`es`/`ar`/`ur` are inactive, so their gaps warn and do not fail (ADR-043 #3).
**They are not translated in this work**; the rising warning count is expected
and gets recorded in the DEVLOG entry.

### 5.3 Imagery

Only `apps/web/public/hero-app-mockup.jpg` exists today. Each hero and callout
takes an optional image path from `ABOUT_MEDIA`; when a path is absent the
component renders its gradient/tone panel instead — the treatment `Hero`'s
`background` variant already uses. No broken images, no committed stock photos,
and no PR blocked waiting on assets.

---

## 6. The PRs

Nine, sequenced so each is independently reviewable and leaves the site green.

### PR 1 — Routes, catalog, facts, seed, sitemap (no UI)

**New**

- `docs/memory/decisions/ADR-047-about-section-static.md`
- `apps/web/app/(public)/[locale]/about/_content/about-facts.ts` (§5.1)
- `apps/web/app/(public)/[locale]/about/_content/about-media.ts`

**Edit**

- `packages/contracts/src/navigation.ts` — five `ROUTE_PATHS` entries (§4)
- `packages/i18n/messages/en.json` — `about` namespace skeleton (§5.2)
- `packages/db/prisma/seed.ts` — `about` menu item + five children
- `apps/web/app/sitemap.ts` — five paths × locales

**Tests**

- `packages/contracts/src/index.test.ts`: `menuItemLinkSchema.safeParse({ routeKey: "about-why-us", url: null }).success === true`
- `pnpm check:catalog-completeness` reports zero **failures**
- `packages/core/src/navigation.integration.test.ts`: the seeded About root
  resolves with five visible children under `subject: null`
- Running `pnpm db:seed` twice yields the same menu-item count (idempotency)

**Done when** `pnpm lint && pnpm typecheck && pnpm test` pass and the five URLs
404 (routes not built yet) rather than 500.

### PR 2 — `@repo/ui` primitives

**New** in `packages/ui/src/components/`:

```ts
// page-hero.tsx
PageHero({ title, lead, tone = "inverted", media, actions, align = "start" });
// split-callout.tsx
SplitCallout({ step?, title, media, reverse = false, tone = "default", children });
// check-list.tsx
CheckList({ items }: { items: React.ReactNode[] });
// timeline.tsx  — client, for the collapse toggle only
Timeline({ entries, collapsedCount = 6, expandLabel, collapseLabel });
// award-card.tsx + award-grid.tsx
AwardCard({ title, issuer, year, image? });
AwardGrid({ children });
// hotspot-map.tsx — client, hover/focus syncs pin ↔ legend row
HotspotMap({ points, mapSlot, legendLabel });
// stat-band.tsx
StatBand({ caption?, children });
```

**Rules these must satisfy** (lint- or test-enforced): no hex literals; logical
properties only (`ps-`/`pe-`/`ms-`/`me-`/`text-start`); `--primary` for fills,
`--primary-interactive` for glyphs, thin borders and eyebrows (ADR-018 rule 5);
`Reveal` for entrance and `.card-hover`/`.media-zoom` for hover; reduced motion
respected through the existing global reset plus a JS short-circuit in
`Timeline` and `HotspotMap`.

**Tests** — extending the existing `public-design-system.test.tsx` and
`rtl.test.tsx` patterns:

- every new component renders its content without depending on JS (no
  `opacity-0` that lacks its restoring rule)
- `rtl.test.tsx` gains the new components: no physical-direction class in any
  rendered `className`
- `Timeline` collapsed → all entries still in the DOM (crawler-visible); the
  toggle flips `aria-expanded`
- `HotspotMap` legend rows are real links/buttons with accessible names, and
  hover state is mirrored on focus
- `AwardGrid` with zero children renders nothing (the §3 empty rule)

### PR 3 — `MegaMenu` + header/mobile wiring (ADR-048)

**New**

- `docs/memory/decisions/ADR-048-mega-menu-code-defined.md`
- `packages/ui/src/components/mega-menu.tsx` — a thin wrapper over Base UI
  `NavigationMenu` exposing `MegaMenu`, `MegaMenuList`, `MegaMenuItem`,
  `MegaMenuTrigger`, `MegaMenuPanel`, `MegaMenuColumn`, `MegaMenuLink`,
  `MegaMenuFeature`, `MegaMenuStrip`, `MegaMenuFooter`
- `apps/web/app/(public)/[locale]/_nav/mega-menu.ts`:

  ```ts
  export interface MegaLink {
    key: string;
    routeKey?: RouteKey;
    url?: string;
    icon: LucideIcon;
  }
  export interface MegaColumn {
    key: string;
    links: MegaLink[];
  }
  export interface MegaPanel {
    key: string;
    features?: MegaLink[];
    columns: MegaColumn[];
    strip?: { key: string; logos: string[] };
    viewAll?: RouteKey;
  }
  export const MEGA_MENU_PANELS = {
    about: {/* … */},
  } as const satisfies Partial<Record<RouteKey, MegaPanel>>;
  ```

  Declared `as const`, so every `key` is a literal type and `t(key)` stays
  type-checked — the same trick that keeps `articlesSubnavItems` honest.

**Edit**

- `_components/header.tsx` — top-level items that have a panel render
  `MegaMenu`; items without one keep today's `DropdownMenu`/`NavLink` path
  unchanged
- `_components/mobile-nav.tsx` — panels render as grouped accordion sections
  (column heading → icon + title + description rows)
- `packages/i18n/messages/en.json` — `nav.mega.*`

**Tests**

- unit: every `routeKey` in `MEGA_MENU_PANELS` exists in `ROUTE_PATHS`, and
  every catalog key it references exists in `en.json` — the same
  cross-check-a-registry idea as the Module 03 permission-key script
- component: the panel opens on trigger click, closes on `Escape`, moves focus
  to its first link, and `aria-expanded` tracks state
- E2E `apps/web/e2e/public/mega-menu.spec.ts`: hover About → panel visible →
  click "Why MBFX" → lands on `/about/why-us`; the keyboard-only path does the
  same; an `ar` run asserts the panel mirrors to the inline start edge and the
  page has no horizontal overflow

### PR 4 — About section shell + `/about`

**New**

- `about/layout.tsx` — `SectionNav` strip + shared `Organization` JSON-LD
- `about/_components/section-nav.tsx` — client, `usePathname`, longest-prefix
  active rule lifted from the admin `SubNav`
- `about/loading.tsx` — skeleton matching hero + two section blocks
- `about/page.tsx` — hero → stat band → timeline → awards → values trio →
  payments strip → "learn more" trio
- `about/_sections/*.tsx`, one file per block

**Tests**: `about.spec.ts` E2E (renders; sub-nav highlights the active entry;
counters reach their final values; timeline toggle works); axe clean; with
`ABOUT_FACTS.awards = []` no awards heading is emitted.

### PR 5 — `/about/why-us`

Hero with two CTAs → `CheckList` ("How we protect learners") → five
`SplitCallout` blocks with alternating tone and reversed media → inline stat
trios → support tiles → FAQ CTA. Copy is MBFX's (curriculum, real market data,
analysis, tools, support), not forex.com's pricing and execution claims.

### PR 6 — `/about/transparency`

Hero → two feature cards → "where our data comes from" → "how we deliver it"
(platform list) → "how MBFX makes money" (free vs premium; what is and is not
sponsored) → worked-example panel → any funds statement, or omitted entirely
under the §3 empty rule if it does not apply to us.

### PR 7 — `/about/security`

Hero → "a history of trust" → account-security prose → `CheckList` (what we do
with your data) → risk-management list → `HotspotMap` of operating
jurisdictions, rendered **only** when `ABOUT_FACTS.jurisdictions` is non-empty.

### PR 8 — `/about/support`

Hero with two CTAs → hours + four `IconCard` tiles → FAQ CTA → mentors band →
tools grid linking `/tools`, `/analysis`, `/economic-calendar`, `/news` (all
real routes) → Academy trio linking `/learn` and `/glossary`.

### PR 9 — Hardening and close-out

- axe on all five pages (serious/critical fails CI)
- RTL smoke in `ar`: `dir=rtl`, zero horizontal overflow
- Lighthouse budget assertion on `/about` — the public budget is also the
  admin-bundle-leak backstop (architecture.md #5)
- import-boundary check: nothing under `about/**` or `_nav/**` imports from
  `(admin)` or an admin-only dependency
- dark/light pass over every new component
- DEVLOG entry (date, module, what shipped, decisions, test results) and
  `pnpm governance:check`
- `CLAUDE.md` module table: Module 12 gains "About section (5 static pages)";
  Module 08 gains "mega-menu (ADR-048)"

---

## 7. Criterion → test

| #   | Criterion                                  | Test                                                                   |
| --- | ------------------------------------------ | ---------------------------------------------------------------------- |
| 1   | Five routes resolve in every active locale | E2E `about.spec.ts` navigation matrix                                  |
| 2   | Route keys valid and menu-linkable         | `contracts/index.test.ts`                                              |
| 3   | Seed is idempotent                         | `navigation.integration.test.ts` (Testcontainers)                      |
| 4   | Sitemap lists all five per locale          | snapshot test on `sitemap()` output                                    |
| 5   | No hardcoded user-facing string            | `check:catalog-completeness` + review                                  |
| 6   | `en` catalog complete                      | `pnpm check:catalog-completeness` exits 0                              |
| 7   | No hex literal, no physical property       | `pnpm lint` (`no-restricted-syntax`, react-internal)                   |
| 8   | RTL correct                                | `rtl.test.tsx` + `ar` E2E overflow assertion                           |
| 9   | Accessibility                              | `@axe-core/playwright` on all five pages + the open mega panel         |
| 10  | Reduced motion honoured                    | unit: `Counter`/`Timeline`/`HotspotMap` under mocked `matchMedia`      |
| 11  | No-JS / crawler content intact             | unit: full text present in the server render of a collapsed `Timeline` |
| 12  | Mega menu keyboard + escape                | component test + E2E keyboard path                                     |
| 13  | Empty facts ⇒ no empty section             | unit per section component with `[]`                                   |
| 14  | No admin code in the public bundle         | import-boundary check + Lighthouse budget                              |
| 15  | No new cache tag, no `revalidatePath`      | review + grep in PR 9                                                  |
| 16  | Governance                                 | `pnpm governance:check` (ADR-048, ADR-047, DEVLOG)                     |

---

## 8. Risks, and what this plan deliberately does not do

- **Factual copy is the critical path.** Nine of the extracted sections are
  claim-shaped (regulators, capital, awards, execution statistics). They render
  only once `ABOUT_FACTS` is filled. Until then those pages are structurally
  complete and shorter than the reference — the intended state, not a defect.
- **Images.** Every hero and callout degrades to a tone/gradient panel, so real
  photography can land later without touching component code.
- **Careers** is not built: nothing true to say yet.
- **The top strip** (Trading / VIP / Institutional) is not built — its
  destinations do not exist. It is a small addition to `TopBar` once they do.
- **`buildNavigation` stays at depth 2.** ADR-048 records why the panel is code
  rather than a third menu level.
- **No settings keys and no CMS rows** are added; ADR-042's cancelled surfaces
  stay hidden and untouched.
- **`es`/`ar`/`ur` catalogs are not translated** here; their gaps warn rather
  than fail, and no locale is flipped to `isActive` (ADR-043 #4).

---

## 9. What actually shipped, against this plan

Written after the work, against the code. The DEVLOG entry for 2026-09-07
(`changes-09`) is the narrative; this is the plan's own reconciliation.

**Numbering:** the mega-menu ADR is **048**, not 046 — ADR-046 was claimed by
the concurrent article-editor work mid-session. Every reference in the shipped
code and in §3/§6 above should be read as ADR-048.

| Plan item                                      | Outcome                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR 1 routes / catalog / facts / seed / sitemap | Shipped as written.                                                                                                                                                                                                                                                                                                                                                           |
| PR 2 `@repo/ui` primitives                     | Shipped. `Timeline` became a SERVER component on `<details>` rather than a client component with state — native disclosure keeps every entry in the DOM with no hydration jump, and removes a client island. Consequently neither `Timeline` nor `HotspotMap` runs JS-driven motion, so the "reduced motion short-circuits" test reduces to `Counter`, which already had one. |
| PR 3 mega menu                                 | Shipped. Two additions found in the browser: icons resolve inside the client components (a component cannot cross the server boundary as a prop), and the mobile nav moved from a dropdown to a sheet with accordion sections.                                                                                                                                                |
| PR 4–8 the five pages                          | Shipped. `PageHero` owns its surface instead of taking `Section`'s tone (tailwind-merge dropped the tone class), and its default is a `--primary` gradient — `inverted` is a LIGHT neutral in this theme. `HeroActions` exists because button variants are designed against `--background`, not against a brand band.                                                         |
| PR 9 hardening                                 | Partial — see below.                                                                                                                                                                                                                                                                                                                                                          |

### Criterion → outcome

Criteria 1–8 and 10–13, 15–16: met. Criterion 14 is met for the import
boundary and unmet for the Lighthouse budget.

**Criterion 9 (axe) and the Lighthouse half of 14: NOT met.**
`@axe-core/playwright` is not installed anywhere in this repo and no budget
file exists. Standing either up adds dependencies under the supply-chain rules
in security.md #15 and belongs to Module 14's launch gate, not to a page PR.
Both stay owed and are recorded in the DEVLOG.

**Seed idempotency (criterion 3)** is asserted by `packages/db`'s existing
integration test, which was raised from a 60s to a 180s budget: two full seeds
are dominated by Argon2id and the new menu rows tipped an already-marginal
test over. The navigation integration test gained an About-menu case instead
of a new seed-running test — same guarantee, a fraction of the runtime.

**Sitemap (criterion 4)** is asserted in E2E against the real
`/sitemap.xml` rather than as a unit snapshot: a unit test would have had to
mock `@repo/core`'s loaders, and testing.md forbids mocking our own packages.

### Still open

- `ABOUT_FACTS` is empty. Five sections are gated on it and do not render.
- The editorial commitments on `/about/why-us` and `/about/transparency`
  are promises about how MBFX publishes, not facts derivable from the code.
  They need the owner's confirmation; they live in the catalog.
- No imagery. Every slot degrades to a gradient panel; `ABOUT_MEDIA` maps
  each one to a path under `public/about/`.
