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
   `glossary`, `news`, `auth`, `newsletter`) must be complete for every ACTIVE
   locale, and `check:catalog-completeness` fails the build if one isn't.
   **Admin** namespaces (`admin`, `cms`) are English-only by design and are
   exempt — add the key to `en.json` and stop. A new namespace defaults to
   _public_, so getting this wrong errs toward more translation, not less.

   **Filling `en` alone is now correct, and the build agrees (ADR-091).**
   `next build` used to PRERENDER every SEEDED locale, active or not, so a key
   missing from an INACTIVE locale was a hard `MISSING_MESSAGE` at build time
   while the check only warned — which is how eight `nav.mega.*` keys from
   ADR-076 sat broken until changes-21 F9, and how `about.*`, `learn.*` and
   `economicCalendar.*` went missing from es/ar/ur entirely. ADR-091 resolved
   the mismatch the way this paragraph used to anticipate: **only an ACTIVE
   locale is prerendered, served or listed in the sitemap**, so an inactive
   locale's catalog is genuinely not owed yet. Add the key to `en.json` and
   stop; `ENFORCED_LOCALES` is what makes it owed, on the PR that activates
   the locale.

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

### Permission groups (ADR-083)

11b. **A permission belongs to the SCREEN it governs, and the card order is
code.** `Permission.groupName` is page-shaped: `learning` (courses,
lessons, and so quizzes and videos, which share the lesson keys),
`glossary`, `media`, `articles`, `website`, `users`, `employees`,
`newsletter`, `market`, `tools`, `translations`, `seo`, `email`, `settings`,
`system`. `tools` is the fourteenth, added by ADR-086 #6 and the first use of
this rule's own escape hatch — `/admin/tools` is its own screen, so its keys
are its own. Instruments got none: `market.*` has been seeded since Module 01.
A new key names one of those; adding a group means adding it to
`PERMISSION_GROUPS` in `@repo/db`'s `permission-groups.ts`, whose ARRAY
ORDER is the order the role editor draws the cards in — it mirrors the
admin sidebar, not the alphabet. The registry holds no strings: the
screen resolves `admin.permissionGroups.<name>` through `t.has` with a
`humanizeKey()` fallback (ADR-044 #5's two-step), and never re-cases the
result — the `capitalize` class is what made `seo` render as "Seo".
Guarded by `packages/db/src/permission-groups.test.ts`, which fails in
both directions: a seeded group the registry does not list, and a listed
group with no keys.

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

## Design system (changes-20, ADR-072)

21. **No arbitrary Tailwind values** (ADR-072 §10). A class whose bracket
    closes it — `w-[150px]`, `lg:grid-cols-[1fr_20rem]` — fails lint
    (`noArbitraryValueRule`, react-internal config). In order of preference:
    the scale (`w-37.5`, `h-180`, `aspect-4/3`, `opacity-15`, `z-2`), a
    design-system step (`text-3xs`, `tracking-caps`), or a **named token** in
    the "Layout tokens" block of `@repo/ui` `globals.css`, read as a reference
    (`lg:grid-cols-(--grid-main-aside)`). A new value is added there once, not
    inlined. Still allowed: arbitrary **variants** (`data-[side=top]:`,
    `has-[>img:first-child]:`), `(--token)` references, and custom-property
    definitions (`[--card-spacing:--spacing(6)]`). Tests are exempt (a guard
    names the class it forbids), and so are the retained Website Builder and
    homepage composer (ADR-042/038).
22. **lucide-react is the only icon library.** Any other icon package fails
    lint (`noOtherIconLibraries`, base config). Brand marks go through
    `SocialGlyph` (ADR-045).
23. **A responsive grid states its one-column base.** Write
    `grid grid-cols-1 lg:grid-cols-2`, never `grid lg:grid-cols-2`. Below the
    breakpoint the bare form is one implicit `auto` track, which sizes to its
    items' min-content, and Chrome reports a line-clamped excerpt's min-content
    as its unwrapped width, so the page scrolls sideways on a phone.
    `grid-cols-1` is `minmax(0, 1fr)` and cannot outgrow its container.
    Guarded by `apps/web/app/grid-base.test.ts`.

## Forms (ADR-077)

24. **An admin form field is a `Field`, and it validates inline.**
    - **Markup.** Every visibly labelled control sits in
      `@repo/ui/components/field`'s `Field` with a `FieldLabel` and a
      `FieldError`. Admin screens never import `Label`, render a raw
      `<label>`, or write `htmlFor`/`aria-describedby` by hand: the Field
      wires them. The editors' `editor-section` `Field` and the composite
      controls take `required`/`error` props instead.
    - **Required.** `<Field required>` draws an asterisk. Optional fields get
      no marker, never "(optional)".
    - **Messages.** They come from `useFieldErrors` running the server
      action's own `@repo/contracts` schema, rendered from
      `admin.validation.*`.
    - **Save.** It is not disabled for validation: pressing it names the
      invalid fields and focuses the first.
    - **Toast.** Only for server or submission failures.
    - **Ink.** Destructive TEXT is `text-destructive-interactive` everywhere,
      both surfaces; raw red fails 4.5:1 on the dark ground. Icons may keep
      `text-destructive`.
    - **Guard.** `apps/web/app/admin-form-conventions.test.ts`.

25. **A switch sits on a row, and the switch leads it (ADR-089).** A `Switch`
    is always in a `Field orientation="horizontal"`, never a vertical one, and
    it is the FIRST child — the label (or a `FieldContent` holding label plus
    hint) comes after it. A vertical Field puts a control under its label,
    which is the shape of a field being filled in; a switch is a state being
    flipped and reads on one line with the words it governs. It also carries
    `*:w-full`, which is right for an Input and wrong for the one control
    whose 44×24 geometry IS its meaning (ADR-074) — that stretched the tool
    editor's toggle into a 288px bar. `fieldVariants` now exempts
    `[data-slot=switch]` as well, so the rule does not rest on memory. A
    switch with no label in its row (a table cell's, named by its column
    header) is out of scope. Same guard as #24.

## Metadata (ADR-090)

26. **A route never returns `robots: undefined`.** Where the directive is
    conditional, write a conditional SPREAD —
    `...(cond ? { robots: { index: false } } : {})` — so the key is absent
    when it does not apply. This is not style: Next's `mergeMetadata`
    iterates the child's keys by **presence**, and `resolveRobots(undefined)`
    is `null`, so a present-but-undefined `robots` ERASES the root layout's
    site-wide directive rather than inheriting it. The same reasoning applies
    to any metadata field a layout sets and a page conditionally overrides.
    Guarded by `apps/web/app/seo-metadata.test.ts`.

27. **The site's origin has one owner.** `siteUrl()`
    (`apps/web/app/_lib/site-url.ts`) is the only place
    `process.env.BETTER_AUTH_URL` and its localhost fallback are spelled out
    — the sitemap, robots, the RSS feed and the public root layout's
    `metadataBase` all read it. Same guard.

28. **A setting that is read by nothing does not ship.** A seeded, typed,
    admin-editable row whose value reaches no code is worse than a missing
    feature: the admin saves it, sees success, and believes something
    changed. Either wire it or leave it out of the seed. This is what put
    `seo.robotsIndex` and `seo.googleSiteVerification` in the admin for two
    modules without effect (ADR-090).
