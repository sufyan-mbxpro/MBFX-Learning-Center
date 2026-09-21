# ADR-126: AI fills every editor from a brief, and every text field can be regenerated

**Status:** Accepted
**Date:** 2026-09-17
**Module:** 18 (`@repo/ai`), 11 (content editors), 15 (articles)
**Plan:** owner request, 2026-09-17
**Extends:** ADR-097 (the platform), ADR-099 (tiers). Nothing in either is reversed.
**Superseded by:** —

## Context

The owner, after the writing assistant and quiz generation shipped:

> the writing assistant should automatically appear on all editor inputs of all
> modules like courses, lessons, videos, glossary, topics, news, quizzes.. there
> should be top option available the admin will provide the details there ai
> should fill all the inputs as per module inputs & admin can edit as well..
> also there should also be separate option available to update or regenerate
> the text.. also increase the size of input text where needed..

Asked, the owner chose: review before replacing anything already written; rich
text generated WITH formatting; all seven editors in one change; and quiz
questions generated from the brief as well as from a linked lesson.

Three things stood in the way:

1. **The writing assistant was article-only by wiring, not by decision.**
   `RichTextEditor` already took an optional `ai` prop, the run route already
   admitted `lessons.update` and `tools.update`, and plan §14.1 merely scoped
   B1 to the article editor. Nothing forbade the rest.
2. **Filling a whole form is not any existing feature.** SEO, summaries and
   quiz generation each fill a FIXED handful of fields for one screen. A brief
   that fills a course (six fields), a glossary term (nine, four of them rich
   text) or a quiz (questions) is a new prompt with a new output — ADR-097's
   consequence section says a changed prompt is a new registry entry.
3. **Rich text was plain-text-only** (B1, plan §2.2 #10), because Tiptap's
   marks are class-based and model-written HTML carries inline styles the
   sanitizer strips (ADR-046). Filling a lesson body with one undifferentiated
   paragraph would be a worse draft than no draft.

## Decision

### 1. One new feature key, `form_fill`

`AI_FEATURES` gains `form_fill` (surface `editor`, not streamed, `standard`
tier at `medium` effort, ceiling 8000 output tokens). ONE key rather than one
per module, for B1's reason: an admin thinks of "generate with AI" as one tool
with one switch, and seven toggles saying the same thing is seven chances to
leave one off by accident.

Its payload is a discriminated union on `mode`:

- **`form`** — a brief (≤2000 characters), the module, the locale, and the
  editor's CURRENT text as context, so a half-written lesson is continued
  rather than contradicted.
- **`field`** — one field, one action (`regenerate` · `improve` · `shorten` ·
  `expand`), its current value, and the same context.

### 2. The field set is a code registry: `AI_FILL_FIELDS`

`@repo/contracts` declares, per module, exactly which fields AI may fill, each
with a KIND (`text` · `textarea` · `rich` · `list` · `faq` · `questions`) and
the COLUMN's own limit. The output schemas, the prompt's description of the
JSON shape and the review dialog's rows are all derived from it, so the three
cannot disagree (ADR-097 #13's rule, made structural).

What is absent is absent on purpose, and the prompt says so: **no URL, image,
slug, category, track, difficulty or status.** A model inventing a video URL
is the SSRF-shaped input security.md #9 refuses; a slug is an SEO act that
writes a redirect (B3's reasoning); taxonomy and publishing are decisions, not
prose. Slugs keep following the title the way they already do.

| Module | Fields |
|---|---|
| course | title, summary, description (rich), seoTitle, seoDescription, seoFocusKeyword |
| lesson | title, summary, content (rich), learningObjectives, seoTitle, seoDescription, seoFocusKeyword |
| video_topic | title, summary, content (rich), seoTitle, seoDescription, seoFocusKeyword |
| quiz | title, description, questions |
| glossary_term | term, simpleExplanation, detailedExplanation, advancedExplanation, exampleScenario (all rich), faq, seoTitle, seoDescription |
| glossary_topic | name, description (rich), seoTitle, seoDescription, seoKeywords |
| article | title, excerpt, body (rich), seoTitle, seoDescription, focusKeywords, ogTitle, ogDescription, faq, keyTakeaways |

### 3. Rich text is STRUCTURED, and our code writes the HTML

The model never returns HTML. A rich field is an array of blocks —
`heading` (level 2 or 3), `paragraph`, `list` (ordered or not), `quote` —
whose text may carry `**bold**` and `*italic*` and nothing else.
`aiBlocksToHtml` (`@repo/utils`, pure) escapes every character and emits only
`h2 h3 p ul ol li blockquote strong em`, all of which `sanitizeRichText`
already allows with no attribute. So formatting survives the save, a
`<script>` in a generation arrives as visible text, and the plain-text rule
B1 set for the ASSISTANT is untouched: it still streams text into a panel.

### 4. Review before replacing

`form` mode opens a review dialog (B2's pattern, generalised): one row per
suggested field, current beside suggested, a checkbox ticked **only where the
field is empty**. Apply writes the ticked fields into the form's state in ONE
patch — the course, lesson, video, glossary and topic editors merge from the
last render, so several setter calls in one tick would overwrite each other.
`field` mode shows its one suggestion with Replace and Discard.

Nothing is saved: the editor's own Save, schema and permission check persist
it (ADR-097 #4, unchanged). Previews render as text, never as HTML.

### 5. The writing assistant is on every rich-text field

Every `RichTextEditor` in the seven editors receives the assistant prop when
`writing_assistant` is available. The run route's surface list for
`writing_assistant` gains `courses.update` and `glossary.update`.

### 6. `form_fill` is gated per MODULE, not per feature

`FEATURE_SURFACE_PERMISSIONS` answers "which key governs this feature's
surface", and for a feature spanning seven editors the honest answer depends
on the payload. The route parses the payload, then requires the module's own
key: `news.manage`/`analysis.update` (article), `courses.update` (course),
`lessons.update` (lesson, video topic, quiz), `glossary.update` (term, topic).
Holding `glossary.update` does not buy course generation. No new permission
key (ADR-097 #10).

### 7. Bigger inputs

`RichTextEditor`'s writing area grows from `min-h-72` to `min-h-96`. The
single-line inputs holding long text become textareas — the video topic's and
glossary term's SEO description, the quiz option explanation — and the
summary, description and prompt textareas gain rows. `field-sizing-content`
still grows each one with its content.

## Consequences

- **`ai.maxTokensPerRequest` must be raised for `form_fill` to be useful.** It
  is seeded at 2000, and the effective ceiling is the minimum of the feature's
  8000, that setting and the model's own. A lesson body cut at 2000 tokens is
  unparseable JSON — an `invalid_output`, not a short lesson. The setting is
  not re-seeded: overwriting an admin's value is the thing ADR-108's bounded
  migration exists to avoid. The Features screen's description of `form_fill`
  says so.
- A generated body states facts about markets with confidence. The review
  dialog is the safety net, and the system prompt forbids prices, dates,
  statistics and named institutions it was not given.
- An eighth editor joins by adding a module to `AI_FILL_FIELDS`, a permission
  row in the route, and the three props on its page. The contract test fails
  on a module with no permission row.

## Alternatives rejected

- **A feature key per module.** Seven toggles, seven seed rows, seven catalog
  blocks, one prompt.
- **Letting the model write HTML.** Inline styles are stripped on save, and a
  class vocabulary taught to a model is a vocabulary it will invent members of.
- **Plain paragraphs only.** Chosen against by the owner; a lesson without
  headings or lists is not a draft anyone keeps.
- **Auto-applying the whole form.** An admin who wrote a summary should not
  lose it to a brief typed for the body.
- **Generating a DRAFT row.** Rejected in ADR-097 already: a row is a write.
