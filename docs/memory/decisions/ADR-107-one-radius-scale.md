# ADR-107: One radius scale, derived from `--radius`, and `rounded-full` means a circle

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 07 (`@repo/ui`), 12 (public site), 02 (theme)
**Supersedes:** ADR-101 §5's "it stays available and stays a deliberate
choice" about `Button shape="pill"`. ADR-101 took the pill off the home page;
this takes it off the public surface and removes the variant. ADR-101's
reasoning is unchanged and is the reason this is an extension rather than a
reversal.
**Superseded by:** —

## Context

The owner, about the public site:

> the button allignments should be the same like in every where use the square
> radius on the public site..do not use round button,menu or any other
> places,,also use the centralize components as well..also check the sizing &
> radius etc..should be consistant everywhere

Three separate problems are named there, and only the first is about taste.

**The pill was half-removed.** ADR-101 §5 established that the default CTA is a
tailored 6px rectangle and took `shape="pill"` off the home hero, the video rail
and the connect band — and left it on thirty-four other public call sites: every
About page, the calendar, the glossary masthead, both learn mastheads, the quiz
masthead. So the same button was a pill on `/about` and a rectangle on `/`. The
variant staying "available as a deliberate choice" is exactly how that happened.

**`rounded-2xl` is not on the scale.** `globals.css` derives four steps from one
admin-set `--radius` — `sm` = r−2, `md` = r, `lg` = r+2, `xl` = r+6 — so a site
whose admin moves `radiusBase` moves with it. `rounded-2xl` is Tailwind's own
16px literal and moves with nothing. Thirty-five files used it, almost all of
them public cards, so an admin who set a 2px radius still got 16px cards on
every public page and 8px cards in the admin.

**`rounded-full` had drifted onto things that are not round.** A badge, a view
chip, a mega-menu item, a filter chip, a section-nav item, a quiz answer — all
rows of text with horizontal padding, all pill-shaped, none of them a circle.
That is the "do not use round button, menu or any other places" half of the
report, and it is also why there was no rule to point at: `rounded-full` was
being used for two unrelated jobs.

## Decision

**1. Every radius comes from `--radius`.** The only radius utilities on either
surface are `rounded-none`, `rounded-sm`, `rounded-md`, `rounded-lg`,
`rounded-xl` and the reserved `rounded-full` below. `rounded-2xl` and above are
gone — each became `rounded-lg`, which is the card step tokens.md §4.1 already
specified and which the admin's cards already used.

This is not a visual preference; it is the difference between a theme token that
works and one that is decorative. `radiusBase` is admin-editable, and a literal
that ignores it makes the control a lie — code-style.md #28's rule about
settings nothing reads, applied to a token rather than a row.

**2. `rounded-full` is reserved for a shape whose GEOMETRY is a circle or a
track.** Specifically: a square box (`size-*` or `aspect-square`), a
progress/meter bar whose ends are caps, a switch or radio knob, a status dot, a
decorative rule. Anything laid out as a **row of text with horizontal padding**
— button, badge, chip, tab, menu item, answer option — takes the derived scale.

Geometry rather than "does it contain text" is the test, deliberately, because
the second one has an obvious counterexample: `CountBadge` is a notification
bubble with a number in it, and it is round because it is a dot, not because the
digit wanted a pill. It keeps `rounded-full` and the rule still reads cleanly.

**3. `Button`'s `pill` shape is deleted, not merely unused.** A variant nothing
may use is a variant that comes back on the next screen, which is the documented
history of this exact one. `SkeletonButton`'s `shape` prop goes with it, since
its only job was to match. The `shape` axis itself stays in the cva config with
`default` alone — adding a future shape should not require rebuilding the axis.

**4. A skeleton's radius is its real component's radius.** Half the
`rounded-full` in the public tree was in `loading.tsx` files standing in for
badges and CTAs that are no longer pills. A skeleton that is the wrong shape is
a layout shift the moment the content arrives, which is the one thing a skeleton
exists to prevent.

## Consequences

- `docs/design-system/tokens.md` §4.1's `rounded-full` row — "badge, count pill,
  view chip, avatar, progress, dock, live dot" — now describes only its second
  half. The table is updated; badges and view chips move to `rounded-md`.
- The public surface gets visibly squarer, which is what was asked for and is
  also the direction ADR-101 §5 argued: a 6px rectangle reads tailored.
  `/about`, the calendar and the four mastheads change most, because they were
  the ones still opting out.
- `public-design-system.test.tsx`'s "Button's pill shape wins over the size's
  own radius" is deleted rather than repaired. It pinned the behaviour of a
  variant that no longer exists; there is nothing left for it to protect.
- A new guard, `apps/web/app/radius-scale.test.ts`, fails on any
  `rounded-2xl`/`3xl` and on `rounded-full` in a file that does not also carry a
  geometry marker. It is deliberately coarse — it catches the class coming back,
  not every misuse — because the precise version would need to parse the class
  attribute, and the failure mode it exists for is a paste, not a subtlety.
- Nothing about the admin changes except by inheritance: it was already on the
  derived scale, which is part of why the public surface's divergence was worth
  closing rather than documenting.
