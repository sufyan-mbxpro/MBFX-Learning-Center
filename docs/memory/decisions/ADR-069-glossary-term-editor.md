# ADR-069: The glossary term gets its own editor route

**Status:** Accepted
**Date:** 2026-09-09
**Module:** 11 (content system — glossary), 12 (public site — glossary surfaces)
**Supersedes:** —
**Superseded by:** —

## Context

`/admin/glossary` has been, since Module 11's core slice, a list of cards where
every card carries an inline `TranslationForm`. That shape was right when the
glossary was one entity with three fields and the screen existed to prove the
translation lifecycle end to end. It is no longer right, and three separate
facts say so.

**1. The form cannot edit.** `TranslationForm` initialises `term`, `slug` and
`body` to `useState("")`. It never receives the stored translation, because
`loadGlossaryAdminList` does not select `simpleExplanation` at all. Opening a
published term shows three blank fields and an editor with nothing in it. The
Save button is disabled until the author retypes the term and the body, at
which point it upserts over the row — so the only way to correct a typo in a
definition is to rewrite the definition. This is not a styling gap; the screen
advertises an edit affordance it does not have.

**2. It writes one field of eleven.** `GlossaryTermTranslation` carries
`simpleExplanation`, `detailedExplanation`, `advancedExplanation`,
`exampleScenario`, `faq`, `seoTitle` and `seoDescription`.
`GlossaryTerm` carries `topicId`, `track`, `difficulty`, `formula` and
`imageUrl`. The form writes `simpleExplanation`. `saveGlossaryTranslation`
accepts `detailedExplanation` and no caller passes it; the other five
translation fields it does not accept at all. Five of these columns have
existed since Module 01 and have never had a write path.

**3. The topic model has no admin.** D27 (ADR-055 #12) replaced the free-text
`category` with a real `GlossaryTopic`, gave it translations, slugs, ordering
and two public routes — `/glossary/topics` and `/glossary/topics/[topic]`. The
only way to set `GlossaryTerm.topicId` is the optional second argument to
`createGlossaryTerm`, and `createGlossaryTermAction` does not pass it. So the
column is unwritable from the admin, `/glossary/topics` renders empty on every
database, and `GlossaryTabs` — which hides itself until a topic has published
terms — has never rendered for anyone. Phase 10 shipped a browse mode that
cannot be reached because the field feeding it has no control.

A fourth, quieter cost: the list mounts one Tiptap instance per term. At fifty
terms that is fifty editors, their extensions and their history stacks, on a
screen whose primary job is to let someone find a term.

## Decision

**The glossary term gets a dedicated editor route, `/admin/glossary/[id]`,
modelled on the lesson editor rather than the article editor**, and
`/admin/glossary` becomes a `DataTable` that lists and filters.

The lesson editor is the correct model, not the article editor, for the reason
ADR-063 already established: the glossary runs the **seven-state**
`CONTENT_TRANSITIONS` machine and has no `scheduledFor` column, so
`publish-panel.tsx` is wrong on both counts and `ContentStatusPanel` is right on
both. This ADR adds no new panel vocabulary — it composes `EditorSection`,
`ContentStatusPanel`, `SeoAnalysis`, `ContentStats` and `AdminCombobox` exactly
as `lesson-editor.tsx` does.

Four specifics that are decisions rather than mechanics:

1. **One save, whole screen.** `saveGlossaryTerm` replaces the
   translation-only write and commits term-level fields and the active
   locale's translation **in one transaction**, the way `saveArticle` and
   `saveCourse` do. `saveGlossaryTranslation` is kept and now delegates to it,
   because the OUTDATED-flip and slug-redirect logic it owns is the part worth
   preserving and is tested.

2. **The source hash covers what a reader sees.** It is currently computed over
   `simpleExplanation + detailedExplanation`. Adding `advancedExplanation` and
   `exampleScenario` to the editor without adding them to the hash would mean a
   source edit that changes a worked example never marks its translations
   OUTDATED. The hash therefore covers all four prose fields. **This
   invalidates every stored `sourceHash`** — which is a pre-launch reset, not a
   migration (see Consequences).

3. **`topicId` is nullable and means unfiled; `track` is nullable and means
   every school.** These two nulls sit one field apart and mean opposite
   things, so the editor must not render them as one idiom. The topic
   dropdown's null option reads "Unfiled" and is styled as an absence; the
   track dropdown's null option reads "Both schools" and is first in the list
   because it is the right answer for most vocabulary. This is ADR-065 §3
   restated where someone will actually hit it.

4. **`viewCount` orders "popular", and nothing writes it yet.** The public term
   page gains a Popular terms rail (see below). It orders by
   `viewCount DESC, term ASC`. No increment path is added here — deliberately:
   a per-request write on a `"use cache"` page is the wrong shape, and the
   right one is a batched counter that belongs with analytics. Until then every
   count is 0 and the tie-break makes the rail strictly alphabetical, which is
   stable, honest, and indistinguishable from the reference screen's own
   alphabetical list.

### The public surfaces come with it

The glossary's two public pages get the presentation pass the learn area and
/news already had. That half needs no ADR of its own — it introduces no new
pattern — but it is recorded here because item 4 above and the new core loaders
exist only to serve it:

- `/glossary` gains a `PageHero` masthead with generated backdrop art
  (ADR-047 §3 pattern, fifth instance), the **Topic of the day** card that
  `term-of-the-day.tsx` explicitly deferred to Phase 10, and a counted stat
  strip. The A–Z browser, its search and its chip bar are unchanged.
- `/glossary/[term]` — bare `main`, back-link and body until now — gains a
  breadcrumb, a `PageHero` band, its topic and difficulty as badges, the
  `detailedExplanation` / `advancedExplanation` / `exampleScenario` /
  `faq` fields the editor now writes, and a closing block carrying the A–Z
  chips and the Popular terms rail. **No search input** — the reference block
  has none either, and adding one would need a query parameter that
  `GlossaryBrowser` is explicit about not reading.

## Consequences

- **Every `sourceHash` is invalidated by item 2.** Pre-launch, the policy is
  reset and reseed, not backfill. A `pnpm db:reset` is required after this
  lands; without it, the first save of any English term flips its siblings
  OUTDATED once, spuriously. There are no non-English translations seeded
  today, so the practical blast radius is zero — the guidance is for anyone
  running a database that predates this.
- **`/glossary/topics` starts rendering for the first time.** Seeding topics
  and filing terms under them is now possible, so `GlossaryTabs` will appear on
  databases that do it. A database that files nothing looks exactly as it did.
- **The inline `TranslationForm` is deleted, not hidden.** It has no callers
  once the list becomes a table, and keeping a form that cannot edit is worse
  than removing it. `GlossaryControls` and `TermTrackSelect` move into the
  editor; the table keeps status and delete/restore as row actions.
- **The editor's catalog keys live under `admin.glossaryEditor`, NOT under
  `admin.glossary`.** `admin.glossary` is a string — the nav label and the list
  page's title — and next-intl cannot serve one key as both a string and an
  object; nesting under it throws `INSUFFICIENT_PATH` at runtime. Nothing
  static catches that: admin catalog gaps are silent by design (ADR-043 #2)
  and catalog keys are not type-checked. English-only, as the whole admin is.
- **`glossaryTermPath` is unchanged and terms do not move.** This ADR touches
  no URL. The track glossary at `/learn/[track]/glossary` stays a filtered view
  onto the same pages (ADR-065 §2).

## Alternatives considered

- **Fix the inline form in place — prefill it and add the missing fields.**
  Rejected. Prefill alone is a two-line fix and was tempting, but the fields
  that need adding are eleven, four of them are long-form rich text, and three
  belong to the term rather than the translation. A card carrying all of that
  is a full editor rendered inside a list row, once per row, with no route to
  deep-link to and no way to show one term at a time. The Tiptap-per-row cost
  goes up, not down.
- **Generalise the article editor behind props instead of writing a second
  editor.** Rejected for ADR-063's reason, which has not changed: the article
  machine is four states with a scheduling column, the content machine is seven
  with a review chain and no scheduling. The lesson editor already made this
  call and the glossary editor reuses _its_ panels, so the shared surface is
  `_components/editor/*` — which is exactly where those panels were moved to.
- **Give the glossary a `featuredTerms` curation column for the Popular
  rail.** Rejected as premature: it is an admin surface, a migration and a
  reorder UI for a rail whose reference implementation is alphabetical. If
  view counting lands and the ordering proves unhelpful, curation is the
  obvious next step and nothing here blocks it.
- **Increment `viewCount` from the term page.** Rejected — see item 4. It
  would mean either dropping `"use cache"` from a page that should be ISR
  (architecture.md #6) or writing from a cached render, and neither is worth a
  counter no screen reads yet.

## Compliance

- `requirePermission("glossary.view")` gates the editor route;
  `glossary.update` / `glossary.publish` / `glossary.delete` gate each write
  in its own action (security.md #1). `can()` only decides what renders.
- Rich text is sanitized server-side on save for **all four** prose fields —
  `sanitizeRichText` per field, not once over a join (security.md #8).
- `faq` is parsed through a Zod schema before it reaches the column; it is
  `Json?` and therefore the one field where a raw cast would be invisible
  (security.md #6).
- ADR-044 #5/#10 and ADR-057: no raw identifier renders, every dropdown is
  `AdminCombobox`, every dialog carries a `DialogTitle` and a
  `DialogDescription`.
- Public strings go through the `glossary` namespace, which is public and
  therefore enforced by `check:catalog-completeness` for every active locale.
- Tests: the prefill regression (a loaded term's fields arrive populated), the
  four-field source hash, `topicId` round-trip, the FAQ schema's rejections,
  and the Popular-rail ordering with all-zero counts.
