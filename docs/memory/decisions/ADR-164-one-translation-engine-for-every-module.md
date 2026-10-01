# ADR-164 — One translation engine for every module, and what Phase 5 defers

- **Status:** Accepted
- **Date:** 2026-09-28
- **Module:** 06 (i18n), 11 (content), 13 (tools), 15 (articles)
- **Plan:** `docs/changes/multilingual-automation-plan.md` §6 Phase 5.
- **Extends:** ADR-159 (what is indexed), ADR-161 (who may overwrite what),
  ADR-162 (the queue), ADR-163 (the registry). Nothing reversed.
- **Defers, from the plan:** translatable settings, `Tool.config` free text,
  and per-type Sync (#9). The first is a change to the plan's Phase 5 scope and
  is why this ADR exists before Phase 6.

## Context

Phase 3 wrote the ADR-161/162 protocol by hand for articles. Phase 5 adds
thirteen entity types across seven modules. Mapping them found the same four
faults in most of them: a source hash that covered a subset of what is
translated (or no hash at all); a sweep that flipped EVERY stale sibling to
OUTDATED, machine rows included — which under ADR-159 makes stale machine text
indexable; a person's save that wrote no status, so saving over a machine row
left it `MACHINE_TRANSLATED` (served, never indexed); and public pages that
set no `noindex` for machine words and listed every translation in the
sitemap.

## Decision

1. **One engine** (`@repo/core` `translation-engine.ts`). Each entity declares
   its translation table, FK and parent, and supplies four functions: load the
   English source, hash it, list its segments, write a result. The engine runs
   the protocol (status rules, translate outside the transaction, lock the
   source and re-hash, conditional write, number check) and derives the
   backfill walk, coverage, estimate and review rows from the same
   declaration. Articles keep their hand-written handler, which the engine
   copies. SQL identifiers come from the declaration, are code constants, and
   are refused at definition time unless they are plain names.
2. **Every hash covers everything the job translates** (a `*-source.ts` per
   module, shared by the service and the job): SEO text, FAQ, objectives,
   highlights, child labels. Existing rows mismatch once — a person's becomes
   OUTDATED on the next English save, a machine one is re-translated — as
   Phase 3 decided for articles. **A person's non-English save records the
   hash of the English it was made from, computed from that row**, never
   copied from the English row's stored hash (a seeded English row has none).
3. **One sweep** (`afterSourceSave`): after an English save, only a
   `TRANSLATED` row whose hash is null or different becomes OUTDATED; the job
   is enqueued for the rest. Every person's save writes `TRANSLATED`.
4. **Enqueue everywhere a source can change**: saves, creation, duplication,
   restore, every content status transition and the scheduled-publish sweep
   (ADR-161 #1). Admin actions drain the saved entity's jobs in `after()`; a
   quiz drains its questions too, because a quiz is offered in a language only
   once every question has a row there.
5. **SEO follows ADR-159 #2 for prose** — courses, lessons, glossary terms and
   topics, video topics, tool pages: `noindex` for machine words at their own
   URL, and only indexable translations in the sitemap and hreflang. Tool
   pages move from the sitemap's static list to a per-locale one. **Labels**
   (article categories and tags, video categories, menu items) are published
   with no restriction (ADR-159 #3) but carry status and hash like the rest.
   Quiz runners are already `noindex` and not listed.
6. **Child labels** (lesson attachments, video links) are translated on the
   parent's row keyed by the English text (ADR-161 #8); a label with no entry
   renders its English text. Video links are rewritten on every save whatever
   locale was open, so the video sweep reads its source back rather than
   trusting which tab was saved.
7. **Quizzes keep option count and order exactly.** `correctAnswer` holds
   option indexes on the question row, and grading never reads a translated
   option; `buildQuestionTranslation` is the one place the shape is built, a
   blank result keeps the English option rather than dropping a choice, and a
   unit test pins it. Each question is its own translatable entity.
8. **The support FAQ moves to the catalog** as ADR-159 #6 decided: the
   sentences are `support.faq.items.*`, the figures stay in
   `SUPPORT_FAQ_FIGURES` and reach them only as ICU arguments; a test fails on
   a digit in any FAQ message.
9. **Deferred, each for a stated reason:**
   - **Translatable settings.** There is no `SettingTranslation` model, and
     `getSetting` has no locale: translating `site.tagline` or
     `legal.copyrightNotice` means a model, a migration, a locale-aware reader
     at every public call site, and an editor. It needs its own ADR, and it
     must land **before Phase 6 activates an RTL locale**, because an English
     tagline inside `/ar` is what ADR-007 forbids.
   - **`Tool.config` free text.** The only words in any config are market-hours
     session names; config has no per-locale copy to hold a translation.
   - **`Quiz.category`** stays untranslated free text (plan §7 open item 2).
   - **Per-type Sync.** Sync is per locale and global (ADR-163 #5); the
     Overview shows coverage per type, which is what a per-type sync would be
     aimed by.
   - **The admin ⌘K search stays English** (ADR-043 #2). Public search already
     queries the request's locale; the plan's "`search.ts` hard-codes `en`"
     describes the admin palette.

## Consequences

- A new translatable type is one `*-source.ts`, one declaration, one
  registry line, its enqueue calls and — for prose — its page's `noIndex`.
- The first English save of every existing item after this change flags that
  item's human translations once.
- Phase 6 has a prerequisite it did not have: translated settings (#9).

## Alternatives rejected

- **A handler per module, copied from the article one.** Thirteen copies of a
  concurrency protocol is thirteen places to get the lock order wrong.
- **Mark labels `noindex` too.** ADR-159 #3 decided labels are low-risk names;
  an archive page with a machine-translated category name is not prose.
