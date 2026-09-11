# SKILL — Module 08: Navigation & header/footer runtime

> **Admin reorder UI paused (ADR-038, 2026-09-06).** `/admin/navigation` is
> hidden pending the owner's move to module-by-module/static site design.
> `buildNavigation()` and the public header/footer runtime below are
> unaffected — read ADR-038 before touching the admin screen.

plan.md Module 08 + A6 header/footer rows. This module is the architecture's
proof-of-concept demo: admin reorders a menu item → public header reflects it
without redeploy.

## buildNavigation (in @repo/core)

`buildNavigation(menuKey, locale, subject|null)`: reads the menu tree
(cached, tag `navigation` — frozen), filters `isActive` → `visibility` →
`requiresFeature` (flags) → `requiresPermission` (staff menus), resolves
translations with the fallback chain, resolves exactly-one of
`routeKey`/`url` (contract-validated). Parent whose children are all pruned
is itself pruned. Max depth 2 (rule + validation).

## Header (public surface)

Logo per mode from `BrandAsset`; main menu with 2-level dropdowns; locale
switcher; theme-mode toggle (USER-controlled — ADR-008, never admin-gated);
auth-state slot; admin-configured CTA (label key + route/URL + visibility);
optional dismissible announcement bar; sticky on/off from settings.

## Footer

Admin-ordered footer menus as columns — THREE of them since 2026-09-07
(`footer_learn` / `footer_markets` / `footer_company`, listed in order by the
`footer.menuColumns` setting), so every destination the header offers has a
footer row. Adding a fourth is a seed row plus a setting entry, not a code
change; the column heading is the menu's own `Menu.name`, which the seed
now keeps current. A menu whose items all prune (feature flag off) drops its
column rather than rendering an empty one. Layout is one twelve-track row —
brand on four, sitemap on eight — with the newsletter as its own strip;
`--primary` stays off thin elements on this `--secondary` band (see the
footer component header for why `--primary-interactive` is barred here too).
Also in the band: the active `SocialLink` set in sortOrder,
each rendering its admin-uploaded `iconUrl` if it has one and otherwise the
built-in glyph `icon` names (ADR-045 — do NOT resolve icons through
`lucide-react`, which has no brand icons and used to fail silently);
translatable copyright with `{year}` token; risk-disclaimer legal setting
rendered site-wide (forex compliance).

## Required tests

Nav builder truth table (inactive/flag-off/permission pruning, empty-parent
pruning); label fallback; exactly-one url/routeKey contract test; **E2E
round-trip: admin reorder → public header updates via tag invalidation, no
deploy**; axe on header nav; keyboard-operable dropdowns; `aria-current` on
the active item.

## Module 16 extends this module — read before changing anything here

`ADR-027` turns the header, footer, announcement bar, top bar, mobile nav
and mega-menu panels into **`PART` pages** composed of blocks, with presets,
bounded shell behaviours and per-page overrides. `ADR-028` extends
`MenuItem` with polymorphic entity targets, dynamic children and panel
references — **the "exactly one of url/routeKey" contract test above is
rewritten to a `linkType` matrix**, with existing rows backfilled, so the
shipped behaviour and its tests survive.

The components in this module are **not** rewritten: they become the
fallback path behind the CMS parts, and the seeded presets are generated
from this module's current settings values so the first publish is
snapshot-identical. Standards: `.claude/skills/website-builder/SKILL.md`.

## The header's learning entries (ADR-065, 2026-09-09)

The seeded `learn` root row is **gone**. In its place are `learn-forex` and
`learn-crypto`, each a root with four children — Courses, Quizzes, Glossary
and "All learning" (the umbrella `/learn`) — and each with a mega-menu panel
in `_nav/mega-menu.ts`. The ADR-048 split is unchanged: the database owns the
rows, their order, their labels and their hrefs; the code registry owns which
rows group into which column and what glyph each carries.

Two things worth knowing before editing this:

- **The umbrella is a ROW, not a "view all" footer.** The footer takes its
  label from the panel's own item, so it would read "Learn Forex · View all"
  over a link to the page that covers both schools.
- **A one-column panel passes `size="compact"`.** `MegaMenuPanel`'s width is
  explicit (Base UI measures the popup from its content), so a single list in
  the wide box leaves two thirds of a 56rem popup empty. `site-nav.tsx`
  chooses the size from the resolved panel, not from the spec.

Adding a track touches six places and a failing test names each: a
`LEARN_TRACKS` entry, three `ROUTE_PATHS` keys, a `LEARN_TRACK_ROUTE_KEYS`
entry, a panel, its icons, and the seeded tree.

## Videos joined the learn surfaces (changes-16, ADR-068)

A track now owns **four** surfaces, and `LEARN_TRACK_SURFACES` in
`@repo/contracts/navigation.ts` is the single registry that declares both the
set and its order: `index, videos, quizzes, glossary`. Videos sits SECOND,
not after Quizzes.

Four things read that registry and none of them may re-type it: the section bar
(`learnSectionsFor`), the mega-menu panel (`_nav/mega-menu.ts`), the seeded
track nav trees (`seed.ts` `TRACK_NAV`), and the two drift guards
(`learn-sections.test.ts`, `mega-menu.test.ts`) — which now ITERATE it rather
than hardcoding a list beside it. That was ADR-068 Consequences' lesson paid
twice: the guards hardcoded three surfaces in three places and none failed when
a fourth arrived, and adding the fourth surface then failed three assertions
that all had to be fixed at the root.

Adding a fifth surface is: a `LEARN_TRACK_SURFACES` entry, two `ROUTE_PATHS`
keys per track, an entry in `LEARN_TRACK_ROUTE_KEYS`, a row in `TRACK_NAV`, an
icon in the mega-menu map — and both guards name whichever half you forget.

The **footer** gets no row for a per-track surface. Its Learn column is
track-agnostic, which is why Quizzes has never had one either; adding
`learn-forex-videos` would pick one school arbitrarily.
