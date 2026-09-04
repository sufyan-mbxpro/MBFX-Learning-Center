# ADR-007: English-only launch locale, and the RTL fallback rule generalized to every RTL locale

**Status:** Accepted
**Date:** 2026-09-01
**Module:** 06 (`@repo/i18n`) — claude.md's Module 06 row reserves ADR-007
for "English launch locale," written when routing lands.
**Supersedes:** —
**Superseded by:** —

## Context

Two real decisions landed together when Module 06's routing went in, both
about the same seeded four-locale set (`en`, `es`, `ar`, `ur`):

1. **Which locales are active at launch.** The architecture doc's own
   roadmap (§ Prioritization, point 3) already argues for this: "Building
   the i18n plumbing now is cheap. Translating 200 glossary terms and 60
   lessons is not. Ship English-only with the machinery in place, and add
   locales when there is a market reason." Module 06 is exactly "the
   machinery" — routing, catalogs, fallback resolution, RTL layout
   support — landing before any of es/ar/ur has real content or interface
   coverage.

2. **The RTL-fallback rule's actual scope.** SKILL.md names one case by
   example: "ar falls back to a 'not yet translated' notice, NOT to LTR
   English inside an RTL layout." `packages/db/prisma/seed.ts` seeds two
   RTL locales, `ar` and `ur` — the reasoning ("English content in an RTL
   layout reads worse than a notice") is not specific to Arabic, it's a
   property of the LTR/RTL pairing. Applying it to `ar` alone and leaving
   `ur`'s `fallbackCode` at `"en"` would silently produce the exact broken
   experience the rule exists to prevent, just for a different language.

## Decision

**Launch:** only `en` is seeded `isActive: true` (`isDefault: true`). `es`,
`ar`, `ur` are seeded `isActive: false` — present in `routing.locales`
(the static list next-intl's middleware and `generateStaticParams` need,
per `packages/i18n/src/routing.ts`) and fully routable/buildable, but not
surfaced in any locale switcher once one exists (Module 08), since that
reads `getActiveLocales()` (`packages/i18n/src/locales.ts`), not the
static list. Turning on `es` (or any locale) later is an `isActive: true`
flip, not new code — the machinery point stands.

**Fallback scope:** `packages/db/prisma/seed.ts` sets `fallbackCode: null`
for **both** `ar` and `ur` (RTL), and `fallbackCode: "en"` for `es` (LTR).
`packages/i18n/src/fallback.ts`'s `resolveFallbackChain` has no branch on
locale code at all — it just reads whatever `fallbackCode` a locale is
configured with, per SKILL.md's own framing ("per-locale config, not a
special case in code"). The rule generalizes to "RTL locales get no
fallbackCode" as a seeding convention, not a code path.

## Consequences

- A learner whose browser prefers `es`/`ar`/`ur` today still gets routed to
  those locale-prefixed URLs correctly (next-intl doesn't know about
  `isActive`), but sees interface strings mostly falling back to English
  (`request.ts`'s `getMessageFallback`) since only `common`/`notTranslated`
  keys are translated for `ar`/`ur` right now (`es` is fully translated as
  a working example of what "active" should look like) — acceptable
  pre-launch; not a regression once locale switcher UI (Module 08) only
  ever links to active locales.
- Content translation rows (`CourseTranslation` etc., Module 11) for
  `ar`/`ur` will never silently show English — `pickTranslation` stops the
  chain at the requested locale per this ADR, always. `es` content missing
  a translation correctly falls back to English content instead of a
  blank/notice.
- Adding a fifth locale later: seed it `isActive: false`, decide its
  `fallbackCode` using the same LTR→`en`/RTL→`null` convention this ADR
  sets, add its code to `routing.locales` and a message catalog, rebuild.
  No change to `fallback.ts` or `routing.ts`'s logic.

## Alternatives considered

- **`ar`-only fallback exception, `ur` keeps `fallbackCode: "en"`.**
  Rejected: reproduces the exact bug SKILL.md's example warns about, just
  for Urdu instead of Arabic — the reasoning given is about the
  LTR/RTL pairing, not the specific language.
- **Launch with `es` also active.** Rejected per the architecture doc's
  own roadmap argument: the interface catalog is translatable today, but
  there is no Spanish-market content yet, and turning on a locale with an
  empty content library is a worse experience than not offering it.

## Compliance

- Reviewed whenever a new locale is added to `routing.locales` or a
  locale's `isActive`/`fallbackCode` is changed in the seed: confirm the
  RTL/LTR fallback convention this ADR sets is followed, not re-litigated
  per locale.
