# ADR-063: The seven-state content machine gets its own publishing panel

**Status:** Accepted
**Date:** 2026-09-08
**Module:** 11 (content system — course builder and lesson editor), 09 (admin shell)
**Supersedes:** — (corrects one row of `docs/changes/changes-11-plan.md` §8.3)
**Superseded by:** —

**On the number.** 058 is reserved for quizzes by `changes-11-plan.md` §14 and
by three DEVLOG entries, and 059–062 are reserved for the media platform by
`changes-12-plan.md` §3. The DEVLOG is append-only, so those references cannot
be repointed. This ADR therefore takes the next number clear of both
reservations rather than colliding with history.

## Context

`changes-11-plan.md` §8.3 specifies the lesson editor as a reuse of the article
editor, panel by panel, and lists:

| Panel   | Source                                                        |
| ------- | ------------------------------------------------------------- |
| Publish | `_panels/publish-panel.tsx` — as-is (status machine, ADR-053) |

That row is mistaken on a point of fact, and the mistake only becomes visible
when you put the two status machines side by side.

`publish-panel.tsx` drives the **article** machine, which
`packages/core/src/articles.ts` defines as four states:

```
DRAFT → SCHEDULED → PUBLISHED → ARCHIVED
```

Courses and lessons do not use that machine. They use `CONTENT_TRANSITIONS` in
`packages/core/src/content.ts`, which is seven states and enforces a review
chain that the article machine has no concept of:

```
DRAFT → IN_REVIEW → SEO_REVIEW → APPROVED → SCHEDULED / PUBLISHED → ARCHIVED
```

Three concrete consequences follow:

1. **Three transitions have no button.** `IN_REVIEW`, `SEO_REVIEW` and
   `APPROVED` are absent from `publish-panel.tsx`'s `TRANSITION_VARIANT` and
   `TRANSITION_ICON` maps, so a course sitting in `DRAFT` would render one
   unstyled fallback button and no way to reach `PUBLISHED` at all — the
   machine forbids `DRAFT → PUBLISHED` directly.
2. **Half the panel is dead on arrival.** Its `datetime-local` field and the
   four scheduling presets write a `scheduledFor` value, and neither `Course`
   nor `Lesson` has a `scheduledFor` column. `transitionContentStatus` takes no
   such argument. The control would collect a date and silently drop it.
3. **It is bound to the wrong action.** It imports `transitionArticleAction`
   directly, which gates on `analysis.update` / `news.manage` and dispatches to
   `transitionArticle`. A course cannot route through it.

So "as-is" was never available. The real choice was between generalising
`publish-panel.tsx` behind props and writing a second panel.

## Decision

**A second panel: `app/(admin)/admin/_components/editor/content-status-panel.tsx`,
used by the course builder and the lesson editor.** `publish-panel.tsx` stays
exactly as it is and keeps serving the article editor.

Generalising the article panel was rejected. It would need an injected
transition callback, an injected tone/icon map, an injected status-tone map,
and a flag for whether scheduling exists — four props whose only job is to turn
half the component off. The result is one file where every reader has to work
out which caller each branch belongs to, in exchange for saving about eighty
lines of markup.

**What is deliberately kept identical**, because these are decisions rather
than markup:

- **ADR-053 holds in full.** A transition that puts content in front of readers
  (`PUBLISHED`, `SCHEDULED`) runs the editor's `submitForm(to)` — save first,
  then transition — so publishing ships what is on screen, never what was last
  written. Transitions that take content down or move it through review do not
  save, because an implicit save there is only a surprise.
- **The two calls stay SEQUENCED, not merged.** The transition still goes
  through `transitionContentStatus`, which checks `courses.publish` /
  `lessons.publish` against the same subject, so no save can publish on behalf
  of an actor who may not (security.md #1).
- **Colour carries consequence** (ADR-046), and **archiving confirms** — it is
  the one transition that takes a live URL off the site.

One behaviour is new, because the wider machine makes it reachable: when an
actor's legal transitions filter down to nothing — `PUBLISHED` without
`courses.publish`, whose only legal move is `ARCHIVED` — the panel says so
rather than rendering an empty button row that reads as a rendering bug.

A new `CONTENT_STATUS_TONE` map joins `ARTICLE_STATUS_TONE` in
`status-badge.tsx` rather than the two being merged, for the same reason: a
union map would hand an article a tone for a state it can never reach.

## Consequences

- `changes-11-plan.md` §8.3's Publish row is superseded by this ADR. Every
  other row of that table stands and was implemented as written — the body is
  `rich-text-editor.tsx` as-is, the SEO analysis is `seo-analysis.tsx` as-is.
- Three panels moved from `app/(admin)/admin/articles/[id]/_panels/` to
  `app/(admin)/admin/_components/editor/` so the reuse is honest rather than a
  reach into another route's colocated folder: `editor-section.tsx`,
  `seo-analysis.tsx`, `content-stats.tsx`. No behaviour changed; the article
  editor's imports were rewritten in the same PR.
- Glossary also runs the seven-state machine and has no editor screen yet. When
  it gets one it should use this panel, not the article's.
- If a future course or lesson genuinely needs scheduled publishing, it needs a
  `scheduledFor` column and a due-publisher first (`publishDueArticles` is the
  precedent). Adding a date field to this panel without those would repeat the
  defect this ADR is recording.
