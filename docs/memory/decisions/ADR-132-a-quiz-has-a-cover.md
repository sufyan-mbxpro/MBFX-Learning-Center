# ADR-132: A quiz has a cover image

**Status:** Accepted
**Date:** 2026-09-17
**Module:** 11 (content), 12 (public site)
**Plan:** owner request, 2026-09-17
**Supersedes:** the quiz-index design pass (2026-09-09, no ADR), on one point
only: "a quiz has no cover column and is never getting one"
(`learn-media.ts`). The deterministic panels stay, as the fallback.
**Superseded by:** —

## Context

The quiz index shows every card with one of four generated panels, picked by
hashing the slug. The 2026-09-09 pass decided a quiz would never have editor
artwork: a quiz is a set of questions, not a publication, so no editor would
have an opinion about its picture.

The owner has one. Their feedback was that the cover image is missing and that
an editor should be able to add or change it. Courses and video topics already
have an upload field, and the quiz editor was the only learn editor without
one.

## Decision

1. **`Quiz.coverAssetId String?`** holds a MediaAsset id, not a URL. This
   follows `Course.coverAssetId` (ADR-055 #6) and uses a plain String column,
   because MediaAsset carries no back-relations (ADR-035).
2. **The cover is a `ContentReference`** under a new `ReferenceSourceType.QUIZ`,
   written by `saveQuiz` in the same transaction. `deleteMedia()`'s in-use
   guard then protects the asset, as it protects a course cover. Clearing the
   cover writes an empty set, so the reference is removed with it.
   `duplicateQuiz` copies the cover and writes the copy its own reference.
   `mediaSourceTypeSchema` gains `QUIZ`, and the drift guard in `media.test.ts`
   holds the two lists together.
3. **The generated panels are the fallback, not a default someone must
   remove.** `quizCoverUrl(slug, coverUrl)` returns the uploaded cover when it
   resolves, otherwise the slug-hashed panel. A quiz nobody edits looks
   exactly as it did. A deleted asset resolves to null in the loader and falls
   back too, never to a broken image.
4. **The cover belongs to the quiz, not to a language.** The field sits in the
   editor's Details section and is hidden while a translation is being
   edited, the same split the question structure follows.
5. **Optimisation follows the file.** The card passes `unoptimized` only for an
   SVG or a generated panel. An uploaded raster cover goes through
   `next/image`, as a course cover does.

## Consequences

- One migration: `20260917230000_quiz_cover_adr132` (a nullable column and
  one enum member).
- No permission key is added. The cover is saved by `saveQuizAction` under the
  existing `lessons.update` gate (ADR-058, quizzes reuse the lesson keys).
- The quiz runner page and its Open Graph image still do not show the cover.
  That is a separate change if it is wanted.
