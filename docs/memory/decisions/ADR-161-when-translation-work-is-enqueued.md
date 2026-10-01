# ADR-161 — Translation work is enqueued on every save, and who may overwrite what

- **Status:** Accepted
- **Date:** 2026-09-25
- **Module:** 06 (i18n), 11 (content), 13 (tools), 15 (articles)
- **Plan:** `docs/changes/multilingual-automation-plan.md` (revision 2), §3.
- **Extends:** ADR-071 (scheduled visibility), ADR-159, ADR-160. Nothing
  reversed.

## Context

The obvious trigger for translating something is "when it is published".
ADR-071 makes that trigger unreliable: scheduled content becomes visible
inside the query when its date arrives, and no code runs at that moment.
`/api/cron/publish-due` is optional bookkeeping. A publish hook would miss
every scheduled item.

The status enum also has five members, not the three a first draft of the
plan assumed: `DRAFT`, `TRANSLATED`, `NEEDS_REVIEW`, `OUTDATED`,
`MACHINE_TRANSLATED`. A rule about when the machine may write has to cover
all five.

## Decision

1. **Enqueue on every save and every status change of the English source**,
   for each active locale other than `en`. Translating a draft early is
   harmless: readers never see a draft, and the translation is ready when it
   goes live, whether by a click or by its schedule.
2. **The machine writes only to an absent row or a `MACHINE_TRANSLATED`
   row.** Every other state belongs to a person: `TRANSLATED` (saved),
   `OUTDATED` (saved, source moved on), `NEEDS_REVIEW` (flagged by a person
   or by the number check), `DRAFT` (work in progress, or a duplicated copy).
3. **Source changed:** a `MACHINE_TRANSLATED` row is re-translated in place;
   a `TRANSLATED` row becomes `OUTDATED` with its content untouched; the
   other human states are left alone.
4. **A null `sourceHash` means unknown, not current.** Columns added for this
   work are not backfilled from today's source, because that would mark
   every existing translation as up to date, stale ones included. A null hash
   on a `TRANSLATED` row makes it `OUTDATED` (one review pass); on a
   `MACHINE_TRANSLATED` row it causes a re-translation.
5. **Retranslate in the editor fills the form only.** It runs Google on the
   open form behind a `ConfirmDialog`; nothing is written until the person
   saves, which writes `TRANSLATED`. Leaving the page changes nothing.
6. **Slugs.** A machine-created translation reuses the English slug.
   `@@unique([locale, slug])` already keeps locales apart; there is no
   transliteration. A person may change it, and the existing
   redirect-on-slug-change behaviour applies.
7. **Status on every translatable table; new status columns default to
   `TRANSLATED`.** Eight tables had no status or no hash (menu items, course
   sections, quiz questions, glossary topics, video categories, article
   categories and tags, and courses' hash). An existing row there was written
   by a person or the seed, so it is `TRANSLATED` — and with a null hash, #4
   sends it through one review pass. Code that creates a row without naming a
   status is a person's save, so the same default is right for it too; only
   the job runner writes `MACHINE_TRANSLATED`, and it always says so.
8. **A child label is translated ON ITS PARENT'S ROW, keyed by its English
   text.** A lesson's attachment labels and a video topic's link labels live
   in `LessonTranslation.attachmentLabels` and
   `VideoTopicTranslation.linkLabels`, JSON maps of English label →
   translated label. Not tables of their own: `saveLesson` and
   `saveVideoTopic` delete and recreate those children on every save
   (`lessons.ts`, `videos.ts`), so a translation keyed on a child's id would
   be deleted with it — a person's translation included — every time anyone
   pressed Save. Keyed by the English text, a map survives recreation and
   reordering. The parent's hash covers the labels, so changing one flows
   through #3 like any other field; a label with no entry in the map falls
   back to its English text, the one place English can appear on a
   translated page, because a missing link label would hide the link.
9. **Social link labels are not translated.** They are brand names
   ("Instagram", "YouTube"), which stay as written in every language — the
   reason `MarketInstrument.displayName` is untranslated (ADR-068 §4). Plan
   §4.2 listed them; this removes them.

## Consequences

- Every translatable entity's save path gains one enqueue call, inside
  `@repo/core`, never in the app. The call is idempotent (ADR-162 #1).
- Existing human translations surface once as `OUTDATED` after the schema
  pass. That is the correct outcome: nobody knows whether they are current.

## Alternatives rejected

- **Enqueue on publish, plus a hook in `publish-due`.** `publish-due` is
  optional (ADR-071), so this would still miss items on an install that does
  not run it.
- **Backfill hashes from current source.** See #4.
