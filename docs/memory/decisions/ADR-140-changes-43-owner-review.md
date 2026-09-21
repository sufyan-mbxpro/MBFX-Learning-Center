# ADR-140 — changes-43: the system typeface, an article hero, and the title row carries the actions

- **Status:** Accepted — §6 fill value and white-label rule superseded by ADR-143
- **Date:** 2026-09-19
- **Module:** 02 (`@repo/theme` defaults), 07 (`@repo/ui`), 08 (mobile navigation),
  09 (admin shell), 12 (public site), 15 (articles)
- **Plan:** owner request, `docs/changes/changes-43-fixeing.md`
- **Supersedes:** ADR-106 §1 (a table's primary action lives in the table's
  toolbar). ADR-072 §6 and ADR-102 §1 **in their defaults only**: Inter stops
  being the default sans and Fraunces stops being the default display face. The
  hero section of `_sections/hero.tsx`'s own header note ("the band is STATIC").
  ADR-131's success panel on the support form (§7).
- **Extends:** ADR-106 §2 (a section's strip survives the tab), ADR-108 (the
  ⌘K palette).

## Context

The owner reviewed both surfaces and sent eighteen notes. Most of them are
fixes inside rules that already exist, such as the size of a button, a modal
taller than the screen, or a success message. The rest change a rule, and
this ADR records them.

## Decision

### 1. The brand typeface is the operating system's own UI face

The owner asked for "this site's font" (mbfx.co). That site's stylesheet
declares a self-hosted face called _Delight_ in ten `@font-face` rules and
**applies it nowhere**. A headless Chromium probe of the live page reports
`ui-sans-serif, system-ui, sans-serif` as the computed family of its `body`,
`h1`, `h2`, `h3`, `p` and `button`. So what the owner sees there is Segoe UI
on Windows and San Francisco on a Mac.

We therefore adopt the system stack, not Delight. This also avoids a licence
question: Delight is a commercial face, and a licence for one domain does not
cover another.

- `DEFAULT_LAYOUT.fontSans` and `DEFAULT_LAYOUT.fontDisplay` both become
  `"system"`, the curated key that has existed since ADR-005.
- `20260919090000_system_typeface_changes43` rewrites existing `Theme` rows.
  It is bounded to rows still holding the seeded pair (`inter` / `fraunces`),
  so a deliberate pick survives, the same bound ADR-108 used.
- Inter keeps its declaration and loses its `preload`. Preloading a file no
  page references is a wasted request on every visit.
- **The sizes stay on our scale.** The reference's section heading is
  `text-3xl md:text-5xl font-bold`, its lead is `text-xl`, its card title is
  `text-xl font-semibold` and its button is `h-10 text-sm font-medium`. Those
  are Tailwind's default steps, and ADR-072's scale already has the same
  values (30/48, 20, 20, 14). `SectionHeading` and the display headlines
  adopt those steps and weights. A serif headline set at `font-normal` was
  right for Fraunces and is wrong for a UI sans, so display type goes to
  `font-bold`.
- The admin shares the change. code-style #6 ("one typeface") is about the
  admin using the brand sans, and the brand sans is now the system face.

### 2. The homepage opens on a slider of articles

The previous version of `hero.tsx` was a single static band over the owner's
footage, and its header note explained why it read nothing. The owner has now
asked for the opposite: "a full page slider from the articles… remove the
video… the other design will remain same."

- The `split` hero becomes a full-bleed slider of published articles.
  `getSpotlightArticles` supplies the set (featured first, then topped up),
  which is the rule `/news` already uses. The hero therefore composes the
  article module's own published rule instead of defining its own.
- Each slide shows its cover at full strength under the `--secondary` scrim
  (ADR-117's guarantee over an arbitrary photograph), plus the category, the
  title, the excerpt and one "Read article" button. A cover-less article falls
  back to the kind-toned panel `/news` uses.
- `HOME_MEDIA.heroVideo` is deleted. `HeroVideo` stays, because the in-practice
  band still plays its own footage through it.
- **Zero published articles ⇒ the static band**, on its `--secondary` fill and
  without footage. A homepage must never open on an empty slider.
- **Motion.** A slide advances on its own every seven seconds. This stops on
  hover, on focus inside the band and under `prefers-reduced-motion`, and a
  pause button is always shown (WCAG 2.2.2). Prev/next and a dot per slide
  are real buttons with catalog labels.
- The `QuickStartBanner` stays floated across the bottom edge, unchanged.
- The first slide's image is the page's LCP, so it takes `priority` and the
  band still carries no `Reveal` (ADR-104 §6).

### 3. An admin screen's actions sit in its title row

The owner wants every "New …" button to sit on the title row, beside
Settings, as a standard. That reverses ADR-106 §1, which moved the primary
action into the table's toolbar.

- `AdminPageHeading`'s `actions` holds the screen's buttons. The primary
  create action comes **last**, at the inline end, after any secondary
  outline buttons such as Settings. The table toolbar keeps search, filters,
  export, column picker and bulk actions.
- A section whose heading is drawn by a LAYOUT (ADR-106 §2) gets its page's
  action through `HeaderActions`. The layout renders a slot, and a page
  portals its button into that slot. The layout still cannot know which tab
  is active, so the page stays the owner of its own action.
- **An editor's heading is static.** "Edit news", "Edit course" and so on,
  never the record's title. The Save / Preview / View-live cluster sits on the
  same row, at the inline end. The record's title is already the first field
  on the page, and repeating it at `text-3xl` pushed the editor's actions onto
  a second row. The back link above the heading stays. `EditorPage` (a sticky
  `AdminPage`) is the one frame for this.

`admin-toolbar-conventions.test.ts` is inverted to match: a `DataTable
actions=` is now the failure.

### 4. Tab switches do not rebuild the page

ADR-106 §2 stopped the strip from being rebuilt. The owner still sees a
reload, because the segment's `loading.tsx` swaps in a whole-page skeleton,
header shapes included, under a header that never left. Two changes:

- `SubNav` links prefetch in full (`prefetch={true}`). By the time a tab is
  clicked, its payload is already in the router cache, so no skeleton renders.
- A skeleton under a layout-drawn heading draws only the table. This is
  `TablePageSkeleton`'s `header={false}`.

### 5. Both ⌘K palettes use one shape

The public palette and the admin palette become one layout:

- a wide dialog, capped to the viewport;
- a full-width input row;
- results grouped under a caps heading per category, each row led by an icon
  tile and carrying an optional one-line description;
- a footer with the keyboard legend (↵ open · ↑↓ navigate · esc close).

**No row renders a URL.** The admin palette printed `/admin/users` under each
result. A path is an identifier, and code-style #5 already forbids showing
identifiers. The public palette groups by the kinds `searchPublicContent`
already returns.

### 6. A button's label is white; the fill moves to make that legible

The owner asked for white button text. ADR-072 §1 refused white on the brand
primary, and it was right to: white on `#C28D5A` is 2.77:1. So the fill
moves, not the rule.

- The engine emits `--primary-solid`, which is `deriveInteractive(primary,
white, 4.5)`: the brand hue, darkened until white clears 4.5:1 against it
  (`#936b44` for the default brand). It also emits
  `--primary-solid-foreground` (white) and `--primary-solid-hover`.
- `Button`'s default variant uses the solid fill. So do the other controls
  that read as buttons: the active section-bar pill, active shelf chips,
  scroll-to-top, the toast action and the selected calendar day.
- `--primary` itself is untouched and keeps its identity uses: chips, charts
  and swatches.
- A property test holds the contract for every palette an admin can pick, in
  both modes.
- `size="xl"` takes `sm:min-w-60`, so two CTAs side by side ("Read the latest"
  / "Browse topics") are one size on every page.

### 7. Three smaller reversals

- **The support form confirms under its button** (supersedes ADR-131's panel).
  The form stays in place. The confirmation is a brand-tinted status box under
  Send, not a blue `success` panel that replaced the form.
- **The explore carousel's icon badges are solid.** A 10% wash over a
  photograph let the picture show through the badge.
- **The Tools mega panel carries the schools' footer.** `viewAll` resolves
  against the panel's own top-level item as well as its child rows. The
  changes-33 argument (the footer lists nothing the columns do not) lost to
  the owner's ask that the two panels look alike.

## Consequences

- The theme editor's Layout tab (paused, ADR-038) still lists every curated
  font. The default changed, not the choice.
- A homepage whose editors publish nothing looks exactly as it did, minus the
  footage.
- `admin-toolbar-conventions.test.ts` now guards the new rule in the opposite
  direction, so a later "move it back into the toolbar" is a visible test
  change rather than a silent drift.
