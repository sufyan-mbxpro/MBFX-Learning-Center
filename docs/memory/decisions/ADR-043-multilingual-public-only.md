# ADR-043: Multilingual is a public-surface guarantee; the admin portal is English-only

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 06 (`@repo/i18n`), with consequences for every module that ships an
admin screen
**Supersedes:** — (narrows the practical scope of code-style.md #2 and adds an
enforcement split to `check:catalog-completeness`; does not change ADR-007)
**Superseded by:** —

## Context

After ADR-042 cancelled the dynamic site-control programme, the owner
reaffirmed that multilingual support is not part of what was cancelled, then
scoped it precisely (2026-09-07):

> "the public site will be multi-lingual only... right now we'll activate the
> english only... but system should support multi lingual"

Three separate statements, and they had been running together:

1. **Multilingual is a property of the _public_ surface.** The admin portal is
   an internal staff tool; nobody asked for it in four languages.
2. **Only English is active right now.** This is ADR-007's locked launch-locale
   decision, already implemented — `seed.ts` creates `en` with
   `isActive: true, isDefault: true` and `es`/`ar`/`ur` with `isActive: false`.
   Nothing to change; recorded here so the three statements stop being
   conflated.
3. **The machinery must exist regardless.** Activating a locale must be a data
   change plus a catalog, never a re-architecture.

Until now the repo drew no line between (1) and the admin surface.
`code-style.md` #2 says "no hardcoded user-facing strings — interface text
comes from `@repo/i18n` message catalogs," which is right and unchanged, but it
was being read as "therefore every key must be translated into every locale."
That read produced a large, permanent, unpaid debt:
`check:catalog-completeness` warns that `ar` is ~370 keys behind `en` and `ur`
~340 — and essentially all of it is `admin.*` and `cms.*`. It also produced a
false requirement in `docs/changes/changes-07-plan.md`, which committed ~55 new
**admin** keys to all four catalogs.

## Decision

### 1. The public surface is multilingual, fully

Everything under `apps/web/app/(public)/**` is translated for every **active**
locale: no exceptions, no English fallback shipped as if it were a translation.
This covers UI strings (catalogs), content (`*Translation` tables), routing
(`[locale]`, `localePrefix: "as-needed"`), direction (`dir=rtl` for `ar`/`ur`,
logical properties only), and discoverability (`alternates.languages`
hreflang on every public route that has per-locale variants).

The public catalog namespaces are: `common`, `home`, `error`, `notFound`,
`notTranslated`, `public`, `nav`, `footer`, `glossary`, `news`, `auth`.

### 2. The admin surface is English-only, by design

The admin catalog namespaces — `admin` and `cms` — need a value in `en.json`
only. This is a deliberate scope decision, not a backlog:

- **The mechanism is unchanged.** Admin strings still go through
  `getTranslations("admin")` with type-safe keys sourced from `en.json`.
  code-style.md #2's actual rule — no hardcoded literals in components — is
  untouched. What changes is only whether a non-English _value_ is required.
- **This is reversible at any time** by translating the namespace and adding
  the locale to the enforcement list in #4. Nothing about the code has to
  change to make the admin multilingual later; only catalog content.
- **`cms.*` is doubly moot** — it belongs to the feature ADR-042 cancelled.
  Translating it would be paying for a surface no one can reach.

### 3. Locale activation stays ADR-007's decision

`en` is the only active locale. `es`/`ar`/`ur` are seeded, routable, and
`isActive: false`. This ADR does not activate anything and does not change
ADR-007. It defines what activating a locale _obliges_ (#4).

### 4. Enforcement: `check:catalog-completeness` gains a namespace split and an activation gate

`scripts/check-catalog-completeness.mjs` is amended:

- **Admin namespaces are exempt entirely.** No warning, no error, for `admin.*`
  or `cms.*` in any non-default catalog. Silence here is now correct, not
  neglect — and it makes the remaining warnings readable, which they had
  stopped being.
- **Public namespaces are checked for every non-default catalog**, and are a
  **hard failure** for any locale in `ENFORCED_LOCALES` and a warning for the
  rest.
- `ENFORCED_LOCALES` is the list of locales that are (or are about to be)
  `isActive`. **Adding a locale to `Locale.isActive` means adding it here in
  the same PR** — which makes CI refuse the activation until that locale's
  public catalog is complete. That is the point: a half-translated public site
  should not be able to go live by accident.

The script is a pure file check with no database access, so the active-locale
list is duplicated here by hand — the same static/dynamic trade-off
`routing.ts` and `LOCALE_DIRECTION` already accepted and document.

### 5. The public catalogs are complete as of this ADR

`es` was already complete across every public namespace. `ar` and `ur` were
each short exactly six keys — the `news.share*` group — which are filled in
this change. So the guarantee in #1 is true today, not aspirational.

## Consequences

- **`docs/changes/changes-07-plan.md`'s ~55 new keys are `admin.*`** and now
  need `en` only. The plan's §0 and §6 are corrected. This is real scope
  removed from that plan, not deferred.
- Every future admin screen is cheaper: one catalog, not four.
- Every future public string is non-negotiable: all active locales, enforced.
- The ~700 outstanding `admin.*`/`cms.*` translation gaps stop being a standing
  warning that everyone learns to scroll past. Warning fatigue was itself the
  risk — the six genuinely-missing _public_ keys were buried in that noise and
  had gone unnoticed.
- Activating `ar` or `ur` later stays a real piece of work (their public
  catalogs must be complete and RTL verified), but it is now a bounded,
  enumerable one that CI will state precisely.

## Alternatives considered

- **Translate the admin portal too.** Rejected: ~800 keys × 3 locales of
  ongoing maintenance for an internal staff tool nobody asked to localise, and
  the `cms.*` third of it serves a cancelled feature.
- **Delete the `admin.*` keys from `es`/`ar`/`ur` that already exist.**
  Rejected — they are already written and correct; deleting them would be churn
  and would make the admin _worse_ in Spanish for no gain. They simply stop
  being required. (`es` in particular already carries a large, good `admin.*`
  translation.)
- **Keep everything a warning, change nothing but the docs.** Rejected: a
  guarantee nothing enforces is a preference. The public half is exactly the
  half worth gating, and #4 gates it at the moment it starts to matter —
  activation.
- **Read the active-locale list from the database in the check.** Rejected: the
  script runs in CI without a database, deliberately (it is a static file
  check). Hand-sync is the established pattern for this exact split
  (`routing.locales`, `LOCALE_DIRECTION`), and the hand-sync step is precisely
  where the obligation should bite.
- **Split the message catalogs into `public.json` / `admin.json` per locale.**
  Rejected as premature: it is a real option if the split ever needs to be
  structural rather than conventional, but namespace-level rules cost nothing
  today and no code has to move.

## Compliance

- `pnpm governance:check` — this ADR exists before the code change lands.
- `node scripts/check-catalog-completeness.mjs` — exits 0; reports zero public
  gaps for `es`/`ar`/`ur` and is silent on `admin.*`/`cms.*`.
- `scripts/__tests__/check-catalog-completeness.test.mjs` gains cases for both
  new behaviours (admin exemption; enforced-locale failure).
- DEVLOG entry recording the change and its verification, per testing.md #6.
