# ADR-091 — Only an active locale is served

- **Status:** Accepted
- **Date:** 2026-09-14
- **Module:** 06 (`@repo/i18n`), 12 (public site), 14 (hardening)
- **Supersedes:** nothing. **Amends:** the build-time half of ADR-043 #3, and
  the paragraph `code-style.md` #2 added about `next build` prerendering every
  seeded locale.

## Context

ADR-007 seeds four locales and activates one. `seed.ts` writes `es`, `ar` and
`ur` as `isActive: false`, and `getActiveLocales()` — the DB read the locale
switcher and content fallback both use — returns `en` alone.

`routing.locales`, by contrast, is the STATIC superset next-intl needs in order
to recognise a prefix at all, and it lists all four. Two places read it as
though it were the list of locales the site SERVES:

- `app/(public)/[locale]/layout.tsx`'s `generateStaticParams` returned all four,
  so `next build` prerendered every page three extra times.
- `app/sitemap.ts` emitted `/es`, `/ar` and `/ur` URLs for every static path.

Neither locale has a catalog. `es.json`, `ar.json` and `ur.json` are each
missing **573 public keys** — including `about.*` (230), `learn.*` (197) and
`economicCalendar.*` (50) in their entirety, three namespaces that have been
absent since the modules that introduced them shipped.

`check:catalog-completeness` is designed around exactly this: a gap in an
INACTIVE locale warns, a gap in an ACTIVE one fails, and activating a locale
means adding it to `ENFORCED_LOCALES` in the same PR so CI refuses the
activation until its catalog is complete. That design says, in as many words,
that an inactive locale is allowed to be incomplete.

The build disagreed with it. next-intl throws `MISSING_MESSAGE` on a missing
key, so prerendering an inactive locale turned every one of those 573 gaps into
a hard build error — and enough of them, thrown across three locales and every
static path, to exhaust the build worker's heap. `pnpm build` has been failing
with `FATAL ERROR: Zone Allocation failed - process out of memory` downstream of
the first `MISSING_MESSAGE`, and the catalog check has been printing three
green-lit warnings the whole time.

So the two statements were never reconciled: **the check treats an inactive
locale as not-yet-owed, and the build treated it as shipping.**

## Decision

**A locale is served when it is active, and not before.** One rule, applied at
all three points that used to read the static superset:

1. **`generateStaticParams` returns the ACTIVE locales**, intersected with
   `routing.locales` — a DB row for a code next-intl cannot route is not
   routable, whatever the column says — and falls back to `defaultLocale` if
   that intersection is empty, because a site that prerenders nothing is worse
   than one that prerenders its default.
2. **The public root layout 404s an inactive locale prefix.** This is the
   boundary, not `generateStaticParams`: dropping a locale from the prerender
   list alone would only move the `MISSING_MESSAGE` from build time to the
   first request for `/es`, which is the same defect served later.
3. **`sitemap.ts` enumerates active locales.** Advertising a URL that 404s is a
   crawl hint pointing at an error page — the reasoning ADR-086 #5 already
   applied to a disabled tool, applied to a locale.

`routing.locales` **stays all four** and keeps its job unchanged. It is what
lets next-intl recognise `/es` as a locale prefix rather than a content slug,
which is precisely what makes a clean 404 possible instead of `/es/about`
falling through `[...slug]` and being looked up as a page. The static/dynamic
split `routing.ts` documents is not being collapsed; it is being read
correctly for the first time.

## Consequences

**`pnpm build` prerenders `en` only, and passes.** The 573×3 gap stops being a
build error because it stops being a claim the build makes.

**Activation is now one switch with one gate in front of it.** Flip
`Locale.isActive`, add the code to `ENFORCED_LOCALES`, and CI refuses the PR
until the catalog is complete. Before this, activation was the second half of a
job whose first half — filling the catalog — the build had already been
demanding, and failing over, for months.

**Multilingual is untouched.** ADR-043 #1 stands in full: the public site is
built to be translated, every string goes through a catalog key, `[locale]`
routing, `dir=rtl` and hreflang are all exactly as they were. What changes is
that a locale nobody has translated is no longer _published_ half-English. This
ADR removes no machinery and no locale; `es` goes live the day `es.json` is
complete, and the work to complete it is now scoped work rather than a
build-breaking backlog.

**`generateStaticParams` now reads the database.** This adds no requirement the
build did not already have — the public layout renders theme, settings,
navigation and brand assets from the DB on every prerendered page, so a build
without a reachable database has never been possible. It does mean the locale
list is resolved at build time: activating a locale still needs a rebuild to be
prerendered, which is the same trade-off `routing.ts` has documented since
Module 06, now applying to one more consumer.

**The sitemap shrinks by three quarters of its static rows.** That is the point.

## Alternatives considered

**Fill all 1,719 strings.** Three languages, two of them RTL, no native
reviewer in the loop, landed as one unreviewed dump to make a build pass. It
would publish `/es` and `/ar` as though they were real translations, which is a
worse outcome than 404 — and it treats the symptom, since the next public key
added to `en` alone breaks the build again the same way.

**Keep prerendering four and silence next-intl's missing-key error.** A missing
key would then render its own path as visible English-ish text on a page
claiming `lang="es"`. This trades a loud build failure for a quiet content
defect, and it would have hidden the three absent namespaces indefinitely.

**A static `ACTIVE_LOCALES` array next to `routing.locales`.** Avoids the
build-time DB read, at the cost of a third hand-synced list that can disagree
with `Locale.isActive` — the drift `locales.ts` was written to eliminate.
Rejected for the same reason the DB is the source of truth for activation in
the first place.
