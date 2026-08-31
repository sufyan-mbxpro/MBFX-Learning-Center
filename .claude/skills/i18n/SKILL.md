# SKILL — Module 06: @repo/i18n

plan.md Module 06 + architecture doc §4. next-intl v4; ADR-007 (English
launch locale) written here when routing lands.

## Two problems, two solutions

- **Interface strings:** file-based catalogs in
  `packages/i18n/messages/{locale}.json`, type-safe keys generated from the
  English catalog (missing key = TS error).
- **Content:** DB translation tables (Module 01 schema) with per-locale
  slugs and `translationStatus` lifecycle.

## Routing (single app, ADR-006)

`defineRouting` with `localePrefix: "as-needed"` (default locale unprefixed).
Wired through `apps/web/proxy.ts` — the matcher must NEVER locale-prefix
`/admin` or `/api`. Public routes live at `app/(public)/[locale]/`. Active
locale list is DB-seeded: enabling a locale is instant but dynamic until the
next build (named trade-off, keep it documented).

## Fallback chain (frozen)

requested locale → per-locale `fallbackCode` → default. **Arabic rule:** ar
falls back to a "not yet translated" notice, NOT to LTR English inside an RTL
layout — per-locale config, not a special case in code.

## Content lifecycle

`sourceHash` computed on source save; dependent translations flip OUTDATED on
source change; admin gets a queue. Message key convention:
`domain.component.purpose` (e.g. `theme.primary.label`).

## Required tests

Routing units (default unprefixed, `/ar/...` prefixed, unknown → 404, /admin
untouched); fallback resolution table incl. ar-no-fallback; sourceHash
lifecycle (edit EN → ES flips OUTDATED → retranslate → TRANSLATED); catalog
completeness (non-default missing keys = CI warning; default missing a used
key = CI error); RTL smoke suite (Part C) wired here. 80% floor.
