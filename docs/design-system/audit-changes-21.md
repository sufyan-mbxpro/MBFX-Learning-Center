# changes-21 Phase B — UI consistency audit

**Status:** Phase B complete, 2026-09-12.

- F-01 to F-07 and F-11 are fixed; F-08 is accepted (Q-1); F-09 is left for
  Phase C; F-10 is accepted.
- The crawl raised F-12 to F-19 (public) and F-20 to F-28 (admin). They are
  **open**, for Phase C (§6).
- Both owner questions are answered (§8).

**Date:** 2026-09-12
**Scope:** every live route in both surfaces of `apps/web`, checked against
`docs/design-system/tokens.md` (binding, ADR-072) and code-style.md #1–#24.
The retained, hidden surfaces (Website Builder, homepage composer, navigation
reorder; ADR-038/042) are out of scope, as in every changes-20 pass.

Every finding has an id (**F-nn**), a severity, and a status:

- **fixed**: changed in the Phase B commit, with its regression guard;
- **accepted**: examined and kept as is, with the reason;
- **open**: recorded with a proposed fix, for Phase C;
- **question**: needed the owner's decision (§8).

Severity follows the Phase C scale:

- **blocker**: broken or inaccessible;
- **major**: visibly wrong, or fails WCAG AA;
- **minor**: inconsistent.

---

## 1. Method

| Check                          | How                                                                                                                                                                                                                                                       | Coverage                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Automated greps (B1)           | Source scans of `apps/web/app` and `packages/ui/src`                                                                                                                                                                                                      | every live file                                                                                                                                              |
| Convention census (B2, source) | A node script reading every `.tsx`: Button variant × size, dialog footer order, lucide icon sizes, `outline-none` without a focus ring, `dark:` overrides, form error patterns                                                                            | every live file                                                                                                                                              |
| Page review (B2, runtime)      | A Playwright crawl of the running app, per route: HTTP status, visible h1 count, text off the type scale, control heights off the control scale, images without alt, console errors, and axe-core 4.13 (WCAG 2.0/2.1/2.2 A+AA, serious and critical only) | every public route (one real URL per template, from the sitemap, plus sign-in, sign-up and an unknown path) and every admin route (one real record per list) |
| Responsiveness (B3)            | The same crawl at **360, 768, 1024 and 1440** px: sideways overflow and the element causing it, and tap targets under 24px at 360 (WCAG 2.5.8)                                                                                                            | as above                                                                                                                                                     |
| Dark mode                      | The same crawl in dark at 1440 and 360, axe included                                                                                                                                                                                                      | as above                                                                                                                                                     |

- **Sign-in.** The admin crawl signs in through the auth API and signs the
  session out at the end. The script reads the password from `.env` and
  never prints it.
- **One load per mode.** Each route is loaded once in light and once in
  dark. The narrower widths are measured by resizing the loaded page, not by
  reloading it.
- **When it ran.** The crawl ran after the Phase B fixes, so §4–§5 describe
  the fixed state. The scripts are not committed; they lived in the session
  scratchpad.

**Dev server problems, twice.**

- **Before the first crawl**, the dev server answered 500 on every route: its
  Turbopack PostCSS worker crashed on every start (`Node.js subprocess
crashed while evaluating loaders [postcss]`). The same `globals.css`
  compiled cleanly outside Turbopack with the app's own PostCSS config, so
  the source was not the cause. Clearing `apps/web/.next` (with the owner's
  approval) fixed it. If it recurs, clear that folder first.
- **Later in the pass**, the server had exited and was started again with
  `pnpm dev`.

---

## 2. Automated scans (B1)

| Scan                                                             | Result                                                             | Verdict                                                                                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Arbitrary values `-[…]`                                          | 0 (lint-enforced since changes-20 Phase 6, `noArbitraryValueRule`) | clean                                                                                                                                                                                                              |
| Raw palette colours (`bg-slate-*`, `text-gray-*`, `bg-red-*`, …) | **0**                                                              | clean                                                                                                                                                                                                              |
| `black` / `white` utilities                                      | 11                                                                 | **accepted**: all are black-to-transparent scrims over artwork (course/quiz/video cards, video tile) and the video letterbox, each with a comment saying no colour is being chosen, plus white ink on those scrims |
| Inline `style` colours                                           | 3                                                                  | **accepted**: the theme editor's own swatch preview (shows the admin's chosen colour) and the dashboard charts, whose colours are all `var(--color-*)` tokens                                                      |
| Raw font sizes (`text-[…]`, inline `fontSize`)                   | 0 in markup; chart ticks pass `fontSize: 11` to Recharts           | **accepted**: 11px is the `2xs` step (F-10)                                                                                                                                                                        |
| Native `<select>`                                                | 0                                                                  | clean (ADR-057)                                                                                                                                                                                                    |
| Native `<table>` outside `@repo/ui` `Table`                      | 0 (1 hit is a comment)                                             | clean                                                                                                                                                                                                              |
| Raw `<button>` outside `Button`                                  | 0 (hits are comments and a Base UI `render` prop)                  | clean                                                                                                                                                                                                              |
| Clickable `div` / `span`, stray `cursor-pointer`                 | 0                                                                  | clean                                                                                                                                                                                                              |
| Hand-sized controls (`h-*`/`size-*` on Button, Input, triggers)  | 0                                                                  | clean                                                                                                                                                                                                              |
| Raw checkbox / radio inputs                                      | 0                                                                  | clean                                                                                                                                                                                                              |
| Components in apps shadowing `@repo/ui`                          | 0 (all 16 hits are `@repo/ui`'s own definitions)                   | clean                                                                                                                                                                                                              |
| Physical `pl-/pr-/ml-/mr-/left-/right-`                          | 0 in markup                                                        | clean: the remaining hits are the `data-[side=left]` slide animations (which are about a physical side) and comments                                                                                               |

---

## 3. Convention census (B2, source level)

### 3.1 Buttons

Every variant × size combination in the apps is a sanctioned one (tokens §6.1).
`outline/sm` (38 files) and `default/default` (27) lead, then the toolbar and
row-action sizes. `xl` appears only on public CTAs (ADR-018). The intent
variants (`info`, ADR-046) and `destructive/sm` appear where the ADRs put
them. **No finding.**

### 3.2 Dialogs, sheets, toasts

- **Footer order: all 22 footers put the dismiss control first and the primary
  action last**, and `DialogFooter` is the §6.14 recipe
  (`flex-col-reverse gap-2 sm:flex-row sm:justify-end`). So the primary sits at
  the inline end on desktop and on top on a phone, everywhere.
- Every modal has a title and a description (ADR-057 #5, guarded by
  `admin-dialog-conventions.test.ts`).

**No finding.**

### 3.3 Icons

lucide only (lint-enforced, code-style #22). Sizes in use: 2.5 · 3 · 3.5 · 4 ·
5 · 6, plus 10 as card-placeholder illustration.

- **The notification bell is `size-4.5`**, where §5 and §6.12 say top-bar icons
  are `size-5` (20px). → **F-05**.
- The two play glyphs at `size-7` (video player, video tile) are illustration
  inside a 56px play disc. Accepted, but see F-11.
- The radio indicator at `size-2` is the §6.14 spec. Accepted.

### 3.4 Focus

- `outline-none` without a focus ring in the same class string: 9 hits. All but
  one are popup containers (dialog, popover, menus) and the search inputs inside
  command/combobox popups, where focus is managed by the popup. That is shadcn's
  own recipe.
- The one interactive hit, `DataTable`'s sort-header button, **does** carry
  `focus-visible:ring-2 focus-visible:ring-ring`; it is on the next class
  string, which the scan did not read. **Census false positive, no finding.**
- **The rich-text editor's frame** still uses base-nova's pre-redesign focus
  (`focus-within:ring-3 ring-ring/50`), a `rounded-lg` radius and a
  `dark:bg-input/30` override. §1.5 and §6.14 give it the Textarea recipe:
  `rounded-md border-input bg-background`, a 2px ring with a 2px offset, no
  `dark:` class. → **F-04**.

### 3.5 Colour and contrast

**Raw `text-destructive` used as text fails AA in dark mode.**

- `#D93A34` on the dark background `#020817` is **4.39:1**, below the 4.5:1
  text minimum. On white it is 4.56:1, so it passes in light mode only.
- tokens §6.14 already names this: "raw red fails 4.5:1", so a destructive
  alert uses `text-destructive-interactive`.
- 26 text usages still take the raw colour:
  - form errors (`text-xs text-destructive`)
  - over-limit character counters in five editors
  - delete labels in menus and ghost buttons
  - the auth forms' error line
  - the quiz runner's "Incorrect"
  - lesson feedback's error
  - the upload errors
- Icons need only 3:1, which the raw colour meets, so destructive glyphs stay.
- The editor section's `danger` accent is `bg-destructive/15 text-destructive`:
  a /15 tint behind raw ink, where ADR-073 contracts `-interactive` ink at /10.

→ **F-03**.

### 3.6 Forms

- **Error presentation is hand-rolled everywhere.** `@repo/ui` ships `Field`,
  `FieldLabel`, `FieldError` and `FieldDescription`, and **no app form uses
  them**.
  - Only the three sign-in/sign-up forms wire the full pattern: `aria-invalid`
    on the control, `aria-describedby` to the message, `role="alert"` on it.
  - The admin forms show errors as a toast (`useServerAction`) or as a
    free-standing `<p className="text-xs text-destructive">` with no
    association to the control.
- **No required markers anywhere.** Admin forms disable Save until the
  required fields are filled, which is silent about _which_ field is missing.
- Labels: `Label` in 35 files. A raw `<label>` in 7; most wrap a checkbox or
  switch row, which is valid, but they are not the `Label` recipe.

This is a refactor across roughly 20 forms, so the approach is the owner's
call. → **F-07, question Q-3**.

### 3.7 Dark-mode overrides

Colours come from the theme's dark tokens, so `dark:` utilities should not be
needed. Two remain:

- the rich-text editor's `dark:bg-input/30` (F-04, now removed);
- a comment in the public header (not a class).

---

## 4. Page-by-page review and responsiveness (B2 runtime, B3)

### 4.1 The public header overflowed at 360 and at 1024–1279 (fixed)

The first crawl results showed the same sideways overflow on **every** public
page: 14px at 360 and 175px at 1024. The earlier spacing passes measured only
390 and 1440. Measured in the running app:

| Width      | Header needs | Has             | Overflow | Cause                                                                                                                  |
| ---------- | ------------ | --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1024       | 1,239px      | 1,014px         | 185px    | desktop nav shows from `lg` (1024), but logo 119 + nav 813 + actions 179 + two 24px gaps + two 40px paddings = 1,239px |
| 1180       | 1,239px      | 1,170px         | 29px     | same                                                                                                                   |
| 1280, 1440 | 1,239px      | 1,270 / 1,430px | 0        | fits                                                                                                                   |
| 390        | 380px        | 380px           | 0        | fits exactly (the changes-20 spacing pass)                                                                             |
| 360        | 390px        | 350px           | 24px     | hamburger 40 + logo 119 + actions 175 (theme toggle, Sign in, Join us) + gaps + the 16px gutters                       |

→ **F-01** and **F-02**, both fixed. **After the fix the crawl measured no
sideways overflow on any public page, at any of the four widths, in light or
dark.**

### 4.2 Public site (27 templates, after the fixes)

**Clean on every template:**

- every page answers 200;
- exactly one visible h1;
- no overflow at 360, 768, 1024 or 1440;
- no text off the type scale apart from the public display steps (below);
- sign-in, sign-up and the unknown path pass axe outright.

**Accepted:**

- **Display type** (40, 56 and 72px, `text-display-sm/md/lg`) is off the body
  scale by design: ADR-018's public display type, which tokens.md §2.2 leaves
  unchanged.
- **Tall controls.** The controls read as off-scale are accordion triggers
  (56–186px, multi-line content) and the video play surface (an
  `aspect-video` button), not fixed-height controls.
- **Short links at 360.** The header "Sign in" link (45×20) and breadcrumb
  links are under 24px tall at 360. axe's `target-size` rule passes them
  under WCAG 2.5.8's spacing exception, since no neighbour sits within 24px.
- **Soft 404.** An unknown path answers **200** with the not-found page (F-08,
  accepted under Q-1). In dev the console also logs Cache Components'
  `Could not validate 'instant'` for that route. That is a dev-only
  diagnostic.

**Findings:**

| Template(s)                                                                                                                                 | axe (serious/critical) or check         | Finding                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| `/`, `/learn`, `/glossary/topics`, `/about/*`, `/economic-calendar`, `/news`, track glossary, `/glossary/topics/[topic]`, video topic pages | `color-contrast`, light (and some dark) | muted text on tinted surfaces → **F-12**                           |
| `/`, `/about/*`, `/learn`, both track indexes, lesson pages                                                                                 | `color-contrast`, light and dark        | text whose colour is thinned with `/80` or `opacity-80` → **F-13** |
| `/`                                                                                                                                         | `target-size` ×12                       | carousel page dots are 6px tall → **F-14**                         |
| `/`                                                                                                                                         | `list` ×2                               | carousel tracks break list semantics → **F-15**                    |
| `/learn/crypto/crypto-foundations`                                                                                                          | `image-alt` (critical) + a 404 resource | an image with no alt → **F-16**                                    |
| `/news/[slug]`                                                                                                                              | `link-in-text-block`, dark only         | an in-body link told apart by colour alone → **F-17**              |
| `/learn`, track indexes, quiz indexes                                                                                                       | console                                 | a guest's progress fetch logs a 401 → **F-18**                     |
| `/news/[slug]`                                                                                                                              | control heights                         | 26px buttons off the control scale → **F-19**                      |

### 4.3 Admin portal

35 routes: every static admin screen, plus one real record per editor and
detail list. The crawl signs in as the seeded super admin.

**Clean on every route:**

- every route answers 200 (`/admin/social` redirects to
  `/admin/settings/social`, as designed);
- exactly one visible h1;
- no sideways overflow on any list, settings or detail screen at any width.

**No form field failed axe's labelling or ARIA checks, on any screen, in
either mode.** Every label, name, `aria-invalid` and `aria-describedby`
holds. This is the runtime half of F-07: the source guard proves the markup
convention, and the crawl proves the wiring renders.

**Accepted:**

- **1px inputs.** The "1px input" controls reported off the control scale are
  `sr-only` file inputs and filter checkboxes.
- **Short links at 360.** Breadcrumb and tab links are 20px tall there. axe's
  `target-size` passes them under the WCAG 2.5.8 spacing exception.
- **The design-system page's own failures** (`button-name`,
  `aria-progressbar-name`, `aria-toggle-field-name` in dark) belong to the
  showcase's demo instances. They are fixed when the components are (F-24).

**Findings:** F-20 to F-28, in the second table in §6.

---

## 5. Dark mode

- **Public:** no overflow at 360 in dark on any template.
- **Findings in both modes:** F-12's contrast failures on `/about`, `/learn`
  and `/news`, and F-13's thinned text.
- **Dark only:** F-17 (the in-body link).
- **Not observed:** nothing seen in light mode failed only because of a dark
  token.
- **Admin:** see §4.3.

---

## 6. Findings

| Id   | Severity | Where                                                                                                                                            | Finding                                                                                                              | Status                                                                                                                                                                                                                                                                                                                              |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | major    | public header, 1024–1279px                                                                                                                       | Desktop nav needs 1,239px but showed from 1024; the action cluster was pushed off-screen (185px at 1024)             | **fixed**: the desktop nav shows from `xl` (1280), and below that the hamburger sheet carries the same rows (D-1). The crawl measures no overflow at any width. Guard: `public-chrome.test.ts`                                                                                                                                      |
| F-02 | major    | public header, 360px                                                                                                                             | Header row was 390px wide on a 360px phone (24px overflow)                                                           | **fixed**: below `sm` the theme toggle moves into the mobile sheet as an "Appearance" row (`nav.appearance`); from `sm` up it stays in the header (D-2). Guard: `public-chrome.test.ts`                                                                                                                                             |
| F-03 | major    | 26 text usages (§3.5) + editor `danger` accent                                                                                                   | Raw `--destructive` text is 4.39:1 on the dark background (fails WCAG 1.4.3)                                         | **fixed**: every text usage in both surfaces and `@repo/ui` is `text-destructive-interactive`, and so are the icon-only delete buttons (D-7). `FieldError` and `form.tsx` carry it too. The `danger` tile is `bg-destructive/10` + `-interactive` (ADR-073). Guard: `admin-form-conventions.test.ts` (both surfaces and `@repo/ui`) |
| F-04 | minor    | rich-text editor frame                                                                                                                           | Pre-redesign focus ring (`ring-3 ring-ring/50`), `rounded-lg`, `dark:bg-input/30`                                    | **fixed**: the Textarea recipe (`rounded-md border-input bg-background`, 2px ring at a 2px offset, the Input's invalid state), with no `dark:` class                                                                                                                                                                                |
| F-05 | minor    | admin top bar, notification bell                                                                                                                 | Icon `size-4.5`; top-bar icons are `size-5` (§5, §6.12)                                                              | **fixed**. Guard: `top-bar-icons.test.ts`                                                                                                                                                                                                                                                                                           |
| F-06 | major    | admin, public and global error boundaries                                                                                                        | They took `reset`, which re-renders without re-fetching, so "Try again" could not recover from a server-side failure | **fixed**: all three take `retry`, which the installed Next 16.3.3 docs mark stable since 16.3.0. Guard: `loading-states.test.ts` fails a boundary that uses `reset`                                                                                                                                                                |
| F-07 | major    | ~50 admin form files                                                                                                                             | Field errors not associated with their controls; `FieldError` unused; no required markers                            | **fixed** (Q-3 (a), **ADR-077**, code-style #24). The owner's answer and the migration are recorded in §7 and §8. Guards: `field.test.tsx`, `field-issues.test.ts`, `admin-form-conventions.test.ts`                                                                                                                                |
| F-08 | minor    | every not-found route                                                                                                                            | Answers **200** + `noindex` ("soft 404"): under Cache Components a dynamic route streams its static shell first      | **accepted** (Q-1 (a)): soft 404 + `noindex` is kept, and no public-content existence check goes into `proxy.ts` (architecture.md #3 stands)                                                                                                                                                                                        |
| F-09 | major    | sitemap, `/es`, `/ar`, `/ur`                                                                                                                     | The sitemap lists URLs for three **inactive** locales, and they serve 200 (`/es/about`)                              | **open**, Phase C (SEO / locales)                                                                                                                                                                                                                                                                                                   |
| F-10 | minor    | dashboard charts                                                                                                                                 | Recharts ticks take `fontSize: 11` as a number                                                                       | **accepted**: it is the `2xs` step; Recharts takes no class                                                                                                                                                                                                                                                                         |
| F-11 | minor    | play glyphs                                                                                                                                      | `VideoCard` used `size-6` in its play disc; the video player and video tile used `size-7`                            | **fixed**: `size-6` everywhere. Guard: `public-chrome.test.ts`                                                                                                                                                                                                                                                                      |
| F-12 | major    | public section intros on `bg-muted/40`, `/about` stat labels, section-heading badges, `/news` card meta, track glossary header, topic breadcrumb | `color-contrast`: muted or tonal text on a tinted surface falls under 4.5:1                                          | **open**, Phase C. Measure each pairing. Where it is the token, raise the DEFAULT `--muted-foreground` against tinted grounds (never the admin's colour), per ADR-072 §1; otherwise drop the tint behind body-size text                                                                                                             |
| F-13 | major    | hero captions (`text-primary-foreground/80`), lesson meta (`opacity-80`)                                                                         | `color-contrast`: text thinned by opacity                                                                            | **open**, Phase C. Use the full-strength foreground, or a token contracted for that surface; opacity is never a text colour                                                                                                                                                                                                         |
| F-14 | major    | homepage carousels                                                                                                                               | `target-size` ×12: the page dots are 6px tall (WCAG 2.5.8)                                                           | **open**, Phase C. Keep the 6px visual dot inside a 24px hit area (`after:` inset, as `Checkbox` does)                                                                                                                                                                                                                              |
| F-15 | major    | homepage carousels                                                                                                                               | `list` ×2: the carousel track breaks list semantics                                                                  | **open**, Phase C. Only `li` children in the list, or drop the list role                                                                                                                                                                                                                                                            |
| F-16 | blocker  | `/learn/crypto/crypto-foundations`                                                                                                               | `image-alt` (critical): an image with no `alt`, alongside a 404 for a missing resource                               | **open**, Phase C. Find the image, give it `alt` (or `alt=""` if decorative), and fix the missing file                                                                                                                                                                                                                              |
| F-17 | major    | news article body, dark mode                                                                                                                     | `link-in-text-block`: an in-body link is told apart from its text by colour alone                                    | **open**, Phase C. Underline links in article prose                                                                                                                                                                                                                                                                                 |
| F-18 | minor    | learn pages, guest                                                                                                                               | The progress island's fetch answers 401 for a guest and shows as a console error                                     | **open**, Phase C. Skip the fetch when there is no session, or answer an empty 200                                                                                                                                                                                                                                                  |
| F-19 | minor    | news article                                                                                                                                     | Two 26px buttons sit off the control scale (24/32/36/40)                                                             | **open**, Phase C                                                                                                                                                                                                                                                                                                                   |

**F-03's scope.** Its ink holds on the page grounds. It cannot hold on a
surface that inverts against the page, such as a `secondary` chip. No red
reaches 4.5:1 there, so that case is its own finding (F-27), not a gap in
F-03.

**Admin crawl findings (§4.3), all open for Phase C:**

| Id   | Severity | Where                                                               | Finding                                                                                                                                                                                                                                      | Proposed fix                                                                                              |
| ---- | -------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| F-20 | major    | every admin screen; settings / articles sub-navs; DataTable headers | `color-contrast`: the ⌘K `kbd` hint in the top-bar search trigger, the inactive sub-nav links, and the header cell text (muted ink on the `bg-muted/50` header fill)                                                                         | Contract each against its actual ground, via the theme DEFAULT, never the admin's colour (ADR-072 §1)     |
| F-21 | blocker  | `@repo/ui` `data-table.tsx` (every sortable table)                  | `aria-allowed-attr` (critical): `aria-sort` sits on the sort `<button>`, but is only allowed on a `columnheader`                                                                                                                             | Move `aria-sort` to the `<th>`; the button keeps its label                                                |
| F-22 | major    | the six content editors                                             | `color-contrast`: `EditorSection`'s `text-xs` description is muted ink on the `/8` tinted header band                                                                                                                                        | Give the description a token contracted against the band, or drop the tint behind it                      |
| F-23 | major    | article, course, lesson, video and glossary editors; media library  | Sideways overflow: 29–99px at 1024 (a header button and the editor's `sr-only` file input) and 16px at 360 (the same input; on the article editor also its tab triggers and locale links). The media library overflows 4px at 360 (its tabs) | Contain the `sr-only` input in a positioned parent; let the editor header actions and tabs wrap or scroll |
| F-24 | major    | lesson, video and glossary editors; design-system page              | `aria-progressbar-name`: a progress meter has no accessible name                                                                                                                                                                             | Name it from a catalog key                                                                                |
| F-25 | major    | article editor                                                      | `target-size` ×7: seven controls, found by Base UI id, are under 24px                                                                                                                                                                        | Identify them (by id at runtime), then give them a 24px hit area                                          |
| F-26 | major    | `/admin/learn/progress` at 360; design-system table                 | `scrollable-region-focusable`: a table that scrolls sideways cannot be reached by keyboard                                                                                                                                                   | `tabIndex={0}` plus a label on `DataTable`'s scroll container when it overflows                           |
| F-27 | major    | user and employee detail, the role chips                            | The "Remove" control (12px, `-interactive` red) sits inside a `secondary` badge, whose ground inverts against the page: 2.55:1 in light, 3.11:1 in dark. It is also a raw `<button>`, which the source census missed                         | Move Remove out of the chip, as an icon `Button` with an `aria-label` that names the role                 |
| F-28 | minor    | most admin routes, in dev                                           | The console logs Cache Components diagnostics ("runtime data accessed outside `<Suspense>`", "Could not validate `instant`"). They have no visible effect, since the admin is `force-dynamic`                                                | Check against the installed Next docs whether they flag real prerender cost                               |

## 7. Decisions made in this pass (reversible unless an ADR says otherwise)

- **D-1**: The public desktop nav shows from `xl` (1280), not `lg` (1024).
  The nav's own width sets the breakpoint: at 1280 the header fits with no
  overflow. Between 1024 and 1279 the hamburger sheet serves, as it already
  does on tablets.
- **D-2**: Below `sm` the theme toggle lives in the mobile sheet. It is the
  only header control that can move without dropping a learner entry point
  (ADR-052) or shrinking type, which ADR-072 §7 forbids.
- **D-3 (Q-1)**: Not-found routes stay a soft 404 with `noindex`.
  `proxy.ts` gains no existence check. No ADR, because nothing deviates from
  the plan.
- **D-4 (Q-3): ADR-077.** The owner's answer, as built:
  - `Field` became context-aware, and every `@repo/ui` control wires itself
    into it.
  - Inline messages come from the server action's own `@repo/contracts`
    schema, through `validateFields` and `useFieldErrors`, as catalog codes
    (`admin.validation.*`).
  - Required fields get an asterisk; optional fields get no marker.
  - Save stays enabled and names the invalid fields.
  - The toast is only for server and submission failures.
  - The unused react-hook-form bridge was not adopted: it would have rewritten
    every form's state.
- **D-5**: `editor-section.tsx`'s own `Field`, used by eleven editors, became
  a thin wrapper over `@repo/ui`'s Field with `required` and `error` props.
  The editors keep one-line call sites. The composite controls
  (`SlugField`, `ScheduleField`, `ImageUploadField`, `RichTextEditor`) are
  Field-aware in the same way.
- **D-6**: The publishing panel takes the editor's `validate`. A
  save-then-transition runs it and stops with the fields named. The six
  editors no longer throw a "fields need attention" error from `save`,
  which would have shown twice. The quiz editor keeps one gate no schema
  holds: a quiz with no questions cannot be published.
- **D-7**: The icon-only delete buttons also take
  `text-destructive-interactive`. An icon only needs 3:1, so raw red was
  legal there, but one ink everywhere keeps the guard exception-free.
- **D-8**: No "(optional)" survives in the admin catalog:
  - `admin.seoOptional` now reads "SEO";
  - the quiz option's "Why (optional)" is now "Why";
  - `admin.slugOptional` is reworded.
  - The course curriculum had been borrowing "SEO (optional)" as its
    optional-lesson badge; it now has its own `optionalLessonBadge`.

## 8. Questions for the owner (answered 2026-09-12)

- **Q-1 (F-08), real 404 status → (a).** Keep soft 404 + `noindex`; do not
  add public-content existence checks to `proxy.ts`.
- **Q-3 (F-07), form errors → (a).**
  - All admin forms: `Field`, `FieldLabel`, `FieldError`, `aria-invalid`,
    `aria-describedby`, required attributes, inline validation messages.
  - Required fields use `*`; do not add "(optional)" to every non-required
    field.
  - Keep the toast for global, server and submission errors, but never as
    the only sign of a field validation error.
  - Built as ADR-077 (D-4).
