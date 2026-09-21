# ADR-141 — changes-44: the admin is set in Inter, and an editor has no state row

- **Status:** Accepted
- **Date:** 2026-09-19
- **Module:** 02 (`@repo/theme`), 07 (`@repo/ui`), 09 (admin shell), 11 (content editors)
- **Plan:** owner request, `docs/changes/changes-44-fixing.md`
- **Amends:** ADR-140 §1 **on the admin surfaces only**. The public site keeps
  the system face. ADR-139 #6: the three content flags leave the cover card.
- **Extends:** ADR-140 §3 (the title row carries the actions).

## Context

The owner sent six notes. Three of them change a rule.

1. The owner pasted the backbone portal's page header, dialog and button
   markup with "use this font & size for the admin side". The markup's sizes
   already match ours: `PageTitle` is `text-3xl font-bold tracking-tight`,
   `DialogTitle` is `text-lg font-semibold`, and the default `Button` is
   `h-10 px-4 text-sm font-medium`. Two things differed, measured on the dev
   server:
   - The admin rendered in `system-ui`. ADR-140 §1 moved the theme's
     `fontSans` to the system face for the public site. The admin reads the
     same `layoutTokens`, so it moved as well, although nobody asked for that.
     The backbone portal is set in Inter.
   - Every editor's title-row buttons were `size="sm"` (36px). The reference
     uses the 40px default.
2. Every content editor drew its status badge and language picker on a row
   of their own, above the tabs or the first card. The owner's rule: "it will
   appear only in the tab row or content header". The article editor already
   did this, with its language and translation status in the Content card's
   header.
3. The Featured / Active / Premium switches were the footer of the cover
   card (ADR-139 #6). That put them above the filing, placement and settings
   cards, which are the fields that decide what the record is. The owner
   asked for them before the Info card.

## Decision

### 1. The admin surfaces pin their typeface in code

`@repo/theme` exports `ADMIN_FONT_SANS = "inter"` and
`withAdminTypeface(theme)`. The latter sets both text slots to Inter and leaves
mono alone. Both admin root layouts, `(admin)` and `(admin-auth)`, build
`#brand-tokens` from `withAdminTypeface(theme)`.

It is code rather than a setting, for three reasons:

- The font controls are the paused Layout & Display tab (ADR-038), so no
  admin could choose it.
- One `layoutTokens` row cannot express "system on the public site, Inter in
  the admin". The admin-scoped theme row falls back to the `both` row.
- ADR-042's split says typefaces are design, not data.

A later request for a different admin face is a change to that one constant.

### 2. Title-row buttons are the default size

Buttons inside an editor's `<HeaderActions>` are `size` default (40px) and
`icon`, never `sm` or `icon-sm`. Buttons inside cards, toolbars and table
rows keep their smaller sizes.

### 3. A record's state and language travel with its content

- An editor renders no row above its content for status, language or
  translation controls.
- If the editor has tabs, they sit at the inline end of the tab row. The
  course editor is currently the only one.
- Otherwise they go in the first card's header actions, beside "Generate with
  AI". This covers glossary term, glossary topic, lesson, video topic, quiz
  and tool. It is the article editor's existing shape.

Each editor builds them once, as `stateCluster`.

### 4. The content flags are their own card, last before Info

`ContentFlagsSection` is a small "Listing" card that wraps
`ContentFlagsFields`. Every learning editor renders it after the settings
cards and immediately before the read-only Info card; editors with no Info
card render it last. The cover card keeps the picture only, and its
description no longer promises the switches.

## Consequences

- The admin requests Inter's woff2 once. Nothing changes on the public site.
- `ContentFlagsFields` survives as the switches without a card, for any
  surface that needs to embed them.
- Not guarded by a test yet: an editor could bring a status row back. The
  theme half is guarded by `withAdminTypeface`'s unit tests.
