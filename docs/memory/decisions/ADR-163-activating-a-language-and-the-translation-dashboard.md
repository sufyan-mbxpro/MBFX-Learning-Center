# ADR-163 — Activating a language from the admin, and the translation dashboard

- **Status:** Accepted
- **Date:** 2026-09-28
- **Module:** 06 (i18n), 09 (admin settings)
- **Plan:** `docs/changes/multilingual-automation-plan.md` §4.4 and §5,
  Phase 4.
- **Extends:** ADR-162 #7 and #9 (the cron runner and the backfill),
  ADR-150 (a settings area is one tabbed section), ADR-043 #4 and ADR-091
  (only a complete, active locale is served). Nothing reversed.

## Context

Plan §4.4 ends with "the admin flips `isActive` → one `BACKFILL_LOCALE` job
is enqueued". Nothing in the admin flips `isActive` today: activation has been
a seed or database change. `locales.manage` has been seeded since Module 01 and
read by nothing, and `@repo/i18n`'s `invalidateActiveLocales()` says "call
after an admin activates" with no caller.

A locale is served at request time (`isServableLocale` in the public root
layout, behind the `locales` cache tag), so a database activation takes
effect without a rebuild. That makes the CI gate insufficient on its own:
`check:catalog-completeness` refuses an incomplete catalog only for a locale
listed in `ENFORCED_LOCALES`, and a runtime switch never passes through CI.
Missing keys fall back to English (`request.ts`), which is how a
half-translated public site would go live, the outcome ADR-043 #4 exists to
prevent, and inside an RTL page, the one ADR-007 forbids.

## Decision

1. **Settings → Translation becomes one tabbed section** (ADR-150):
   **Overview** (`translations.view`), **Languages** (`locales.manage`),
   **Review** (`translations.view`) and **Provider**
   (`translations.provider.manage`, the Phase 1 form, unchanged). The tabs
   are built from what the viewer holds. The section's root is Overview; the
   provider form moves to `…/translation/provider`. Review lists what
   ADR-159 #5 and ADR-160 #8 name — `MACHINE_TRANSLATED`, `OUTDATED` and
   `NEEDS_REVIEW` rows — with a state filter, because after a backfill the
   machine rows outnumber the flagged ones a person should read first.
2. **Activation is `locales.manage`, and it is refused unless the locale can
   be served properly:** not the default locale; a code next-intl can route
   (`routing.locales`); and a **complete public catalog**, checked at
   request time against `en.json` with the same namespace split as
   `check:catalog-completeness` (admin namespaces exempt). A test keeps the
   runtime list of admin namespaces equal to the script's. The CI gate is
   unchanged: the activation PR still adds the locale to `ENFORCED_LOCALES`.
3. **The confirmation shows a pre-flight estimate** — the characters the
   backfill would send (source text of every item with no translation or a
   machine one that is out of date) × the provider's price, beside the
   budget remaining this month. It is labelled estimated (ADR-100). It is
   not a gate: at the budget, work pauses (ADR-160 #6) rather than failing.
4. **Activating enqueues one `BACKFILL_LOCALE` job and invalidates the
   `locales` tag.** Deactivating keeps every translation (it is served again
   on reactivation, and `?lang=` reads it meanwhile, ADR-127) and leaves
   queued jobs where they are: **the runner finishes a job for an inactive
   locale without calling Google**, which covers the job already claimed
   when the switch flipped as well as the ones still queued.
5. **Sync and Retry are `translations.approve`, one audit row per press**
   (plan §5). **Sync** re-enqueues the locale's backfill: every item is
   reconciled, so a machine row whose source moved is re-translated and a
   person's is flagged `OUTDATED` (ADR-161 #3). **Retry failed** re-arms the
   locale's `FAILED` jobs. Nothing is translated before the response: an
   activation, Sync or Retry starts ONE queue tick in `after()` (one backfill
   expansion and one batch of 25, ADR-162 #7's inline runner), and the cron
   does the rest.
6. **One registry of translatable types in `@repo/core`**
   (`TRANSLATABLE_TYPES`): each type's job handler, backfill page, coverage
   counts, estimate and review rows. Its order is the backfill's order.
   Phase 5 adds a type by adding an entry; a type the dashboard cannot count
   is a type the backfill cannot walk.
7. **The cron route drains for a time budget, not one batch:** batches of
   25 until nothing is due, a batch pauses (budget or quota — every later
   job would pause too), or **240 seconds** pass, inside the 300-second
   proxy and client timeouts `docs/ops/cron.md` already sets.

## Consequences

- Adding a language is still one PR (catalog + `ENFORCED_LOCALES`) and then
  one switch; the switch refuses before the PR has shipped.
- A deactivated locale's queued jobs complete as no-ops, costing one query
  each and no characters.
- The Provider tab's URL changes. The settings sub-nav entry points at the
  section, so no link is left behind.

## Alternatives rejected

- **Trust CI alone for completeness.** A runtime switch never meets CI.
- **Delete a locale's jobs on deactivation.** Misses a job already claimed;
  the runner check covers both.
- **Refuse activation above the remaining budget.** The budget pauses work
  by design; refusing would make the admin raise a cap to flip a switch.
