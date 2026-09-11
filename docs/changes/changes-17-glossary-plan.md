# changes-17 — Glossary: term editor + presentation pass

**ADR:** ADR-069. **Modules:** 11 (admin), 12 (public).
**Numbering:** 14/15/16 are taken — `changes-14-admin-side-update.md` and
`changes-15-public-site.md` are the owner's reserved (empty) placeholders and
`changes-16-plan.md` is the in-flight videos work. This takes 17 to avoid
clobbering any of them.

## Why

Three defects and one absence, all in ADR-069 §Context:

1. `TranslationForm` cannot edit — `useState("")`, and the loader does not
   select the body. Fixing a typo means rewriting the definition.
2. It writes `simpleExplanation` and nothing else. Ten other columns have no
   write path; five have had none since Module 01.
3. `GlossaryTerm.topicId` is unwritable from the admin, so D27's
   `/glossary/topics` renders empty on every database and `GlossaryTabs` has
   never appeared.
4. `/glossary` and `/glossary/[term]` never got the presentation pass that
   /news (2026-09-07) and /learn (2026-09-09) had.

## PR order

### PR 1 — contracts + core write path

| File                                 | Change                                                                                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/glossary.ts` | NEW. `glossaryFaqSchema`, `saveGlossaryTermSchema` (term-level + one translation), `GLOSSARY_FAQ_MAX`.                                                                           |
| `packages/core/src/content.ts`       | `saveGlossaryTerm(actor, input)` — one transaction, term fields + translation. `saveGlossaryTranslation` delegates to it. Source hash covers **four** prose fields (ADR-069 §2). |
| `packages/core/src/content.ts`       | `loadGlossaryTermAdminDetail(id)` — every field, every locale's translation, `legalTransitions`, topic.                                                                          |
| `packages/core/src/content.ts`       | `loadGlossaryAdminList` — add `topicName`, `track`, `difficulty`, `updatedAt` for the table.                                                                                     |

Tests: `content.test.ts` — prefill regression (detail returns stored body),
four-field hash, FAQ schema rejections, `topicId` round-trip.

### PR 2 — admin editor route

| File                                      | Change                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `_actions/content-actions.ts`             | `saveGlossaryTermAction`, `createGlossaryTermAction(topicId?, track?)`.                                                         |
| `admin/glossary/[id]/page.tsx`            | NEW. Read gate, loader, label map — `lessons/[id]/page.tsx` shape.                                                              |
| `admin/glossary/[id]/glossary-editor.tsx` | NEW. Locale switcher; four rich-text bodies; topic/track/difficulty; SEO.                                                       |
| `admin/glossary/[id]/editor-types.ts`     | NEW.                                                                                                                            |
| `_components/editor/faq-panel.tsx`        | MOVED from `articles/[id]/_panels/` and made generic over its item type — the host supplies `makeItem`. Beat copying 300 lines. |
| `admin/glossary/glossary-table.tsx`       | NEW. `DataTable`, toolbar filters (status/topic/track) per code-style #9.                                                       |
| `admin/glossary/page.tsx`                 | List → table. Inline `TranslationForm` **deleted**.                                                                             |
| `admin/glossary/glossary-controls.tsx`    | `NewTermDialog` (topic + track, `DialogTitle` + `DialogDescription`).                                                           |
| `packages/i18n/messages/en.json`          | `admin.*` keys — English-only (ADR-043 #2).                                                                                     |

### PR 3 — public core loaders

`packages/core/src/public-content.ts`: `getGlossaryTopicOfTheDay`,
`getPopularGlossaryTerms` (`viewCount DESC, term ASC` — ADR-069 §4),
`getRelatedGlossaryTerms(termId)` (same topic, then same track).
`GlossaryTermView` gains `topicName`/`topicSlug`/`track`/`difficulty`/
`advancedExplanation`/`exampleScenario`/`faq`.

### PR 4 — `/glossary` index

Masthead (`PageHero` + generated backdrop, ADR-047 §3 fifth instance), counted
stat strip, **Term of the day + Topic of the day** pair, unchanged
`GlossaryBrowser` beneath. `glossary.*` catalog keys (public — enforced).

### PR 5 — `/glossary/[term]`

Breadcrumb → `PageHero` band → badges (topic, difficulty) → the four prose
fields + FAQ → related terms → closing block: A–Z chips and Popular terms.
No search input and no `CtaBand` — see ADR-069.

### PR 6 — art, tests, DEVLOG

`apps/web/scripts/generate-glossary-art.mjs` on the shared `scripts/lib/art.mjs`
engine; `_content/glossary-media.ts`. RTL + axe smoke deferred to Module 14 with
the rest of the learn area's.

## Criterion → test

| Criterion                                        | Test                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Loading a term prefills every field              | `content.integration.test.ts` — detail round-trip                                        |
| An example-only edit flips siblings OUTDATED     | `content.integration.test.ts` — four-field hash                                          |
| A term can be filed under a topic from the admin | `content.integration.test.ts` — `topicId` round-trip                                     |
| Malformed FAQ is rejected before the column      | `contracts/glossary.test.ts`                                                             |
| Popular rail is stable with all-zero counts      | ordering is `viewCount DESC, term ASC`; covered by review, not a test — every count is 0 |
| Null topic ≠ null track in the editor            | `content.integration.test.ts` — both round-trips + undefined-means-untouched             |
| Every dialog has a title AND a description       | existing `admin-dialog-conventions.test.ts`                                              |

## Not in scope

- `viewCount` increment (ADR-069 §4 — belongs with analytics).
- Topic curation / featured-term column (ADR-069 Alternatives).
- E2E for either surface — Module 14, with the rest.
