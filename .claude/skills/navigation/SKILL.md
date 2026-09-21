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

## The footer's legal band, and Support in place of About (changes-33)

**ADR-109 removed the About root and its five children, and `markets` with
them.** `support` is a FLAT header row — one page needs no dropdown, and a
mega panel over a single destination is a popup that says the page's own name.
`footer_company` now carries Support + Sitemap.

The seed **deletes** the superseded rows by `routeKey`, which is safe in
exactly the way overwriting a settings VALUE is not: a row whose key is not in
`ROUTE_PATHS` cannot resolve to a URL at all, so leaving it preserves nothing
— it puts an unresolvable entry in the header.

**ADR-110 gave the footer a legal band**: the disclaimer split on blank lines
inside its labelled panel, the registration number and the registered address
as their own settings (absent, never labelled-and-empty), then a bottom bar
with the copyright and a Terms · Privacy · Agreement · Sitemap row read from
`LEGAL_DOCUMENT_KEYS`. A document with no file behind it is absent from the
row.

**A `viewAll` resolves against the panel's own CHILD ROWS.** The Tools panel
declared one from ADR-086 §9 and it never rendered, because the seeded tools
tree has no `tools` child — the About panel worked only because its seed
listed `about` as its own first child. Nothing failed, since `viewAll` is
optional and an unresolvable one looks identical to an absent one.
`mega-menu.test.ts` pins both halves now.

## The economic calendar is a Tools child, not a header row (changes-34, ADR-115)

The flat `Calendar` row is gone; the header carries seven top-level entries.
The calendar is seeded as the ninth child of `TOOLS_NAV` and listed in the
Tools panel's **Timing** column beside market hours and pivot points — the
column heading is what makes it belong, since all three answer "when".

It is **not** a `TOOLS` registry member (ADR-115 #2), so
`tools-area.test.ts`'s "the panel names every `TOOL_KEYS` member" guard is
unchanged and still correct.

**The seed's delete is scoped, and the scope is load-bearing.** ADR-109 could
`deleteMany` by routeKey because those keys no longer resolve in
`ROUTE_PATHS`. This one does, and two rows share it — the `footer_markets`
entry and the new Tools child — so the delete matches
`[mainMenu, "economic-calendar", parentId: null]` and nothing else.

`footer_markets` keeps its row: a footer is a sitemap and repetition is its
job.

## A source guard whose anchor is deleted does not fail — it widens

Found in changes-34, second instance in two change-sets. `tools-area.test.ts`
sliced the Tools panel out of `mega-menu.ts` between `"  tools: {"` and
`'viewAll: "tools"'`, and ADR-112 deleted that `viewAll`. `indexOf` returned
-1, `slice(start, -1)` ran to the end of the file, and both assertions passed
by reading every panel in it.

When a source guard slices, end the slice on something structural (the
object's own closing line) rather than on a property that a later decision can
delete, and assert the marker was found.

## The footer is a sitemap, and a test says so (changes-36)

**Five columns**, mirroring the header's own top level: `footer_learn_forex`
and `footer_learn_crypto` (four surfaces each), `footer_tools` (all eight
tools plus the economic calendar), `footer_markets` ("News & Markets"),
`footer_company`. 25 rows against the header's 23 destinations.

The claim "every destination the header offers has a footer row too" has been
in the seed since Module 08 and stopped being true twice in silence — ADR-065
split Learn into two schools, ADR-086 put eight calculators behind one link —
because both lists were valid data the whole time.

`packages/db/src/footer-sitemap.test.ts` is now the guard: it extracts every
`routeKey` from the three header blocks and the two footer ones and fails on a
header destination with no footer row. **A third school or a ninth tool fails
here.**

- Extending the footer is still a seed + setting change, not a code change.
  `LINK_GRID_CLASS` in `footer.tsx` answers for one through six columns; at
  five or more the brand block drops from `lg:col-span-4` to `3`.
- **`footer_learn` is no longer seeded and deliberately not deleted.** An
  install whose `footer.menuColumns` the changes-36 migration could not safely
  rewrite still needs its Learn column to resolve.
- The economic calendar is listed in TWO columns on purpose (Tools, and News &
  Markets). A sitemap is meant to be findable from wherever a reader is
  looking; the header does the same with `learn`.
