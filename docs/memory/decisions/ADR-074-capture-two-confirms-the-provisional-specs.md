# ADR-074: The second capture — the reference is shadcn `default`; the provisional specs are confirmed

**Status:** Accepted
**Date:** 2026-09-11
**Module:** 07 (`@repo/ui`: form controls, overlays, popups)
**Supersedes:** —
**Superseded by:** —

## Context

ADR-072 §9 left a set of specs "provisional — shadcn defaults" until a
second capture showed them open:

- dropdown and select popups, and their items
- dialog, sheet, popover, tooltip, toast
- checkbox, radio, switch, textarea
- breadcrumbs, sortable headers, empty state

The owner then asked for that capture to be taken rather than supplied
("capture yourself").

The reference is a production CRM. Every screen that renders these
components open (its `/backbone/*` admin) sits behind its login, and the
capture file names no host. Signing into someone's production admin to
screenshot a menu is not an acceptable way to take a capture. Its public
sign-in page shows nothing the first capture did not already have.

The first capture does establish what the reference is built from, and the
brief itself names it: "we're using https://ui.shadcn.com". So the component
source the reference runs can be captured directly from shadcn's registry,
**provided** the registry is shown to BE the reference and not merely similar
to it.

### The validation

Every class literal in the registry sources was scored against every class
attribute in the first capture (`changes-20-Ui.md`):

| Component                 | shadcn `new-york` (what ADR-072 assumed) | shadcn `default`                           |
| ------------------------- | ---------------------------------------- | ------------------------------------------ |
| Button                    | 2/10 literals exact                      | **6/10** (every variant used)              |
| Table                     | 4/8                                      | **6/8** (`th` and `td` exact)              |
| Card                      | 2/4 (`rounded-xl`, `shadow`)             | **4/5** (`rounded-lg`, `shadow-sm`, title) |
| Badge                     | 2/5 (`rounded-md`)                       | **4/5** (`rounded-full`)                   |
| Input                     | 75% token overlap                        | **96%**                                    |
| Tabs (list / trigger)     | 50% / 85%                                | **75% / 95%**                              |
| Label, Avatar, Pagination | —                                        | exact                                      |

Every remaining delta is one of two things:

- a **call-site override** in the reference app (`pl-10`, `flex-1`,
  `w-[180px]`, `justify-start`)
- a one-token **patch-version** difference (`placeholder:` vs
  `data-[placeholder]:`)

No component recipe differs.

**The reference is shadcn/ui's `default` style on Tailwind v3,
byte-for-byte.** ADR-072's Context calls it "new-york v3". That was wrong,
and this ADR corrects the record. The anatomy ADR-072 adopted was measured
from the capture itself, so none of its values change.

## Decision

1. **The registry's `default`-style sources are the second capture.**
   `docs/design-system/capture-2.md` records them, with the validation
   above. The provisional rows in `tokens.md` are superseded by its §6.14,
   and those components may now be restyled.
2. **Values the capture changes from the Phase 1 inference:**
   - **Overlay scrim `black/80`** (`--color-overlay`), replacing our 10%.
     Phase 1 had suggested 50% as a middle ground. The reference answers
     the question, and a scrim carries no contrast obligation.
   - **Select and dropdown check/radio items put their indicator at the
     START** (`ps-8`, indicator at `start-2`), not the end.
   - **Popup separators are `bg-muted`**; the command separator stays
     `bg-border`.
3. **Accessibility overrides visual copying (ADR-072 §1), applied to the
   captured recipes:**
   - **Checkbox and radio boundaries** use `--primary-interactive`, not raw
     `--primary`. WCAG 1.4.11 needs 3:1 for a control's boundary, and raw
     bronze on white is 2.9:1. The checked FILL stays `bg-primary`, and the
     boundary stays the derived line in every state, so the control is
     identifiable on or off. The radio dot is `--primary-interactive` too.
   - **The switch's checked track** is `--primary-interactive`, for the
     same 3:1 reason. A white thumb on raw bronze is also 2.9:1. The
     unchecked track keeps `--input`, which is already 3:1 (ADR-072 §4).
   - **Alert's destructive text** is `--destructive-interactive`, not raw
     `--destructive`. The raw hue fails 4.5:1 on its own /5 tint.
   - These are the closest accessible colours: the same hues, derived by
     the engine (ADR-003), so an admin palette gets the same guarantee.
4. **Toasts stay on Sonner** (ADR-072 §10). The reference's Radix toast
   recipe is mapped onto Sonner's `classNames`: bordered background card,
   `shadow-lg`, 14px semibold title, muted description, primary action,
   muted cancel, bottom-end, 420px wide.
5. **Components the repo lacks are added on Base UI 1.7**, which ships them:
   RadioGroup (`@base-ui/react/radio-group` + `radio`), Tooltip and
   Popover. There is still one implementation of each (task constraint 4).

## Consequences

- Phase 3 is unblocked: group 1's form controls and group 2's overlays can
  be restyled against confirmed specs.
- Overlays get much darker (10% → 80%). This is deliberate, and it is the
  reference.
- Checkbox, radio and switch read as a slightly deeper bronze than the
  reference's (`#84603D` vs `#C28D5A` on light surfaces). In dark mode the
  derived value IS `#C28D5A`, so there is no difference there.
- ADR-072 stays in force. Only its Context's style name is corrected here,
  because ADRs are append-only.

## Alternatives considered

- **Sign in to the reference CRM and screenshot the open components.**
  Rejected: it is a live production admin, and no URL or authorisation for
  it was given.
- **Keep the specs provisional and wait.** Rejected: the owner asked for the
  capture to be taken, and the registry is a stronger capture than a
  screenshot. It yields exact class strings, not pixels to reverse-engineer.
- **Use the `new-york` registry.** Rejected: measured, it is not what the
  reference runs.

## Compliance

- `capture-2.md` holds the validation table and every recipe used.
- `@repo/ui` tests pin:
  - checkbox, radio and switch on `--primary-interactive` boundaries and
    tracks
  - the start-side item indicators
  - the `black/80` scrim
  - the dialog, sheet, popover and tooltip anatomy
  - the Sonner mapping
- DEVLOG records the capture, the validation and the test results.
