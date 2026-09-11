# Rules — Code Style

Prettier formats; ESLint enforces. What's listed here is the intent behind
the mechanical rules, so edge cases get judged correctly.

## Theming & text

1. **No color literals outside `@repo/theme`'s token definitions.** Components
   consume semantic tokens (`bg-background`, `text-foreground`, `bg-primary`)
   only. A hex literal in `packages/ui` or `apps/web` fails lint
   (`no-restricted-syntax` in `tooling/eslint-config`). `@repo/theme` locally
   disables the rule — it is where the defaults live.
2. **No hardcoded user-facing strings.** Interface text comes from `@repo/i18n`
   message catalogs (type-safe keys); admin-editable text comes from settings
   or translation tables. Scaffold placeholders are tolerated only until the
   module that owns the surface lands.

   **Translation scope is not the same rule (ADR-043).** Every string goes
   through a catalog key — that part is universal. Whether a non-English
   _value_ is required depends on the surface: **public** namespaces (`common`,
   `home`, `error`, `notFound`, `notTranslated`, `public`, `nav`, `footer`,
   `glossary`, `news`, `auth`) must be complete for every ACTIVE locale, and
   `check:catalog-completeness` fails the build if one isn't. **Admin**
   namespaces (`admin`, `cms`) are English-only by design and are exempt — add
   the key to `en.json` and stop. A new namespace defaults to _public_, so
   getting this wrong errs toward more translation, not less.

3. **Logical properties only:** `ps-`/`pe-`/`ms-`/`me-`/`text-start`/
   `text-end`. Physical `pl-`/`pr-`/`ml-`/`mr-` utilities fail lint
   (react-internal config). RTL is built in from day one, not retrofitted.
4. Hover/active/interactive color variants are **derived by the engine**,
   never hand-authored (ADR-003). Don't add `--primary-hover` overrides.

## Admin display conventions (ADR-044, extended by ADR-057)

Binding on every admin screen, including ones not written yet. The
cancelled surfaces (ADR-042) are out of scope and are not brought up to
these.

5. **A raw identifier never renders.** Role keys, permission keys, setting
   keys, flag keys, enum members, theme token ids and section keys reach
   the screen through a catalog string, a stored human name, or
   `humanizeKey()` (`@repo/utils`) — in that order of preference.
   `super_admin` reads "Super Admin". This is display-only: the identifier
   is untouched everywhere it is actually used, so `requirePermission()`
   and the Module 03 key cross-check are unaffected.
6. **One typeface.** The admin renders in the brand sans (Inter since
   ADR-072, which superseded ADR-039's Outfit).
   **`<code>` is not used for admin chrome** — it inherits a monospace
   family from Tailwind's preflight, which is exactly the bug rule 5 was
   fixing. A muted `<span>` carries the same meaning. The narrow exception
   is a form control whose VALUE is code read character by character (JSON
   textarea, hex field, role-key field, generated password): those keep
   `font-mono`.
7. **Destroying something asks first.** Delete / remove / clear / detach
   goes through `ConfirmDialog`, including when it only stages a change
   the section's Save will persist. **Restore is not confirmed** — it is
   the undo, and gating it makes the destructive path harder to reverse.
   A confirmation is UX; `requirePermission()` is still the boundary
   (security.md #1).
8. **Heading, description, and Save where they belong.** Every screen
   renders a catalog title AND a one-line description. On a screen with a
   settings sub-nav the heading goes INSIDE the content column
   (`SettingsScreen`), not above both columns. Save / Submit / Update /
   Apply sit at the inline END of their form or section.
9. **Table filters live in the table's toolbar.** Pass them to
   `DataTable`'s `filters` prop so search and filters share one row; do
   not stack a separate filter bar above the table.

10. **Every admin dropdown is the same component, and it searches.**
    Admin screens import `AdminCombobox`
    (`app/(admin)/admin/_components/combobox.tsx`), never
    `@repo/ui/components/select` — lint-enforced under `app/(admin)/**`.
    It renders a search input at or above `SEARCHABLE_ITEM_THRESHOLD` (8)
    options and a plain Select below it, because Base UI's own guidance is
    that a dropdown with no input keeps better listbox semantics as a
    Select. So a short fixed enum landing on the Select branch is the rule
    working, not an exception to it; `searchable` overrides in either
    direction when a call site knows better.

    **Width says what a dropdown is.** The trigger is `w-full` by default,
    like every other form control. A table-toolbar filter passes an explicit
    `className="w-40"` — an explicit width is how a toolbar filter declares
    itself, and its absence means "this is a form field". Popups are
    `min-w-(--anchor-width)`, never a fixed `w-`, so a long option label
    widens the popup instead of being truncated inside it (ADR-057).

11. **A modal has a header, not just a title.** Every `DialogContent`
    renders a `DialogHeader` with a `DialogTitle` AND a
    `DialogDescription` — one line on what the modal does, from a catalog
    key, never a field label pressed into service. This is rule #8 one level
    down: a modal is a screen opening over another one, and it needs the
    description more, not less. `ConfirmDialog` already takes both as
    required props. The only exemption is a header deliberately `sr-only`
    because the surface is its own label (the ⌘K palette), and it still
    renders both elements. Guarded by
    `apps/web/app/admin-dialog-conventions.test.ts` (ADR-057 #5).

## TypeScript

12. Strict mode everywhere; `noUncheckedIndexedAccess` stays on. No `any`
    without an eslint-disable and a reason on the same line.
13. `import type` for types (`consistent-type-imports` is lint-enforced).
14. Zod v4 in contracts — don't copy v3 snippets (error API differs).
15. TypeScript is pinned at 6.0.3 (ADR-010). Do not bump, do not add TS 7.

## Structure & naming

16. Files: kebab-case (`data-table.tsx`); exported symbols: PascalCase
    components, camelCase functions. Named exports — default exports only
    where a framework convention requires them (Next.js pages/layouts/config).
17. Follow official Next.js file conventions (`page`/`layout`/`loading`/
    `error`/`not-found`/`route`, `_private` folders for non-routed
    colocation, route groups). Don't invent parallel conventions.
18. Comments explain _why_, not _what_. Every TODO names its module:
    `// TODO(Module 06): …`.
19. Package exports stay granular where weight matters (`@repo/ui`) — see
    architecture.md #9.

## Client/server boundary (ADR-064)

20. **An inline `<script>` never goes in the React tree — server component
    included.** React creates it on the client render path and it never
    executes; React 19.2 warns and substitutes a `<div>`, so the script
    silently does nothing on exactly the render where it was needed. Moving
    it to a server component does NOT fix this: the element survives in the
    RSC payload and Next's client prerender/recovery passes create it from
    there. Inject it with **`useServerInsertedHTML`**, whose callback runs
    only on the server, and return `null`;
    `@repo/ui/components/theme-script` is the worked example and
    `theme-provider.test.tsx` is the guard. `next/script`
    `strategy="beforeInteractive"` is not a substitute for an inline script —
    it renders its own `<script>` and defers execution past first paint.
    Give the injected script the request's `x-nonce` on the dynamic admin
    surfaces, the way `#brand-tokens` already does (security.md #14).
