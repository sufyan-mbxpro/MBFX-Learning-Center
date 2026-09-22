# ADR-147 — Direct publish, a trash with permanent delete, and course FAQs

- **Status:** Accepted
- **Date:** 2026-09-22
- **Module:** 11 (content), 15 (articles)
- **Plan:** `docs/changes/changes-49.md` (owner request)
- **Amends:** the seven-state machine's "Notably ABSENT: DRAFT → PUBLISHED
  (must pass review)" (`CONTENT_TRANSITIONS`, Module 11); the soft-delete
  convention that a deleted row stays listed, dimmed.
- **Does not change:** the publish permission keys, the four-state article
  machine, or restore being unconfirmed (ADR-044 #7).

## Context

The owner asked for three things in the content admin:

1. "in courses & other sections there should be an option to publish
   directly.. maintain the others as well";
2. "add delete filter.. do not show deleted in all courses.. an option to
   delete permanently.. this delete option should follow all other modules";
3. "add the FAQ separately for the courses & add in the public site as well".

## Decision

1. **DRAFT, IN_REVIEW and SEO_REVIEW each reach PUBLISHED directly.** The
   review states stay for teams that use them. The review chain was never the
   authorisation — the entity's `*.publish` key is, and
   `transitionContentStatus` still requires it for PUBLISHED and SCHEDULED.
   SCHEDULED still requires APPROVED: a date on the calendar means the piece
   was reviewed. The editors' status panel lists legal moves, so "Publish"
   appears on a draft for anyone holding the key.
2. **A trash, on all six lists** (courses, lessons, quizzes, videos, glossary
   terms, articles). A soft-deleted row is hidden by default and listed only
   under a "Deleted" value of the list's own status filter (`DELETED_FILTER`,
   `_components/trash.tsx`). A status value rather than a separate switch,
   because "Published AND deleted" is always empty.
3. **Delete permanently is a second step.** `purgeContent` (`@repo/core`)
   refuses a row that is not already in the trash, requires the same
   `*.delete` key the soft delete does (re-checked in the service), removes the
   row with its cascading children, and drops the polymorphic
   `ContentReference` rows it held or was the target of — in one
   transaction — and audits `<entity>.purge`. Confirmed in the UI.
4. **A course carries its own FAQ**: `CourseTranslation.faq Json?`, the
   glossary term's `[{ question, answer }]` shape and caps (12 questions,
   plain text), per locale. Edited on a new FAQ tab of the course builder
   with the shared `FaqPanel`; rendered on the course page after the
   assessment with the shared public `FaqPanel`, and emitted as FAQPage
   JSON-LD whenever the course has questions.

## Consequences

- A team that relied on the machine to FORCE review must now withhold the
  publish key from authors — which was always the stronger control.
- A purge cannot be undone. `Redirect` rows that pointed at a purged
  address are left alone; they now resolve to a 404, as the page would.
- Articles filter the trash server-side (`?status=__deleted`); the other
  five lists filter the rows already on the page.
