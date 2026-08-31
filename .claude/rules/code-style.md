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
3. **Logical properties only:** `ps-`/`pe-`/`ms-`/`me-`/`text-start`/
   `text-end`. Physical `pl-`/`pr-`/`ml-`/`mr-` utilities fail lint
   (react-internal config). RTL is built in from day one, not retrofitted.
4. Hover/active/interactive color variants are **derived by the engine**,
   never hand-authored (ADR-003). Don't add `--primary-hover` overrides.

## TypeScript

5. Strict mode everywhere; `noUncheckedIndexedAccess` stays on. No `any`
   without an eslint-disable and a reason on the same line.
6. `import type` for types (`consistent-type-imports` is lint-enforced).
7. Zod v4 in contracts — don't copy v3 snippets (error API differs).
8. TypeScript is pinned at 6.0.3 (ADR-010). Do not bump, do not add TS 7.

## Structure & naming

9. Files: kebab-case (`data-table.tsx`); exported symbols: PascalCase
   components, camelCase functions. Named exports — default exports only
   where a framework convention requires them (Next.js pages/layouts/config).
10. Follow official Next.js file conventions (`page`/`layout`/`loading`/
    `error`/`not-found`/`route`, `_private` folders for non-routed
    colocation, route groups). Don't invent parallel conventions.
11. Comments explain _why_, not _what_. Every TODO names its module:
    `// TODO(Module 06): …`.
12. Package exports stay granular where weight matters (`@repo/ui`) — see
    architecture.md #9.
