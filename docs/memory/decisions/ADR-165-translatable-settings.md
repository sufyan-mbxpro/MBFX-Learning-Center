# ADR-165 — Translatable settings

- **Status:** Accepted
- **Date:** 2026-09-28
- **Module:** 05 (settings), 06 (i18n), 08 (header/footer)
- **Plan:** `docs/changes/multilingual-automation-plan.md` §4.2 (`Setting.isTranslatable`)
  and §6 Phase 5 → Phase 6.
- **Closes:** ADR-164 #9's first deferral. Phase 6 needs this before it
  activates an RTL locale.
- **Extends:** ADR-159 (what is served and indexed), ADR-161 (who may
  overwrite what), ADR-162 (the queue), ADR-163 (activation), ADR-164 (the
  engine). Nothing reversed.

## Context

A handful of settings are words a reader sees: the hero and footer blurb
(`site.description`), the footer's copyright line and risk disclaimer
(`legal.copyrightNotice`, `legal.riskDisclaimer`), and the text inside three
header JSON values (`header.cta.label`, `header.announcementBar.text`,
`header.topBar.promoText`). `getSetting(key)` has no locale, and there is no
place to keep a translation, so every one of them renders in English on every
locale. `Setting.isTranslatable` has existed since Module 01, is seeded
`false` everywhere and is read by nothing.

Two of those keys are unlike the rest. The disclaimer is a legal statement
the operator owns (ADR-122); it names a registration number, a jurisdiction
list and a regulator's wording. The copyright line carries a `{year}` token
that a translation must keep. A machine rendering of either could change what
the operator is saying, and ADR-160 #8's number check would not catch a
changed jurisdiction.

## Decision

1. **A code registry decides what is translatable.** `TRANSLATABLE_SETTINGS`
   (`@repo/contracts`) names each key, which of its fields are words (the whole
   value for a string, named fields for a JSON object), each field's maximum,
   and whether the machine may translate it. Everything else in a JSON value —
   `enabled`, `url`, `dismissible`, `phone` — is never translated and always
   comes from the English row, so a translation cannot switch a bar on or send
   a button somewhere else. `Setting.isTranslatable` is set from the registry
   (seed and migration) so the database agrees with it; the code does not read
   the column. `@repo/db` keeps the key list its seed needs, and a test holds it
   equal to the registry.
2. **Not translated, on purpose:** `site.name` (a brand), `site.tagline` (read
   by nothing — code-style.md #28; translating it would be the same mistake a
   second time), `seo.titleTemplate` (a pattern with no words), the two
   `legal` identity lines (single-language, plan §4.2 and ADR-110), and the
   `email` group (email has its own locale rules, ADR-043 #2, ADR-113).
3. **One table.** `SettingTranslation` (`settingId`, `locale`, `value` JSON,
   `translationStatus`, `sourceHash`) holds only the translated WORDS, always
   as an object of fields: the named fields for a JSON key, and the one field
   `value` for a key whose whole value is text. One shape, so the job, the
   editor and the reader have no second case. The English stays in
   `settings.value`; no `en` row is written.
4. **The reader merges.** `getLocalizedSetting(key, locale)` (`@repo/settings`)
   returns the English value with the translated fields laid over it, cached
   under the key's existing `settings:{group}` tag (architecture.md #12 — no new
   tag). A blank or missing translated field is the English field (ADR-B's
   fallback, unchanged). A stored translation that fails its schema is
   ignored, not thrown: a malformed row must not take the header down.
   Public call sites of a registry key use this reader, never `getSetting`;
   a source guard fails on one that does not.
5. **Settings are chrome.** Like catalog keys and labels (ADR-159 #3), a
   translated setting is served in every state, machine included, and never
   decides a page's index directive.
6. **The `legal` group is human-only.** Its registry entries say
   `machine: false`: no job is enqueued, a backfill does not walk them, and
   they are never sent to Google. A person writes them in the editor (#8).
7. **Machine keys follow the engine's protocol** (ADR-161/162/164): a setting
   is a translatable type (`setting`, entity id = `Setting.id`) with the
   engine's job handler, which gains one option — how to LOCK the source —
   because a setting's English is a `settings` row, not a row of its own
   translation table. The walk, coverage, estimate and review rows are written
   for the type by hand, as articles' are. An English save of a registry key
   (Settings → General / Legal) runs the one sweep, `afterSourceSave` — a
   person's `TRANSLATED` row whose hash differs becomes `OUTDATED` — and, for a
   machine key only, enqueues and drains in `after()`. A write revalidates the
   key's `settings:{group}` tag.
8. **The editor is Settings → Translation → Site text**, a fifth tab: pick a
   language (any non-default, active or not, so a language can be prepared
   before it is switched on), see each key's English beside its translation and
   state, save one key at a time. A save writes `TRANSLATED` with the hash of
   the English it was made from. It needs **`settings.update` and
   `translations.update`**: the first because the English it restates needs it,
   the second because it is translation work. A translation must keep every
   `{token}` its English has (`{year}`), checked by one contracts schema built
   from the English, which the form and the service both run. The machine's
   result is held to the same rule: a machine result that lost a token is
   written `NEEDS_REVIEW` beside ADR-160 #8's number check.
9. **Switching a language on refuses while a human-only key is missing.**
   `setLocaleActive` gains the refusal `siteTextIncomplete`: a `legal` key
   whose English is non-empty and which has no row in that language. The
   machine cannot fill those, so without the gate a language would go live
   with an English risk disclaimer inside a translated page — the case ADR-007
   forbids and ADR-164 #9 named. An `OUTDATED` row counts as present (it is a
   person's, and served). Switching off is never refused.

## Consequences

- Six keys, one table, one reader. A seventh key is a registry entry (and a
  `@repo/db` list entry the test demands), its public call site moving to
  `getLocalizedSetting`, and nothing else.
- Activating any language now needs someone to write two legal paragraphs in
  it first. That is the point.
- The three header keys sit in the `layout` group, whose admin screen is
  hidden (ADR-038), so their English cannot be edited in the admin today;
  their translations can, and the machine keeps them current.

## Alternatives rejected

- **Machine-translate the legal keys and flag them `NEEDS_REVIEW`.** A
  flagged row is still served (ADR-159), so the disclaimer would be live in
  Google's words until someone looked. The gate in #9 is the cheaper way to
  make someone look first.
- **Translate the whole JSON value.** It would let a translation change a URL
  or a switch, and the translator would be handed `true` and `/sign-up` to
  translate.
- **A `locale` argument on `getSetting`.** Every existing caller would carry a
  locale it does not need, and a non-translatable key would silently accept
  one. A separate reader, typed to registry keys only, makes the choice
  visible at the call site and lets the guard find it.
- **Reading `Setting.isTranslatable` at runtime.** It would make which fields
  are words a database fact, when the reader and the job need to know them as
  types.
