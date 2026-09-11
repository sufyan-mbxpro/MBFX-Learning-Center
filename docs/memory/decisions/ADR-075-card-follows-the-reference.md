# ADR-075: Cards take the reference's anatomy — no header or footer band

**Status:** Accepted
**Date:** 2026-09-11
**Module:** 07 (`@repo/ui` Card)
**Supersedes:** ADR-050 §1–§2 (the conditional header band and its
top-edge padding rule). ADR-050's decision that `article-sidebar.tsx`'s
`Panel` is built on `Card` is **not** superseded and stays in force.
**Superseded by:** —

## Context

ADR-050 (2026-09-07) gave `CardHeader` a `border-b bg-muted/50` band
whenever content follows it, mirroring the band `CardFooter` had carried
since the base-nova port. Header and footer read as chrome.

changes-20 adopts the reference UI's design system. Capture 2 (ADR-074)
proved the reference is shadcn `default`, whose card has **no band at
either end**:

- `rounded-lg border bg-card text-card-foreground shadow-sm`
- header `flex flex-col space-y-1.5 p-6`
- content `p-6 pt-0`
- footer `flex items-center p-6 pt-0`

The Phase 1 token doc the owner approved (`tokens.md` §6.11) specifies
exactly that and names the band as today's behaviour that changes. ADR-072
makes §6 binding. Deviating from ADR-050 still needs its own record (Part F
#10), and this is it.

## Decision

1. **`Card` is the reference's card:** `rounded-lg`, a 1px `border`,
   `shadow-sm`, and a 24px rhythm. It was `rounded-xl`, a ring and 16px.
   - The rhythm stays expressed through the one `--card-spacing` variable
     (the card's block padding, the gap between children, and each part's
     inline padding). That reproduces the reference's `p-6` header +
     `p-6 pt-0` content geometry exactly, without every call site changing
     its structure.
   - `size="sm"` keeps a 16px rhythm for compact tiles.
2. **No header band, no footer band.** A header is title + description; a
   footer is a row of actions. Both sit on the card surface. The
   `:not(:last-child)` bookkeeping ADR-050 needed is removed with the band.
3. **`CardTitle` is the reference's card title:** `text-2xl font-semibold
leading-none tracking-tight`, stepping down to `text-base` in a
   `size="sm"` card (the reference's compact chart-card title).
   `CardDescription` stays `text-sm text-muted-foreground`.
4. **The shared hover treatment stays** (`.card-hover`, changes-02). The
   reference's static cards do not lift on hover; the owner's
   every-card-hovers decision is not in conflict with anything captured and
   is kept.

## Consequences

- Every card with a header and content loses its tinted strip, so cards
  read flatter and match the reference.
- Admin card titles grow from 16px to 24px. The dashboard, learn-progress
  and settings-hub cards pick up the reference's card title. Where a screen
  wants the compact title, it passes `size="sm"`; Phase 5 makes that call
  per screen.
- Reverting the band is one class string in `CardHeader`. It is not
  deleted history: ADR-050's reasoning stays readable.

## Compliance

- `@repo/ui` tests pin:
  - the card surface
  - the 24px / 16px rhythm
  - the absence of a header band
  - the title scale in both sizes
- `pnpm governance:check`: ADR-050 changes only its Superseded-by header
  line.
