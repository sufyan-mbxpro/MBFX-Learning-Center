# ADR-077: Admin forms are wired Fields — inline validation from the action's own schema

**Status:** Accepted
**Date:** 2026-09-12
**Module:** 07 (`@repo/ui`), 09 (admin shell), and every admin screen
**Supersedes:** —
**Extends:** ADR-044 and ADR-057 (the admin display conventions). Their scope
is inherited unchanged: the cancelled and paused surfaces (ADR-042, ADR-038)
are out of it.
**Superseded by:** —

## Context

The changes-21 Phase B audit (`docs/design-system/audit-changes-21.md`, F-07)
found that no admin form associated its errors with its controls:

- `@repo/ui` shipped `Field`, `FieldLabel`, `FieldError` and
  `FieldDescription` as plain layout pieces, and **no app form used them**.
- A failed save surfaced as a toast (`useServerAction`), or as a
  free-standing `<p className="text-xs text-destructive">` with no
  `aria-describedby` pointing at it.
- Nothing marked a required field. Forms disabled Save until the required
  fields were filled, which is silent about _which_ field is missing.
- The only forms with the full pattern were the three sign-in / sign-up
  forms, wired by hand.

The owner chose option (a) of question Q-3 (2026-09-12):

> All admin forms: Field, FieldLabel, FieldError, aria-invalid,
> aria-describedby, required attributes, inline validation messages.
> Required fields use `*`; do not add "(optional)" to every non-required
> field. Toast is retained for global/server/submission errors; don't use it
> as the only indication of field validation errors.

## Decision

1. **A `Field` wires its control.** `@repo/ui/components/field` keeps its
   ids and state in context. `FieldLabel` takes `htmlFor` from it and draws
   the asterisk; `FieldDescription` and `FieldError` join the control's
   `aria-describedby`; every `@repo/ui` control (`Input`, `Textarea`,
   `Switch`, `Checkbox`, `RadioGroup`, `SelectTrigger`, `Combobox`, and so
   `AdminCombobox`) calls `useFieldControl` and sets its own `id`,
   `required`, `aria-invalid` and `aria-describedby`. A call site writes no
   id and no aria attribute. The admin's composite controls (`RichTextEditor`,
   `SlugField`, `ScheduleField`, `ImageUploadField`, and `editor-section`'s
   `Field`) are Field-aware in the same way.
2. **Every visibly labelled admin control sits in a Field.** Admin screens do
   not import `@repo/ui/components/label`, render a raw `<label>`, or write
   `htmlFor`. A control labelled only by `aria-label` (a toolbar search, a
   table filter) is not a form field and is unaffected.
3. **Required is marked once, with an asterisk.** `<Field required>` draws a
   decorative `*` (`aria-hidden`) after the label and marks the control
   `required`, or `aria-required` where the DOM node is a button (a dropdown
   trigger). Optional fields carry no marker: no "(optional)" anywhere.
4. **Inline messages come from the server action's own schema.**
   `useFieldErrors(schema, values)` runs the `@repo/contracts` schema the
   action parses with, or a `.extend`/`.pick` of it for a client-only bound,
   so the form and the action cannot disagree. `@repo/contracts`'
   `validateFields` maps Zod issues to a closed set of codes (`required`,
   `tooShort`, `tooLong`, `tooSmall`, `tooBig`, `tooFew`, `tooMany`,
   `invalidEmail`, `invalidUrl`, `invalidFormat`, `invalid`) keyed by dotted
   path. The app renders each code from `admin.validation.*`. Packages carry
   no words (code-style #2), and Zod's own English never reaches the screen.
5. **When messages appear.**
   - Nothing shows until the first submit attempt; an untouched form is not
     wrong.
   - From then on the issues are recomputed every render, so a message
     clears as soon as its field is fixed.
   - A failed attempt moves focus to the first `aria-invalid` control, whose
     description reads the message.
   - `FieldError` has no `role="alert"`: one live region per field would talk
     over that with every message at once.
6. **Save stays enabled while fields are wrong.** Pressing it names the
   fields. A button disabled for validation is exactly the silent failure
   this ADR removes. Save is still disabled while pending, without
   permission, or when nothing has changed.
7. **The toast is for what no field can show:** a server or submission
   failure (`useServerAction`), or an issue on a path no field renders. It is
   never the only sign of a field error.
8. **Error ink is `text-destructive-interactive`** (audit F-03). Raw
   `--destructive` is 4.39:1 on the dark ground, under the 4.5:1 text needs.
   The whole `Field` is no longer tinted red when invalid (base-nova tinted
   the typed value); the label and message carry the state.

## Enforcement

- `apps/web/app/admin-form-conventions.test.ts` fails:
  - an in-scope admin file that imports `Label`, renders a raw `<label>`, or
    writes `htmlFor`;
  - a form that calls `useFieldErrors` but never `.validate()`;
  - an admin catalog string containing "(optional)";
  - raw `text-destructive` used as text anywhere in the app or `@repo/ui`.
    Icons may keep it: they need 3:1, which the raw colour meets.
- `packages/ui/src/components/field.test.tsx` pins the wiring:
  - label ↔ control, the asterisk, required;
  - the describedby order;
  - no live region on the error;
  - every control reading its Field;
  - nothing added outside a Field.
- `packages/contracts/src/field-issues.test.ts` pins every code.
- code-style.md #24 states the rule.

## Alternatives rejected

- **The react-hook-form bridge `@repo/ui` already ships (`form.tsx`).** It
  would have moved about 30 hand-written `useState` forms onto a new state
  model: a rewrite of every form's data flow to fix its markup. The
  context-aware `Field` gets the same wiring with the state left where it
  is. `form.tsx` stays available and composes the same primitives.
- **Option (b): keep toast-level errors and associate only the inline
  messages that exist.** Declined by the owner.
- **"(optional)" on the non-required fields.** Declined by the owner. Most
  admin fields are optional, so the marker would sit on most of the form.

## Consequences

- A control inside a Field must not set its own `id`: the label would point
  at the Field's id. Pass `controlId` to the Field when the id is needed
  elsewhere.
- Client validation is only as strict as the contract schema. A rule the
  server enforces elsewhere (for example uniqueness) still comes back as a
  toast from the action.
- The public sign-in and sign-up forms already follow the pattern by hand.
  They are not migrated here; ADR-077 is an admin convention, like ADR-044.
