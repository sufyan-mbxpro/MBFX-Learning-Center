# ADR-027: Global site layer — header, footer, announcement and menu panels are `PART` pages, preset-seeded, with per-page overrides

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS), extending Module 08 (navigation)
**Supersedes:** ADR-021 **in part** — `PageKind` gains `PART`; and
`docs/MBX-Dynamic-Site-Control-Plan-v2.md` §15's deferral of header/footer
to Module 08
**Superseded by:** ADR-033 (in part — §4 presets become `LayoutTemplate{PART}` rows), ADR-029 (in part — the "one collection block per panel,
`limit ≤ 6`" gate becomes a configurable data budget, default 2 collections;
everything else in this ADR stands)

## Context

Plan v2 §15 deferred header, footer, menus and the announcement bar to
Module 08 on the grounds that Module 08 already shipped them. The owner's
requirement (2026-09-04) is that the **global site layer is part of the same
CMS design system**: header presets, transparent→solid-on-scroll, menu hover
and dropdown effects, mobile menu modes, footer presets and columns,
announcement scheduling, and — crucially — **per-page overrides** (a
transparent header on the homepage, a solid one on news).

What Module 08 actually shipped, read from the code:

- `SiteHeader` (`_components/header.tsx`, 188 lines): logo from `BrandAsset`,
  a **flat nav with one level of plain dropdown lists**, search link, locale
  switcher, mode toggle, auth slot, CTA, announcement bar, top bar, and a
  `sticky` boolean — all driven by `buildNavigation("main", …)` plus
  `settings:layout` keys.
- `SiteFooter` (224 lines), `MobileNav` (85), `AnnouncementBar` (59),
  `TopBar` (49), `NavLink` (52).

The reference design the owner supplied shows something materially richer: a
**mega-menu panel** with three titled columns of icon + label + description
links, a payment-methods strip, a "View All" footer row, and — decisively —
a **News column listing live articles**. That last element is not a menu
feature. It is a collection bound to the news provider, inside a dropdown.
Any design where the panel is a special case of "menu item children" cannot
express it; a design where the panel is a **block layout** gets it for free,
along with the card templates, visibility rules and caching that already
apply to collections (ADR-022, ADR-023).

Two further constraints: `plan.md` A6 fixes link nesting at **two levels**,
and ADR-024 forbids arbitrary CSS — so "transparent header", "slide
underline" and "full-screen mobile menu" must be bounded, named behaviours,
not authored styles.

## Decision

### 1. Site parts are pages

`PageKind` gains **`PART`**. A part is a `Page` with `kind = PART` and a
reserved `key`:

`header` · `footer` · `announcement` · `topbar` · `mobile-nav` ·
`menu-panel:{slug}`

Parts therefore inherit, with no new machinery: versioned layouts,
draft/publish/rollback by pointer, per-locale translations, the publish gates
(ADR-024 §4), audit rows, and tag invalidation. **No `SitePart` model, no
`CmsTemplate` with `kind = PART`.**

### 2. Shell behaviour is bounded root props, not blocks and not CSS

Behaviours that cannot be expressed as child blocks live as Zod-validated
root props on the part version, each a closed enum mapped to classes and CSS
variables in `@repo/ui`:

```ts
header: {
  mode:       "solid" | "transparent" | "transparent-to-solid" | "floating",
  position:   "static" | "sticky",
  height:     "compact" | "normal" | "large",
  border:     "none" | "hairline" | "shadow",
  menuHover:  "none" | "underline" | "slide-underline" | "background" | "pill" | "fade" | "glow",
  dropdown:   "none" | "fade" | "slide-down" | "scale",
  mobileMenu: "drawer" | "fullscreen" | "dropdown",
}
footer: { columns: 1|2|3|4, tone: "surface" | "contrast", divider: boolean }
announcement: { icon: PresetIcon, dismissible: boolean, startsAt?, endsAt? }
```

`transparent-to-solid` is implemented **once**, as a small client leaf
(`HeaderShell`) that flips a `data-scrolled` attribute using an
IntersectionObserver sentinel — not a scroll listener — with the visual
change expressed in CSS and gated by `prefers-reduced-motion`, consistent
with ADR-018. Admins choose the mode; nobody authors the transition.

### 3. Part block set

`logo` · `menu` (by `menuKey`) · `search-trigger` · `locale-switcher` ·
`mode-toggle` · `auth-slot` · `cta-button` · `social-links` · `copyright` ·
`legal-links` · `payment-strip` · `announcement-text` · `newsletter-form`.

**Inside `menu-panel:*` and `footer` parts, the ordinary layout, content and
collection blocks are available** — which is what makes the reference
design's News column a `collection` block bound to the `news` provider with
a card template, rather than a bespoke feature.

### 4. Presets are seeded part versions

Header presets — `classic`, `modern`, `transparent`, `floating`,
`center-logo`. Footer presets — `simple`, `classic-4col`, `modern`, `large`,
`newsletter`, `dark-premium`, `minimal`.

A preset is a **seeded `PageVersion` layout**, not a new model. "Apply
preset" copies that layout into the part's draft version, so it is
previewable before publish and undoable by rollback. Admins then edit the
contents; the preset is a starting point, never a live link.

### 5. Global default with per-page override

`Page` gains three nullable references: `headerPartId`, `footerPartId`,
`announcementPartId`. Null means "use the site default", which is a settings
key naming the default part. The resolver is:

```
page.headerPartId ?? settings["layout.headerPartKey"] ?? shipped SiteHeader
```

This delivers the requirement directly: the homepage points at a
`transparent` header part, news pages inherit the solid default, and a
campaign page can carry its own announcement.

### 6. Wrap, don't rewrite — the same switch `/news` gets

The shipped `SiteHeader` / `SiteFooter` / `AnnouncementBar` / `TopBar` /
`MobileNav` remain, and become the **fallback path**: the layout renders the
published PART when one exists, otherwise today's component reading today's
settings. The initial parts are **seeded from the current settings values**
(`header.sticky`, `header.cta`, `header.announcementBar`, `header.topBar`,
`header.showSearch`, and the footer keys) so the first publish is visually
identical by construction, and the seed is the migration.

### 7. Nesting stays at two levels

`plan.md` A6's max-depth rule is unchanged: menu links nest at most two
deep. A mega-menu **panel is a layout, not a third level** — a menu item
references a `menu-panel:*` part (ADR-028) and the panel's internal
structure is blocks, which do not count as navigation depth.

## Consequences

- **The header can now contain a database query.** A panel with a live News
  column is a provider read in the site shell, on every page. Mitigated by
  hard caps enforced at publish: **at most one collection block per panel,
  `limit ≤ 6`**, cached under `content` with the part's own tags — and by
  adding a page whose header carries a panel-collection to the Lighthouse
  budget run. This is the single most likely way this feature regresses
  public performance, so it is a gate, not a note.
- **Header a11y becomes a bigger surface.** Mega panels need keyboard
  operation, escape-to-close, focus management and correct `aria-expanded`
  semantics. The axe fixture gains a header-with-panel case, and keyboard
  operation is asserted in E2E — the existing dropdown implementation
  (`DropdownMenu` from `@repo/ui`) is the floor to build on, not to replace.
- **Two rendering paths exist during transition** (shipped component and
  PART). Accepted, exactly as for `/news`; the fallback is removed only
  after snapshot parity at 1440 and 390 in both modes and both directions.
- **Cache coupling.** The header now depends on `navigation`,
  `settings:layout`, `theme`, `page:{headerPartId}` and — when a panel holds
  a collection — `content`. A part publish invalidates its own page tags; a
  menu save still invalidates `navigation`. No new tag names beyond ADR-025.
- **Per-page override adds a read to every page render.** It is one
  nullable column already loaded with the page row, so the cost is nil for
  CMS pages; non-CMS routes (`/news/[slug]`) read the site default from
  settings, which is already cached.
- **Announcement scheduling has no cron.** `startsAt`/`endsAt` are evaluated
  at render inside a `cacheLife({ revalidate: 300 })` scope — the same
  pattern ADR-015 #6 established for scheduled articles, with the same
  five-minute worst-case latency, stated rather than hidden.

## Alternatives considered

- **Keep header/footer in settings only (plan v2 §15).** Rejected: settings
  express toggles, not layout. The reference design's panel with columns,
  descriptions and a live collection cannot be a settings key without
  inventing a private layout language beside the block system.
- **A dedicated `SitePart` model with its own versions.** Rejected: it
  duplicates versioning, publish, rollback, translations and gates that
  `Page` already carries, and it splits "what is publishable" into two
  concepts.
- **Mega-menu panels as a special `MenuItem` shape** (columns + links as
  menu data). Rejected: it cannot express the News column, and it would
  grow a second layout system inside the menu table.
- **Let admins author header CSS for the transparent effect.** Rejected —
  ADR-024; and scroll-driven styling authored per site is the classic source
  of layout-shift and reduced-motion violations.
- **Rebuild the shipped header from scratch as blocks.** Rejected: the same
  reasoning that protects `/news` (ADR-015, and the container-query
  regression in the 2026-09-04 DEVLOG entry) protects the site shell, which
  is on every page.

## Compliance

- Snapshot parity test: each seeded preset renders identically to the
  shipped component it replaces, at 1440 and 390, light and dark, ltr and
  rtl, **before** the fallback may be removed.
- Publish gates extended: a part with more than one collection block per
  panel, or a collection `limit > 6`, is refused with the block named.
- axe fixture gains header-with-mega-panel and footer presets; E2E asserts
  keyboard operation and escape-to-close on a panel.
- Resolution test: page override → part; null → settings default; missing
  part → shipped component. All three paths asserted.
- Lighthouse budget includes a route whose header panel carries a
  collection.
- Reduced-motion test: `transparent-to-solid` performs no animated
  transition under `prefers-reduced-motion: reduce`.
