# ADR-005: Curated font registry — keys in `@repo/theme`, files in `@repo/ui`

**Status:** Accepted
**Date:** 2026-09-01
**Module:** 02 (`@repo/theme`)
**Supersedes:** —
**Superseded by:** —

## Context

plan.md A7 flags arbitrary font URLs as "a security + performance hole" and
mandates "a curated font allowlist — 8–12 self-hosted families via
`next/font/local` in `packages/ui`, admin picks from the list; engine maps
the pick to the preloaded family." The reference `theme-engine.ts` predates
this requirement: `LayoutTokens.fontSans`/`fontMono` are raw CSS
font-stack strings (`"-apple-system, BlinkMacSystemFont, ..."`), with no
registry, no validation, and no connection to any font-loading mechanism.

`@repo/ui` (Module 07) doesn't exist yet — the actual `next/font/local`
declarations that would preload real font files aren't buildable now. This
mirrors the ADR-001/Module 01 and interim-`auth()`/Module 03 pattern
already used twice this session: define the contract a later module commits
to filling in, so the current module isn't blocked on one that hasn't
started.

## Decision

- `@repo/theme` owns the **registry** — a fixed list of curated font keys
  with metadata (label, category), exported as `CURATED_FONTS`. No file
  paths, no URLs, no `next/font/local` — that's `@repo/ui`'s job.
- `LayoutTokens.fontSans` / `fontMono` change type from a raw CSS
  font-stack string to a **curated font key** (`CuratedFontKey`, a string
  union derived from `CURATED_FONTS`). `DEFAULT_LAYOUT` uses `"system"` —
  a special key with no associated file, resolving to the native
  system-font stack directly (no download, always available, matches the
  reference defaults' original intent).
- The engine emits a CSS **custom-property reference**, not a literal
  font-family string: `--brand-font-sans: var(--font-{key})` (`"system"`
  is the one exception — see below). This is the same indirection
  `docs/reference/globals.css` already uses for every other design token
  (`--color-primary: rgb(var(--primary))`); `@repo/ui` defines what
  `--font-{key}` actually resolves to via `next/font/local`'s generated CSS
  variable, once it exists. Until then, the variable is simply undefined in
  any real stylesheet — `@repo/theme` has no browser to render into yet, so
  this is inert but correct.
- `"system"` is special-cased: the engine emits the literal system-font
  stack for it directly (`-apple-system, BlinkMacSystemFont, "Segoe UI",
Roboto, "Helvetica Neue", Arial, sans-serif` for sans; a monospace
  equivalent for mono), not a `var()` reference — there is no file to
  preload, so there's nothing for `@repo/ui` to define a variable for.
- `validateTheme`/token-application code rejects a `fontSans`/`fontMono`
  value that isn't a `CuratedFontKey` — the admin can only ever pick from
  the list, closing the "arbitrary Google-Fonts-by-URL" hole plan.md A7
  names explicitly.
- Registry size: 7 sans (`system` + 6 self-hosted) + 4 mono = 11 keys,
  inside plan.md's 8–12 guidance.

## Consequences

- `@repo/ui` (Module 07) has an implicit contract when it lands: for every
  non-`"system"` key in `CURATED_FONTS`, declare a `next/font/local` family
  whose generated CSS variable is named `--font-{key}`. A key in the
  registry with no matching `next/font/local` declaration is a real bug at
  that point, not before — nothing enforces the pairing until Module 07
  exists to be checked against.
- Changing the registry (adding/removing a curated font) is a
  `@repo/theme` change with no separate migration story yet — an admin's
  saved `fontSans`/`fontMono` key referencing a removed font would need
  handling (fallback to `"system"`) whenever the admin theme editor
  (Module 09) ships. Noted here, not solved here.

## Alternatives considered

- **Keep raw CSS font-stack strings, validate against an allowlist of
  stack strings instead of keys.** Rejected: a stack string is harder to
  present as a picker UI (Module 09's "admin picks from the list") than a
  short key, and doesn't compose with `next/font/local`'s
  variable-per-family model as directly.
- **Wait for Module 07 before touching `LayoutTokens.fontSans`/`fontMono`
  at all.** Rejected: identical reasoning to ADR-001 and the interim
  `auth()` stub — the type-level contract can be authored and tested now;
  only the actual font files are Module 07's work.

## Compliance

- `CuratedFontKey` is a string union (not `string`), so an invalid key is a
  TypeScript error at any call site, not just a runtime validation failure.
- Module 07's SKILL.md (when written/updated) should reference this ADR for
  the `--font-{key}` naming contract.
