# ADR-044: Admin display conventions — no raw identifiers, one typeface, confirm every destructive action, heading over the content

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 09 (admin shell), applying to every admin screen in every module
**Supersedes:** —
**Superseded by:** —

## Context

`docs/changes/changes-08.md` is a cross-cutting UI review of the admin
portal. Most of its items are not "fix this screen" — they are rules that
every screen has to follow, including screens not written yet. Left as a
list of per-screen edits they would decay: the next CRUD screen would ship
a `<code>{row.key}</code>`, a start-aligned Save, and a delete button with
no confirmation, and the review would have to happen again.

Four of the items are contracts rather than tweaks, so they land here.
The remaining items (two-column brand colours, a Visit Site link, media
hover actions) are ordinary changes and live only in the DEVLOG.

The mechanism for each is already in the repo — `AdminPage`,
`ConfirmDialog`, `DataTable`, the `@repo/utils` helpers. What was missing
was the rule saying they are not optional.

## Decision

### 1. A raw identifier never renders

Role keys, permission keys, setting keys, feature-flag keys, enum members,
theme token ids and section keys are identifiers. They reach the screen
through `humanizeKey()` (`@repo/utils`) or, better, through a catalog
string — never as themselves. `super_admin` reads "Super Admin";
`legal.copyrightNotice` reads "Legal Copyright Notice".

This is **display-only**. `humanizeKey` output is never parsed back, never
used as a lookup key, and never written to the database. The identifier
stays the identifier everywhere it matters — `requirePermission("users.view")`
is unaffected, and so is the Module 03 permission-key cross-check.

Precedence, when a value has more than one possible source:

1. A message-catalog string (code-style.md #2) — always wins.
2. A human name stored alongside the key (`role.name`, `permission.label`).
3. `humanizeKey(key)` — the fallback for code-defined registries that have
   no catalog entry of their own.

`humanizeIfKey()` exists for values that may ALREADY be prose: it leaves
"Head of Content" alone and still expands "super_admin".

### 2. One typeface across the admin

The admin renders in the brand sans (Outfit, ADR-039) — body text, subtext,
muted text, badges, table cells, all of it. `<code>`, `<kbd>`, `<samp>` and
`<pre>` inherit a monospace family from Tailwind's preflight, which is why
identifier chips were rendering in the wrong face; **`<code>` is not used
for admin chrome**. A muted `<span>` carries the same meaning.

The exception is narrow and deliberate: a form control whose VALUE is code
the admin has to read character by character keeps `font-mono` — the JSON
settings textarea, the hex colour field, the role-key field, the generated
temporary password. Fixed-width there is doing a legibility job, not a
decorative one.

### 3. Destroying something asks first

Every action that deletes, removes, clears or detaches goes through
`ConfirmDialog` before it runs — in tables, dialogs, media grids, settings
forms and image widgets alike. This holds for an action that only stages a
change (clearing an image field before the section is saved) as well as one
that writes immediately: the admin's intent is what is being confirmed.

Two things are explicitly NOT confirmed:

- **Restoring** a soft-deleted row. Restore is the undo. Putting a
  confirmation in front of the way back makes the destructive path harder
  to reverse, which is backwards.
- **Adding** a row, and other constructive actions.

A confirmation is not authorization. `requirePermission()` in the action is
still the boundary (security.md #1) — the dialog is UX.

### 4. Every screen states what it is, above its own content

Every admin screen renders a title AND a one-line description, from the
catalog. On a screen with a settings sub-nav the heading renders inside the
CONTENT column (`SettingsScreen`), not above both columns — a heading above
the sub-nav reads as a label for the category list rather than for the
fields the admin came to edit.

Confirming actions — Save, Submit, Update, Apply — sit at the inline END of
their form or section, matching the dialog footers and the "New X" buttons
that already end their rows. Inline-end, not `right`: RTL flips it.

## Consequences

- New admin screens inherit all four rules by composing `AdminPage` /
  `SettingsScreen`, `ConfirmDialog` and `DataTable`. A screen that opts out
  is visibly doing something different.
- `.claude/rules/code-style.md` gains the identifier and typeface rules;
  `.claude/rules/security.md` is unchanged — rule 3 here is a UX rule and
  says so.
- The cancelled surfaces (ADR-042: `/admin/website/*`, Navigation manager,
  Homepage composer, Settings → Layout, theme Layout tab) are **out of
  scope**. They are hidden from the UI and will not be reached; they are not
  brought up to these conventions, and that is not a gap to close later.
- `humanizeKey` carries an acronym list (SEO, URL, CMS, …). A key using an
  acronym not in that list renders title-cased — a cosmetic miss, fixed by
  adding the token, never by special-casing a call site.
