# ADR-089: A switch sits on a row, and the switch leads it

**Status:** Accepted
**Date:** 2026-09-14
**Module:** 07 (ui), 09 (admin shell), and every admin screen with a toggle
**Supersedes:** the two ad-hoc switch shapes admin screens had settled into —
label-then-switch in eight places, switch-then-label in three.
Extends ADR-077 (admin form fields are wired Fields) with a rule about the one
control ADR-077 left unspecified.
**Superseded by:** —

## Context

The owner asked for two things about the same control, from two screenshots
(`docs/changes/changes-26-tools-updates.md`):

> the toggle button size should be statndard in details as well
> the toggle button should on left side with active text

Both are real, and the first is a bug rather than a preference.

**The size.** `fieldVariants`' vertical orientation carries `*:w-full`. That is
what makes an `Input`, a `Textarea` and an `AdminCombobox` fill their field, and
it is right for all three: those controls have no intrinsic width and a form
column of ragged boxes reads as an accident. A `Switch` does not belong to that
set. It is a **fixed 44×24 geometry** (ADR-074, tokens.md §6.14) — the one
control in the library whose size carries meaning, because a switch is
recognised by its shape. `*:w-full` reached it anyway, so the tool editor's
`Live` toggle was drawn as a 288px bar across the settings rail: an object with
a switch's colours, a switch's thumb, and nothing else about a switch.

Nothing caught it because nothing was wrong at the call site. The screen asked
for a Field and a Switch, both correctly, and the stretch happened one layer
down.

**The order.** Eleven labelled switch rows existed across the admin, in two
shapes. Eight read label-then-switch, which the horizontal variant renders as
the label taking all the slack and the control pinned to the far end of the row
— on the instrument dialog, the word `Active` and the thing it names sat 500px
apart. Three read switch-then-label. `social-links-manager.tsx` had **both**: its
`Active` switch was label-first and the two `openInNewTab` checkbox rows
directly beneath it were control-first.

So there was no convention to break, only a coin flip made eleven times.

## Decision

**1. A switch row is `orientation="horizontal"`.** A Switch never sits in a
vertical Field. A vertical Field puts the control under its label, which is the
shape of a field being filled in; a switch is a state being flipped, and it
reads on one line with the words it governs. The two are different gestures and
they get different shapes.

**2. The switch comes first, then the label.** The control leads and the text
follows it, the way the checkbox rows already did. Where a hint travels with the
label, the two stack in a `FieldContent` **after** the switch, so the hint sits
under its label rather than trailing off the end of the row.

**3. `fieldVariants` stops stretching a switch regardless.** Even with #1 and #2
in force, the vertical variant now exempts `[data-slot=switch]` from `*:w-full`.
A rule that only holds while every author remembers it is not a rule, and this
one had already been forgotten in the newest screen in the repo. Written as a
second, more specific declaration rather than by narrowing `*:`, so
`[&>.sr-only]:w-auto` keeps winning exactly as it does today.

**4. A switch with no label in its row is out of scope.** A table cell's toggle
is named by its column header and has no Field at all. The rule is about a
labelled row, not about every switch.

**5. The guard is `apps/web/app/admin-form-conventions.test.ts`.** It reads the
admin as source — the idiom that file already uses — and fails in both
directions: a Switch inside a Field that is not horizontal, and a Switch that
any `FieldLabel` or `FieldContent` precedes. It also asserts it found more than
eight rows to check, because a regex that quietly matches nothing passes every
other assertion in the block forever.

## Consequences

- Eleven rows across eight files now read the same way; seven of them changed.
- The stretch fix is one line in `@repo/ui` and reaches every surface, including
  ones not written yet.
- The cancelled and paused surfaces (ADR-042, ADR-038) are out of scope, as they
  are for ADR-044 and ADR-077 — the guard shares that exclusion list.
- **Not covered:** the checkbox and radio rows this rule takes its shape from.
  They were already control-first everywhere, so there was nothing to retrofit,
  and a guard asserting a property nothing violates is a guard nobody can
  evaluate. If one ever drifts, the rule to extend is this one.
