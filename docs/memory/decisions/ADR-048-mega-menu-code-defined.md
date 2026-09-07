# ADR-048: Mega-menu panels are defined in code, not in the menu tree

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 08 (navigation & header/footer), 07 (`@repo/ui`)
**Supersedes:** —
**Superseded by:** —

## Context

The owner supplied two reference treatments for the primary navigation (a
forex.com "About Us" panel, and mbfx.co's own "Trading" panel) and asked for
that treatment here. Both are mega menus: a panel of grouped columns, each row
carrying an icon, a bold label and a one-line description, with an optional
rail of promoted tiles, a promotional strip, and a footer row linking to the
section index.

Three facts collide.

1. **`buildNavigation` caps at depth 2 by design.** Module 08's SKILL states
   it, `assembleNavigation` implements it ("a grandchild row is ignored
   outright rather than flattened upward"), and a test pins it. A panel needs
   three levels: item → column → link.
2. **`MenuItem` has no column, no description grouping and no icon
   vocabulary** beyond a single `icon` string per row. `MenuItemTranslation`
   does carry `title`, which is a per-row description — that part exists.
3. **ADR-042 cancelled admin-configurable composition.** Menu ORDER is already
   a code change; the reorder UI is hidden permanently. Adding a third menu
   level plus per-column metadata to the database would rebuild, as data, the
   exact surface ADR-042 removed — and would eventually need an admin screen to
   edit it, which is the thing that was cancelled.

## Decision

**The panel is a typed registry in app code; the database still owns the
items and every href.**

`apps/web/app/(public)/[locale]/_nav/mega-menu.ts` holds
`MEGA_MENU_PANELS`, keyed by the top-level item's `RouteKey`. A panel names
its columns, the child route keys in each, an optional feature rail, an
optional strip, and an optional "view all" target. `MEGA_MENU_ICONS` maps a
route key to its glyph.

The split is exact:

| Owned by the database                               | Owned by the registry               |
| --------------------------------------------------- | ----------------------------------- |
| Which items exist, and their order                  | Which column a child belongs to     |
| Every label and description (`MenuItemTranslation`) | Each row's icon                     |
| Every href (through `ROUTE_PATHS`)                  | Column headings (catalog keys)      |
| Feature-flag and permission gating                  | Rail / strip / view-all composition |

An admin renaming a menu item still renames it in the panel. Adding a column
is a PR — which is what ADR-042 means by "changing menu composition is a code
change".

**`resolveMegaMenuPanel` fails open in both directions.** A child no column
claims is appended to the last column rather than dropped; a spec entry with
no matching child is skipped rather than rendered empty. Neither a database
edit nor a code edit alone can make a destination vanish from the header.

**The primitives are Base UI's `NavigationMenu`** (ADR-013), verified present
in the installed 1.7.0: Root, List, Item, Trigger, Content, Portal,
Positioner, Popup, Viewport, Backdrop, Arrow, Link, Icon. Hand-rolled mega
menus reliably fail at two points — pointer diagonal tolerance between trigger
and panel, and focus/Escape handling — and both are solved there. RTL comes
from `direction-provider`.

**An item with no registered panel keeps the treatment it already had.** The
plain dropdown and plain-link paths are untouched, so this is a superset of
the old header rather than a replacement that could leave an item unrenderable.
Panels arrive section by section as those sections are built.

**The mobile nav renders the same registry** as a sheet of accordion sections
(it was a dropdown menu). Desktop and mobile take the identical row
projection from the server, so a destination cannot appear on one and not the
other.

## Consequences

- **Icons cannot be passed from the server.** A Lucide icon is a function
  component, and React refuses to serialize one across the boundary. The
  desktop nav and the About sub-nav are therefore client components that
  import the registry themselves, and the server passes only serializable
  rows. This was found at runtime, not in review — the first render of
  `/about` was a 500 for exactly this reason.
- **Two panels can drift from one menu.** The registry names route keys the
  seed must also produce. Guarded by unit tests that check every named route
  key against `ROUTE_PATHS` and every named catalog key against `en.json` —
  the same shape as Module 03's permission-key cross-check.
- **The desktop nav ships client JavaScript that the old header did not.**
  Base UI's navigation menu is the cost; the public Lighthouse budget
  (architecture.md #5) is where that gets policed.
- **`featureRouteKeys` and `strip` are currently unused by the only panel.**
  Both are part of the reference treatment and will be used by the Trading and
  Markets panels; both are covered by tests with a synthetic spec so they
  cannot rot silently.

## Alternatives considered

- **Raise `buildNavigation` to depth 3 and add `columnKey`/`description`
  columns to `MenuItem`.** Rejected: it re-creates admin-editable composition
  as data — the surface ADR-042 cancelled — and it needs an editing screen to
  be usable, which is the same surface again.
- **Hard-code the whole panel in the header component.** Rejected: it
  duplicates labels and hrefs that already live in the menu, so an admin
  renaming "Support" would rename it in the mobile sheet and not in the
  desktop panel.
- **Keep the existing plain dropdown for About.** Rejected — it cannot express
  column headings or per-row descriptions, which is most of what the reference
  treatment communicates.

## Compliance

- Unit tests in `apps/web/app/(public)/[locale]/_nav/mega-menu.test.ts`: every
  panel key, column route key, feature key and view-all target is a registered
  `RouteKey`; every catalog key resolves in `en.json`; unclaimed children are
  appended, never dropped.
- `pnpm lint` — logical properties only, no colour literals; the panel uses
  `--primary` for fills and `--primary-interactive` for glyphs (ADR-018 #5).
- E2E: open by hover and by keyboard, close on Escape, navigate to a child,
  and an `ar` run asserting the panel mirrors with no horizontal overflow.
