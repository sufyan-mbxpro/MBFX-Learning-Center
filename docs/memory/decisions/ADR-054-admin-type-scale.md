# ADR-054: The admin gets its own type scale, switched by one class on the admin root

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 07 (`@repo/ui` — the stylesheet), 09 (admin shell — the two root layouts)
**Supersedes:** —
**Superseded by:** —

## Context

The owner asked why the admin does not "read as Outfit". Investigation
against the running app settled that it _is_ Outfit — the font file loads
(`/_next/static/media/outfit_latin_wght_normal-…woff2`, 200, `status:
"loaded"`), and forcing a heading to the metric fallback measurably
changes its width (`News & Analysis`: 137.0px in Outfit, 139.1px in the
fallback, 151.8px in Arial). ADR-039 is intact and nothing is broken.

The real cause is size, not family. The admin renders almost entirely at
the two smallest steps of the scale:

| utility    | px  | admin uses | `@repo/ui` uses |
| ---------- | --- | ---------- | --------------- |
| `text-xs`  | 11  | 114        | 16              |
| `text-sm`  | 12  | 97         | 61              |
| `text-lg`  | 16  | 6          | 2               |
| `text-2xl` | 20  | 3          | 0               |

Outfit is a geometric sans; its character lives in circular bowls and a
single-storey `g` that simply do not resolve at 11px. The page `h1`
(`AdminPageHeading`) is `text-2xl` — 20px — so even the largest type on an
admin screen is smaller than the public site's body copy. The public site
does not have this problem because it sets its display type with arbitrary
values (its `h1` computes to 72px) rather than living at the bottom of the
scale.

Two facts constrain the fix:

1. **The scale is global.** `--text-*` is declared once, in `@theme inline`
   in `@repo/ui`'s `globals.css`, and both surfaces import that one
   stylesheet (ADR-006: one app, one dependency graph). Raising `--text-sm`
   raises it for the 60 public and 61 shared-component call sites too — a
   redesign of a public site that had its design pass the same day, which
   is not what was asked for.
2. **`@theme inline` compiles to literals, not `var()`.** Verified in the
   browser against the live CSSOM:

   ```css
   .text-xs {
     font-size: 11px;
     line-height: var(--tw-leading, 16px);
   }
   ```

   That is what `inline` _means_ — the declared value is substituted into
   each utility at build time. So the obvious move (redeclare `--text-xs`
   on a container inside the admin) is inert: there is no `var()` left in
   the compiled utility to intercept. Any surface-scoped scale therefore
   requires putting an indirection back into the `@theme` declaration
   itself.

This is a design change to a code-owned surface, so ADR-042's settled
position applies and Part F #10 requires this ADR before the code.

## Decision

**One reader scale, one admin override, switched by a class on the admin
`<html>`.**

1. **`--type-*` in `:root` becomes the source of truth for the type
   scale** — ten size/line-height pairs at exactly today's values
   (`--type-xs: 11px` / `--type-xs-lh: 16px`, through `--type-5xl: 32px` /
   `--type-5xl-lh: 40px`). Nothing about the reader's scale changes; the
   numbers move location, not value.

2. **`@theme inline` gains one level of indirection per step:**

   ```css
   --text-xs: var(--ui-xs, var(--type-xs));
   --text-xs--line-height: var(--ui-xs-lh, var(--type-xs-lh));
   ```

   `--ui-*` is deliberately **never defined in `:root`**, so every public
   render falls through the fallback to `--type-*` and compiles to the same
   pixel value it does today. This is the same indirection the colour
   tokens have always used (`--color-background: var(--background)`);
   applying it to type is not a new pattern in this file.

   The indirection is applied to **all ten steps**, not only the seven the
   admin overrides. A uniform rule has no "why doesn't `3xl` respond?"
   failure mode for the next person.

3. **`.type-scale-admin` defines `--ui-*` for every step**, and is applied
   to `<html>` in BOTH admin root layouts — `(admin)` and `(admin-auth)`:

   | step   | reader | admin | what it carries                    |
   | ------ | ------ | ----- | ---------------------------------- |
   | `xs`   | 11/16  | 12/16 | badges, timestamps, helper text    |
   | `sm`   | 12/18  | 13/20 | body, labels, table cells, sidebar |
   | `md`   | 13/20  | 14/21 | —                                  |
   | `base` | 14/22  | 15/24 | —                                  |
   | `lg`   | 16/24  | 18/26 | `AdminSection` headings            |
   | `xl`   | 18/26  | 20/28 | —                                  |
   | `2xl`  | 20/28  | 24/32 | `AdminPageHeading` — the page `h1` |
   | `3xl`  | 24/32  | 28/36 | —                                  |
   | `4xl`  | 28/36  | 32/40 | —                                  |
   | `5xl`  | 32/40  | 36/44 | —                                  |

   **All ten, not only the seven the admin renders today.** The first draft
   stopped at `2xl` on the reasoning that `3xl`–`5xl` have zero occurrences
   under `app/(admin)/**` and could fall through. Probing the running admin
   showed why that is wrong: it left `--ui-2xl` (24px) exactly equal to the
   reader's `--type-3xl` (24px), so the first admin screen to reach for
   `text-3xl` as "bigger than the page title" would have got no increase at
   all — a dead rung, silent, and discoverable only by measuring. A
   complete scale has no such edge and costs six lines.

   Hierarchy is preserved throughout: every step stays strictly larger than
   the one below it, and the gap between body (`sm`) and page heading
   (`2xl`) widens from 8px to 11px, which is the point.

4. **The scale is applied by class, not by re-declaring `--text-*`.**
   `@repo/ui` exports `ADMIN_TYPE_SCALE_CLASS` rather than leaving the
   string to be typed twice. A misspelt class name fails silently — it
   would simply render the reader scale in the admin, which is precisely
   the bug being fixed and would look like a regression of this ADR rather
   than a typo.

5. **The article editor's `.ed-fs-*` classes are repointed from `--text-*`
   to `--type-*`.** These are the author's chosen body sizes and they
   render on BOTH surfaces — inside the editor (admin) and in the published
   article (public). Left on `--text-*` they would pick up the admin
   override and the editor would stop being a preview of what the reader
   gets. Pinned to `--type-*` they render at the reader's size in both
   places, which is what a WYSIWYG editor owes its author.

6. **`--brand-base-font-size` is not touched.** It is a theme layout token
   (`DEFAULT_LAYOUT`, DB-backed, behind ADR-038's paused editor); the
   admin's `<body>` keeps inheriting 14px from it. Almost all admin text
   sets an explicit step anyway, so routing this change through a paused
   admin-editable token would be both less effective and a second source of
   truth.

## Consequences

- The admin gets measurably larger type at every step it uses, and Outfit's
  geometric character becomes legible in the chrome — the actual request.
- **Text reflows.** Larger type in fixed-width table columns means earlier
  truncation and taller rows. This is inherent to the request, not a
  regression; it is verified by screenshot on the densest screens
  (`/admin/articles`, `/admin/users`) and by an explicit no-horizontal-
  overflow assertion, rather than assumed.
- The public site is untouched by construction, not by care: with `--ui-*`
  undefined outside `.type-scale-admin`, every public utility compiles to
  the identical value it had before. Verified by probing computed sizes on
  `/` before and after.
- Reverting is deleting the class from two layouts. Reverting the mechanism
  as well is deleting one CSS block; the `var(--ui-x, var(--type-x))`
  fallback chain keeps working with no `--ui-*` ever defined.
- The next admin screen inherits the scale with no action — it composes
  `AdminPage` and uses the same `text-sm`/`text-xs` utilities as every
  other screen, which is why this was done at the token layer instead of by
  rewriting ~211 class strings.
- One genuine cost: a developer reading `text-sm` in an admin file can no
  longer assume 12px. The `.type-scale-admin` block names the surface and
  ADR-044's display conventions are the place a reader already looks for
  "how does the admin differ", so this is documented rather than latent.

## Alternatives considered

- **Raise the global scale.** Rejected: it redesigns the public site
  (60 + 61 call sites) to fix the admin, on the same day the public design
  pass landed, and the owner asked for the admin specifically.
- **Rewrite the ~211 admin `text-xs`/`text-sm` occurrences one step up.**
  Rejected on three counts: it cannot reach the 77 `text-sm`/`text-xs`
  usages inside shared `@repo/ui` components (a `Badge` would stay 11px
  inside a 13px screen), it is a large error-prone diff, and every future
  admin screen would have to remember the convention or silently regress.
- **Override `--text-*` on a wrapper inside the admin.** Rejected because
  it does not work — `@theme inline` has already compiled the literals into
  the utilities (verified against the live CSSOM, see Context #2). This is
  the alternative that looks obvious and would have been shipped broken.
- **Give the admin its own stylesheet / `@theme` block.** Rejected: two
  Tailwind theme blocks over one dependency graph duplicates every token,
  not just type, and re-opens the admin-weight-in-public-bundles question
  architecture.md #5 closes.
- **Route it through `--brand-base-font-size` per scope** (`loadActiveTheme`
  already takes `"web" | "admin"`). Rejected: it only moves `<body>`, which
  almost no admin text inherits, and it puts a design decision back inside a
  token whose editor ADR-038 paused.

## Compliance

- `pnpm governance:check` — this ADR lands before the code change.
- code-style.md #1 is unaffected: these are size tokens, not colour
  literals, and the values live in `@repo/ui`'s own token block.
- Tests (testing.md #2 — the mechanism ships with the test that would catch
  its failure):
  - `packages/ui` — the compiled contract: every `--text-*` step resolves
    through `var(--ui-*, var(--type-*))`, `--ui-*` is absent from `:root`
    (so public is unchanged), `.type-scale-admin` defines every step, the
    admin scale is strictly monotonic, and every admin step is strictly
    larger than its reader counterpart.
  - `apps/web` — both admin root layouts carry `ADMIN_TYPE_SCALE_CLASS` and
    the public root layout does not.
- Live verification on the running app: computed `font-size` on the admin
  sidebar, table cells and page `h1` before/after; the same probes on `/`
  showing no change; no horizontal overflow on the densest admin screens;
  both light and dark mode.
- DEVLOG entry recording the change and its test results, per testing.md #6.
