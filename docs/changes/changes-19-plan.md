# changes-19 — scheduled publishing becomes real

**Brief:** `changes-18-plan.md` §11 D2, answered by the owner on 2026-09-10:
**implement real scheduling.** §11 Q1 was answered in the same pass — see §6.
**ADR:** ADR-071. **Modules:** 11 (content), 12 (public site), 01 (db), 09 (admin shell).
**Date:** 2026-09-10

**Status: COMPLETE — PRs 1–5, shipped 2026-09-10/11** (DEVLOG 2026-09-11).
PR 5 ran the gate over PRs 1–4 for the first time and found four defects it
fixed in the same pass: a one-`..`-short import that made `@repo/web`
typecheck red on the article editor, three admin readers declaring
`scheduledFor` without selecting or mapping it, a changes-18 guard left red by
PR 4's two-argument `transitionTo`, and a schedule that survived
SCHEDULED → APPROVED — a move the article machine this copied does not have.
Nothing else in the plan changed shape. What is still owed is E2E (Module 14)
and a deployment caller for `/api/cron/publish-due`; ADR-071 #1 is why the
absence of one breaks nothing.

## Why

`APPROVED → SCHEDULED` is offered on `Course`, `Lesson`, `Quiz`,
`GlossaryTerm` and `VideoTopic`. None of them has a `scheduledFor` column, no
public query looks for one, and nothing publishes a due row. Content moved
there is parked, not scheduled, and the editor is never asked _when_.

`Article` has the whole mechanism already (ADR-015 #6) and it is the design
this copies rather than reinvents — including its best property: **visibility
is decided in the query, so a scheduled row is live at its minute whether or
not any job runs.**

## PR order

### PR 1 — schema

| File                               | Change                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/prisma/schema.prisma` | `scheduledFor DateTime?` + `@@index([status, scheduledFor])` on `Course`, `Lesson`, `Quiz`, `GlossaryTerm`, `VideoTopic`. |
| migration                          | Additive and nullable → `migrate dev`, no reset (the changes-18 precedent).                                               |

### PR 2 — core: the transition and the visibility rule

| File                                   | Change                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/content.ts`         | `ScheduleInPastError` moves here (one definition); `transitionContentStatus(actor, entity, id, to, scheduledFor?)`; `publishDueContent(now)`. |
| `packages/core/src/articles.ts`        | Re-export `ScheduleInPastError` from `content.ts` — no behaviour change.                                                                      |
| `packages/core/src/public-courses.ts`  | `publicCourseWhere(now)` / `publicLessonWhere(now)` gain the `OR`.                                                                            |
| `packages/core/src/quizzes.ts`         | `publicQuizWhere(now)`.                                                                                                                       |
| `packages/core/src/videos.ts`          | `publicVideoWhere(now)`.                                                                                                                      |
| `packages/core/src/public-content.ts`  | New `publicGlossaryTermWhere(now)`; the four inline clauses use it.                                                                           |
| `packages/core/src/glossary-topics.ts` | The three term-count clauses use it too — a topic's count must agree with its page.                                                           |
| `packages/core/src/public-articles.ts` | `effectivePublishedAt` moves to `content.ts` and is re-exported; learn readers use it.                                                        |

Every caller passes `now` explicitly. **No defaulted `new Date()` inside a
`"use cache"` function** — it would freeze the cache entry's creation time
into the query (ADR-071 Consequences).

### PR 3 — the sweep gets a caller

| File                                         | Change                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/web/app/api/cron/publish-due/route.ts` | NEW. `POST`, `CRON_SECRET` bearer compared with `timingSafeEqual`, runs both sweeps, returns counts. |
| `.env.example`                               | `CRON_SECRET=` (name only, security.md #10).                                                         |

No `requirePermission()` — there is no subject. Absent secret ⇒ 503, never
open. The route is `force-dynamic` and returns `no-store`.

### PR 4 — the panel and the five actions

| File                                             | Change                                                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `_components/editor/content-status-panel.tsx`    | `datetime-local` + presets when SCHEDULED is legal; `transitionTo(to, scheduledForIso?)`; renders `scheduledAt`. |
| `_actions/{learn,quiz,video,content}-actions.ts` | The five status actions take `scheduledForIso?` and parse it with `z.coerce.date()`.                             |
| The five editors                                 | Pass it through; show `scheduledFor` in the panel.                                                               |
| `packages/i18n/messages/en.json`                 | `admin.*` schedule keys — English-only (ADR-043 #2).                                                             |

### PR 5 — tests, DEVLOG, skills

## Criterion → test

| Criterion                                                          | Test                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| SCHEDULED without a future date is refused                         | `content.integration.test.ts` — `ScheduleInPastError` |
| A due SCHEDULED row is publicly visible before any sweep           | `content.integration.test.ts` — the load-bearing one  |
| An un-due SCHEDULED row is invisible                               | same                                                  |
| The sweep flips a due row exactly once, stamping the promised time | `content.integration.test.ts`, mirroring `articles`'  |
| A move that is not itself a schedule clears `scheduledFor`         | `content.integration.test.ts`                         |
| The cron route refuses a wrong/absent secret                       | `route.test.ts` — 401 and 503                         |
| The panel sends the date only for SCHEDULED                        | `content-status-panel-contract.test.ts`               |

## Not in scope

- Recurring schedules, unpublish-at, a timezone picker (ADR-071).
- Sub-five-minute punctuality — `cacheLife` sets the floor, deliberately.
- E2E, which Module 14 already owes every one of these screens.

## §6 — changes-18 §11 Q1, answered

The owner's answer: **neither reading — no divider.** Ship only the inline
"Create topic" affordance, which changes-18 PR 4 already delivered. Course-derived
topics are not a concept, no provenance flag is added, and the topic picker
stays one flat list. `changes-18-plan.md` §11 Q1 is closed as declined, not
deferred; reopening it needs a fresh brief.
