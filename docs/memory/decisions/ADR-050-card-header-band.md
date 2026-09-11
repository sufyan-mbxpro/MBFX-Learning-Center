# ADR-050: A card's header is a band, not flush copy — and the one card that hand-rolled itself joins the design system

**Status:** Accepted — §1–§2 (the header band) superseded; the Panel-on-Card decision stands
**Date:** 2026-09-07
**Module:** 07 (`@repo/ui` design system), applied in 12 (public site) and 09 (admin shell)
**Supersedes:** —
**Superseded by:** ADR-075 (in part)

## Context

`CardFooter` has carried a distinct band since it was written —
`border-t bg-muted/50 p-(--card-spacing)` — so a card's footer reads as
chrome rather than as more content. `CardHeader` never got the matching
treatment: it renders flush on `bg-card`, exactly like `CardContent`, so a
card's title and its data share one uninterrupted surface.

The owner's report names where this reads worst: the news listing sidebar,
where four cards (Categories, Latest posts, Popular tags, Archives) stack
vertically and each one's `<h2>` sits on the same background as the list
underneath it. Stacked, the group reads as one long undifferentiated
column rather than four titled panels.

Two facts found while scoping it change the shape of the fix:

1. **That sidebar does not use `Card` at all.** `article-sidebar.tsx`
   declares a local `Panel` component that hand-rolls the card treatment —
   `card-hover flex flex-col gap-3 rounded-xl bg-card p-5 ring-1
ring-foreground/10`, a copy of `Card`'s own class string — with a bare
   `<h2>` for the title. So a change to `CardHeader` alone would not touch
   the very surface the report is about.
2. **Two of the three `CardHeader` call sites are header-only cards.** The
   settings hub (`settings/page.tsx`) renders `Card > CardHeader` with no
   `CardContent` — the header IS the card. So does the glossary spotlight's
   grid variant. Tinting `CardHeader` unconditionally would make those
   cards _entirely_ tinted, which is not a header band at all: a band that
   covers the whole card distinguishes nothing, and would quietly restyle
   two shipped screens the report never mentioned.

## Decision

### 1. The band is conditional on there being content to distinguish from

`CardHeader` gets `border-b bg-muted/50` and its own vertical padding
**only when it is not the card's last child** (`not-last:`, i.e.
`&:not(:last-child)`). A header with something after it is a header; a
header that is the whole card is just the card, and stays flush.

This is the rule that makes "different from the content data" true in
every case rather than in the common case, and it is why the change is
safe to make the default instead of an opt-in variant — the two
header-only cards render exactly as they do today.

`Card` correspondingly drops its own top padding when it contains a
_banded_ header (`has-[>[data-slot=card-header]:not(:last-child)]:pt-0`),
so the band starts at the card's top edge instead of floating with a strip
of card background above it. The existing `has-data-[slot=card-footer]:pb-0`
is the same mechanism for the footer; this is its mirror.

### 2. Colour comes from the footer, not from a new token

`bg-muted/50` and `border-b` are exactly what `CardFooter` already uses.
Header and footer chrome match each other by construction, no new token is
introduced, and nothing here is a colour literal (code-style.md #1).

### 3. The news sidebar stops hand-rolling a card

`Panel` in `article-sidebar.tsx` is rebuilt on `Card` / `CardHeader` /
`CardContent`. It gets the band for the same reason every other card does,
and the duplicated class string — which could drift from `Card`'s real one
at any time, and already omits `text-card-foreground` — goes away. This is
the half of the fix that actually addresses the reported screen.

## Consequences

- Every card with a header AND content gains a tinted, bordered header
  band: the admin dashboard's two chart cards, the news sidebar's four
  panels, and any card written from here on. That is the intent — the
  change is deliberately global, per the report's "everywhere".
- Header-only cards (settings hub, glossary spotlight grid) are visually
  unchanged. Stated explicitly so a reviewer comparing screenshots does
  not read "no change" as "the change did not apply".
- `CardHeader`'s pre-existing `[.border-b]:pb-(--card-spacing)` escape
  hatch still works for a consumer that adds `border-b` to a last-child
  header by hand. It is now redundant for the common case, not wrong.
- A card that puts an image first and a header second gets a band that is
  not at the top edge. `CardHeader`'s `rounded-t-xl` is then cosmetically
  wrong at two corners. No shipped card does this today (the news article
  cards do not use `CardHeader`), so it is named as a known edge rather
  than solved speculatively.
- The news article listing cards (`article-list.tsx`) are **not** changed.
  They compose a bare `Card` with an image and a copy block, and have no
  header slot to band — their title sits directly under the cover image,
  where a tinted strip would fight the image rather than clarify anything.

## Alternatives considered

- **A `variant="banded"` opt-in on `Card`.** Rejected: the owner asked for
  this everywhere, and an opt-in guarantees the next card written forgets
  it. The `not-last:` condition already gives the only exemption that
  turned out to matter.
- **Tint `CardHeader` unconditionally.** Rejected on inspection — it
  breaks the two header-only cards described above, which is precisely the
  kind of unreviewed collateral change the module-by-module design
  philosophy (ADR-042) exists to avoid.
- **Leave `Panel` hand-rolled and add a band to it directly.** Rejected:
  two card implementations is how they drift, and this one had already
  drifted (missing `text-card-foreground`).
- **A new `--card-header` theme token.** Rejected as premature: the footer
  established `bg-muted/50` as the card-chrome surface, and a second token
  saying the same thing is a second thing to keep in sync.

## Compliance

- No colour literal is introduced; both values are existing semantic
  utilities (code-style.md #1).
- `article-sidebar.tsx` keeps its logical-property classes; the rebuild
  introduces no physical `pl-/pr-/ml-/mr-` (code-style.md #3).
- Visual regression is not asserted by an automated test: the repo has no
  visual-diff suite (Module 07 lists axe/visual E2E as deferred), so this
  ADR does not claim one. `pnpm lint` + `pnpm typecheck` are the gates that
  actually ran.
