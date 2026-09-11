# ADR-057: Admin dropdowns are searchable and full width; every modal has a title and a description

**Status:** Accepted
**Date:** 2026-09-08
**Module:** 07 (`@repo/ui`), applying to every admin screen in every module
**Supersedes:** —
**Superseded by:** —
**Extends:** ADR-044 (admin display conventions) — this adds conventions #10
and #11 to the same numbered set in `.claude/rules/code-style.md`.

## Context

Two reports from the owner, both about forms rather than about one screen:

1. A dropdown in a form renders at the width of its current value, not the
   width of the field, and a long option label is truncated when the list
   opens. "The dropdown should be full length visible."
2. There is no way to find an option in a long list. "Make a rule that all
   the dropdowns should be searchable."
3. Modals open with a bare title and no explanation of what the modal does.

Both dropdown symptoms trace to one place. `SelectTrigger` in
`packages/ui/src/components/select.tsx` was `w-fit`, so a form control sized
itself to its content; `SelectContent` was `w-(--anchor-width)`, which pins
the popup to exactly the trigger's width and truncates anything longer. Some
call sites had already worked around the first half with `className="w-full"`
and some had not — 46 `<SelectTrigger>` across 22 in-scope admin files, each
deciding its own width.

Neither is fixable by editing screens. The next screen would make the same
two decisions again, which is the ADR-044 argument repeated: the items that
are contracts rather than tweaks belong here.

The third is ADR-044 #8 applied one level down. That rule already requires a
catalog title **and** a one-line description on every admin _screen_. A modal
is a screen that opens over another one, and it needs the description more,
not less — the user arrived without the surrounding page context.

## Decision

### 1. One dropdown component, and it is searchable by default

`@repo/ui/components/combobox` is the dropdown every admin screen uses. It
takes `options: { value, label, disabled? }[]`, a string `value`, and an
`onValueChange`. Admin screens do not import
`@repo/ui/components/select` directly.

Making the wrapper the only entry point is the whole point. The owner's rule
is "dropdowns are searchable"; if search is a prop, the rule is a thing every
future screen has to remember, and one of them will not. As a component
default it is not a decision the next screen makes at all.

### 2. Searchable means "search when there is something to search"

The component renders a search input when it has
`SEARCHABLE_ITEM_THRESHOLD` (**8**) options or more, and no input below that.

This is the one place the implementation is narrower than the report, and
deliberately. Base UI's own usage guidance for Combobox is explicit:

> **Avoid when not rendering an input**: Use Select instead of Combobox if no
> input is being rendered, which includes accessibility features specific to
> a listbox without an input.

So a search field over a three-option Draft/Published picker is not merely
visual noise — a Combobox that renders no input has weaker listbox semantics
than the Select it replaced. The threshold therefore switches the underlying
**primitive**, not just the input's visibility:

| Options | Primitive          | Search input |
| ------- | ------------------ | ------------ |
| >= 8    | Base UI `Combobox` | yes          |
| < 8     | Base UI `Select`   | no           |

Both branches are the same component, the same props and the same trigger
styling, so a dropdown does not change shape when its list grows past the
threshold — only its popup gains a search field. `searchable` overrides the
threshold in either direction where a call site knows better (a five-option
list of near-identical currency pairs; a fifty-row list that is already
filtered upstream).

A short fixed enum — status, difficulty, visibility — is expected to land on
the Select branch. That is the rule working, not an exception to it.

### 3. Full width is the default; a toolbar opts out

The trigger is `w-full`. A dropdown is a form control and takes its field's
width, like `Input` does.

Table-toolbar filters are the exception, and they stay an exception because
ADR-044 #9 puts filters in the table's toolbar — a row of controls, where
full width would give one filter the whole row. Those call sites pass an
explicit `className="w-40"`, which `tailwind-merge` resolves over the
default. **An explicit width is how a toolbar filter declares itself**; the
absence of one means "this is a form field".

### 4. The popup's width has a floor, not a fixed value

`min-w-(--anchor-width) max-w-(--available-width)` replaces
`w-(--anchor-width)`, on both branches. The trigger sets the popup's minimum
width; the viewport sets its maximum; a long option label makes the popup
wider than the trigger instead of being truncated inside it.

This changes `select.tsx` itself, so it reaches the two public
`@repo/blocks` dropdowns as well. That is intended — the truncation was a
bug everywhere it appeared, not an admin-only one.

### 5. Every modal renders a title and a one-line description

Every `DialogContent` contains a `DialogHeader` with both a `DialogTitle`
and a `DialogDescription`. The description is one line saying what the modal
does or what confirming it will cause — not a restatement of the title.

`ConfirmDialog` has required `title` and `description` props and already
enforces this for destructive actions; this extends the same standard to the
ordinary create/edit modals, which had drifted.

Both strings go through catalog keys (`code-style.md` #2). Per ADR-043 the
`admin` namespace is English-only, so they need a value in `en.json` and
nowhere else.

The one exception is a modal whose header is deliberately visually hidden
because the surface itself is the label — the ⌘K command palette
(`CommandDialog`) is the only current instance. It still renders both
elements, inside `sr-only`, so the accessible name and description exist.

## Enforcement

A convention that is only written down decays, so both halves are checked:

1. **Lint** — `no-restricted-imports` on `@repo/ui/components/select` for
   files under `app/(admin)/**`, pointing at the combobox. The message names
   the `searchable={false}` escape hatch so the fix is obvious.
2. **Guard test** — `apps/web/app/admin-dialog-conventions.test.ts` reads
   admin sources and fails on a `DialogContent` whose file has a
   `DialogTitle` and no `DialogDescription`. Source-scanning rather than
   rendering, following the `type-scale.test.ts` precedent: these are async
   server components whose bodies await a session.
3. **Component tests** — `packages/ui/src/components/combobox.test.tsx`
   covers the threshold in both directions, the width default and its
   override, filtering, and the empty-string sentinel row.

## Scope

Out of scope, consistent with ADR-044's own scope statement: the surfaces
cancelled by ADR-042 (`app/(admin)/admin/website/**`) and paused by ADR-038
(the homepage section composer). They keep the raw `select` import and are
excluded from the lint rule by path. Nothing there is deleted; nothing there
is brought up to this ADR either.

The public site is unaffected except for decision #4, which reaches
`@repo/blocks` through the shared primitive.

## Consequences

- 46 call sites across 22 files collapse to one component, and each loses
  its `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`
  import block in favour of an options array. Net: fewer lines, and the
  option list becomes data instead of JSX.
- A dropdown's behaviour now depends on how many options it has at runtime.
  A list that crosses eight gains a search field without anyone editing it.
  This is intended, and is why both branches share the trigger's styling.
- `AdminCombobox` (`app/(admin)/admin/_components/combobox.tsx`) supplies the
  search and empty-state strings from the catalog, so call sites do not
  thread them. `@repo/ui` keeps carrying no catalogs.
- The Base UI Select branch cannot be driven to commit a selection under
  jsdom (a bare `click` on an item is a no-op there, for any value —
  verified). Interaction coverage therefore runs through the Combobox
  branch, and the Select branch is asserted structurally. Anything needing
  real selection semantics on a short list is an E2E test.
