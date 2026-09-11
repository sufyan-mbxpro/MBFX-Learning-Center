# changes-18 — plan: the admin's glossary section, the media picker, the quiz list, and two silent no-ops

**Brief:** `docs/changes/changes-14-admin-side-update.md` (owner, 2026-09-09).
**Date:** 2026-09-09
**Modules:** 11 (content), 09 (admin shell), 12 (public site), 04 (auth).
**Numbering:** 14 and 15 are the owner's brief placeholders, 16 is the
in-flight videos work and 17 shipped this morning. This takes 18.

**Status:** **PRs 1–7 SHIPPED, 2026-09-09/10** (ADR-070; DEVLOG entries of both
dates). What remains is not code:

- **§11 Q1 is unanswered** — "a divider between static or courses topics" has
  two readings and neither is built. Course-derived topics do not exist as a
  concept today.
- **§11 D2 is undecided** — `SCHEDULED` strands content on every entity except
  `Article`. Recommendation stands: remove it now, build real scheduling when
  it is wanted. Needs an ADR either way.
- **§11 Q2 is answered** — the seeded account is a super admin and holds
  `glossary.publish`. The publish failure was PR 1's defect alone.

Deviations from this plan as written, both recorded in ADR-070 and the DEVLOG:
the schema change went in via `migrate dev` rather than `db:reset` (widening a
column and adding a nullable one loses no data, so the reset policy did not
need invoking), and PR 5 grew `duplicateGlossaryTopic` alongside the two
duplicates it planned.

---

## 0. The brief, read literally

Every line of the brief, mapped to what I found in the repo and where it is
answered below. Nothing is dropped; two lines turn out to be defects rather
than requests.

| Brief line                                               | Finding                                                           | PR  |
| -------------------------------------------------------- | ----------------------------------------------------------------- | --- |
| Media popup wider, header a different colour             | `max-w-3xl`, 4-col grid, plain header                             | 6   |
| `/admin/glossary/topics` as a DataTable, CRUD, buttons   | It is a bespoke inline manager, not `DataTable`                   | 3   |
| Full rich text editor on a topic                         | `description` is `VarChar(500)` — needs a column change           | 3   |
| Topic CRUD reachable while adding a term                 | No inline create; the article editor already has the pattern      | 4   |
| Divider between "static" and "courses" topics            | **Could not resolve this from the brief** — §11 Q1                | —   |
| Slug autofill + validation as you type                   | Neither the topic manager nor the term editor autofills           | 3/4 |
| Update, publish, revert to draft, duplicate              | Topics have no status; no `duplicateGlossaryTerm` exists          | 3/5 |
| SEO keywords                                             | Topic translations have title/description, no keyword             | 3   |
| Manage the scheduled option                              | `SCHEDULED` is offered and **strands content** — §11 D2           | —   |
| How multilingual is managed                              | Machinery exists; the topic screen ignores it. ADR-043 answers it | 4   |
| Check the permissions of that section                    | Audited — wiring correct; one thing to confirm from the database  | 2   |
| Why glossary does not publish after APPROVED             | **Defect.** `submitForm` drops its argument                       | 1   |
| Public topic page: rich effects, hover, related, loading | Never got the design pass `/glossary` got on 2026-09-09           | 7   |
| Quiz badges colourful, active status, duplicate          | All three are `variant="outline"`; no duplicate action            | 5   |
| Signed out every 2–3 minutes                             | **Defect.** The proxy bounces a valid 7-day session               | 1   |

---

## 1. What I verified in the repo (2026-09-09)

Facts, with file and line. Everything below rests on these.

### The two defects

**D-1 — Publish is a silent no-op on glossary terms and video topics.**
`ContentStatusPanel` (`_components/editor/content-status-panel.tsx:96`) calls
`submitForm(to)` for the publishing transitions, so the panel saves the open
form and moves in one step. Four editors pass it a `submitForm`; **two of them
declare no parameter**:

| Editor                                     | Signature                           | Publishes? |
| ------------------------------------------ | ----------------------------------- | ---------- |
| `learn/courses/[id]/course-editor.tsx:180` | `async (thenTransitionTo?: string)` | yes        |
| `learn/lessons/[id]/lesson-editor.tsx:180` | `async (thenTransitionTo?: string)` | yes        |
| `learn/quizzes/[id]/quiz-editor.tsx:268`   | `async (thenTransitionTo?: string)` | yes        |
| `glossary/[id]/glossary-editor.tsx:161`    | `async ()` — **argument dropped**   | **no**     |
| `learn/videos/[id]/video-editor.tsx:142`   | `async ()` — **argument dropped**   | **no**     |

On a glossary term or a video topic, APPROVED → Publish saves the form,
reports success, and leaves the status where it was. That is exactly the
owner's report, and nothing catches it: TypeScript accepts a zero-parameter
function where a one-parameter one is expected, so the prop type
`(thenTransitionTo?: string) => Promise<void>` can never flag it, and no test
clicks Publish.

The video half shipped this morning with changes-16 and has the same bug for
the same reason — which is the argument for fixing the SHAPE rather than the
two call sites (§2 D1).

**D-2 — The admin bounces a valid session to sign-in every ~5 minutes.**
`packages/auth/src/index.ts:80` sets `session.cookieCache.maxAge = 5 * 60`
against `expiresIn: 60 * 60 * 24 * 7`. `proxy.ts`'s `staffGate` reads ONLY
that signed cookie (`getCookieCache`) and redirects to `/admin/sign-in`
whenever it does not yield `userType === "STAFF"`.

Nothing refreshes that cookie on an admin page view. Better Auth rewrites it
when its own handler runs; the admin surface reads the session inside a server
component (`(admin)/layout.tsx:74`), and a server component cannot set a
cookie in Next.js. So the cache expires five minutes after sign-in and is
never rewritten — the database session is valid for seven days, and the gate
turns the user away anyway.

This same expiry already broke Save once. That fix exempted `next-action`
requests only, and `staffGate`'s own comment describes the mechanism
precisely; the navigation half was simply left in place. The comment is the
evidence that this is a known-shaped bug, not a new theory.

### The glossary admin, as it stands

- `glossary/topics/page.tsx` renders `TopicsManager` — 291 lines of inline
  editing with per-row Save, keyboard reorder and a create dialog. It is not
  `DataTable`, so it has no search, no column visibility, no pagination and no
  toolbar filters (code-style.md #9 is written for the table screens).
- `GlossaryTopic` (`schema.prisma:1201`) has `isActive` + `sortOrder` and no
  `status`. Its translation carries `name`, `slug`, `description`
  **VarChar(500)**, `seoTitle`, `seoDescription`. No keyword field. D27 built
  it to mirror `ArticleCategory` exactly, deliberately.
- `GlossaryTerm` (`schema.prisma:1163`) runs the seven-state machine and has
  no `scheduledFor`.
- There is no `duplicateGlossaryTerm` and no `duplicateQuiz`;
  `duplicateArticle` (`articles.ts:716`) and `duplicateLesson`
  (`lessons.ts:563`) are the two precedents to copy.

### Permissions (the brief's "check the permissions of that section")

Audited end to end, and the wiring is correct: `glossary/topics/page.tsx`
gates on `glossary.view` and passes `can()` results down for display only;
every write re-gates in its own action (`_actions/glossary-topic-actions.ts`),
which is security.md #1 satisfied. `glossary.publish` exists in the registry
(`seed.ts:48`) and the service enforces it (`content.ts:87`).

One thing to confirm from the database rather than assume, because it is a
plausible SECOND cause of the owner's publish report: `seed.ts:196` is the
only place a role is granted `glossary.publish`. If the owner's account holds
`glossary.update` but not `glossary.publish`, `ContentStatusPanel` correctly
hides Publish — a different symptom with the same description. Both causes are
real and independent; D-1 is a defect regardless of the answer.

### The quiz list

`learn/quizzes/quizzes-table.tsx:210-214` renders "standalone", the category
and "deleted" as three identical `variant="outline"` badges. `StatusBadge`
already carries tone, and `Badge` gained `success`/`warning`/`info` variants
in the learn design pass, so the vocabulary exists. `RowActions` (line 85)
offers Edit and delete/restore — no duplicate.

### The public topic page

`(public)/[locale]/glossary/topics/[topic]/page.tsx` is 102 lines: metadata, a
feature check, a `Container` and a list. It predates the 2026-09-09 glossary
design pass (ADR-069), which is why it looks nothing like `/glossary`.

---

## 2. Decisions this plan takes

**D1 — The publishing panel sequences save-then-transition itself.** Rather
than fix two call sites, `ContentStatusPanel` stops depending on a caller
honouring an argument it cannot be forced to accept. It takes
`save: () => Promise<void>` and `transitionTo: (to: string) => Promise<void>`
and does `await save(); await transitionTo(to)` for the publishing moves —
exactly the sequencing it already decides. The bug becomes unrepresentable
rather than guarded, which is why this plan adds no test asserting "the editor
passed the argument": there is no argument left to drop.

**D2 — Topics stay taxonomy; they do not get the seven-state machine.** The
brief asks for "publish & revert to draft" on topics. D27 built
`GlossaryTopic` as a mirror of `ArticleCategory`, and a category is an
attribute of content, not content — giving it review, SEO review, approval and
scheduling would allow a topic to be APPROVED but invisible while the terms
filed under it are live, a state no reader can make sense of. So `isActive`
remains the one switch and the SCREEN says Published / Draft, with the toggle
in the table and in the editor. That is display-only framing of an existing
boolean, the way ADR-044 #5 already governs. **If the owner wants a real
review workflow on topics, that is its own PR with an ADR** — not a small
change.

**D3 — Rich text on a topic means a column change and a sanitizer.**
`description` becomes `Text`, is edited with the shared `RichTextEditor`, and
is sanitized server-side on save (security.md #8). It is also rendered on the
public topic page, so `getGlossaryTopicBySlug` must stop treating it as a
plain string — ADR-069 recorded this exact bug for `simpleExplanation` (raw
tags rendered as text, and A–Z search matched tag names). Pre-launch reset, no
backfill.

**D4 — A topic gets `seoKeywords`, not `seoFocusKeyword`.** The brief says
"seo keywords", plural. `Lesson` and `Article` carry a single
`seoFocusKeyword` because `SeoAnalysis` scores prose against one focus term; a
topic page has no prose to score. So the field is a plain
`seoKeywords VarChar(255)` used for the meta tag only, and `SeoAnalysis` is
not rendered on the topic editor. Naming it `seoFocusKeyword` would promise an
analysis that is not there.

---

## 3. PR 1 — the two defects (no ADR; both are bugs)

Ships first and alone. Neither depends on anything below, and one of them is
making the admin unusable.

| File                                                | Change                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `_components/editor/content-status-panel.tsx`       | Prop `submitForm` → `save`; the panel does `await save(); await transitionTo(to)` for `PUBLISHING` moves.    |
| `glossary/[id]/glossary-editor.tsx`                 | Pass `save={submitForm}`. Its signature is already correct once the parameter is the panel's business.       |
| `learn/videos/[id]/video-editor.tsx`                | Same.                                                                                                        |
| `learn/{courses,lessons,quizzes}/[id]/*-editor.tsx` | Drop the now-dead `thenTransitionTo` parameter and its trailing `if (thenTransitionTo) await set…Status(…)`. |
| `apps/web/proxy.ts`                                 | `staffGate`: when the cookie cache is absent but a Better Auth **session cookie is present**, return `null`. |

On the proxy change — the alternatives, and why not them:

- _Raise `cookieCache.maxAge`._ Does not fix it. The cache still expires and
  is still never rewritten during an RSC render; it only lengthens the
  interval between bounces, and it makes revocation staler.
- _Call `auth()` in the proxy and rewrite the cookie._ Puts Prisma and a DB
  round-trip on every admin request and makes the proxy decide, which
  architecture.md #3 forbids.
- _What this does instead._ An anonymous request (no session cookie at all) is
  still turned away at the edge, which is the case the gate exists for. A
  request that HAS a session falls through to `(admin)/layout.tsx:74`, which
  already loads the subject from the database and redirects a non-STAFF user.
  That is ADR-006's own division of labour — the proxy is a gate, the layout
  is the boundary — so this restores the intended design rather than bending
  it. A learner now meets a server-side redirect instead of an edge one: one
  extra hop, no access.

**Tests**

- `content-status-panel.test.tsx` (NEW): clicking Publish calls `save` and
  then `transitionTo("PUBLISHED")`, in that order; Archive confirms first and
  calls `transitionTo` only.
- `proxy.test.ts`: no cookie at all redirects; a session cookie with a stale
  cache falls through; `/admin/sign-in` is untouched.
- Manual, in the running app: sign in, sit on `/admin/glossary` past six
  minutes, navigate — no bounce. Take a term APPROVED → Publish and confirm it
  reads PUBLISHED and appears on `/glossary`.

---

## 4. PR 2 — the permission audit, written down

Evidence only; no product change unless it finds one.

- Query which seeded roles hold `glossary.publish`, `glossary.create`,
  `glossary.update`, `glossary.delete`. Recorded in the DEVLOG entry.
- If a content-editor role holds `glossary.update` but not `glossary.publish`,
  that is a seed decision to confirm with the owner, not a bug to fix
  silently.
- `check:permission-keys` already proves every key rendered exists; this adds
  the other half — that a key gating a button is actually held by someone.

---

## 5. PR 3 — `/admin/glossary/topics` becomes a table plus an editor

| File                                                 | Change                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/db/prisma/schema.prisma`                   | `GlossaryTopicTranslation.description` → `String? @db.Text`; add `seoKeywords String? @db.VarChar(255)`.        |
| migration + `pnpm db:reset`                          | Pre-launch policy: reset, no backfill.                                                                          |
| `packages/contracts/src/glossary.ts`                 | `saveGlossaryTopicSchema` — topic fields plus one translation, mirroring `saveGlossaryTermSchema`.              |
| `packages/core/src/content.ts`                       | `saveGlossaryTopic(actor, input)` (one transaction, sanitized description); `loadGlossaryTopicAdminDetail(id)`. |
| `packages/core/src/content.ts`                       | `duplicateGlossaryTopic(actor, id)` — every translation, `isActive: false`, suffixed slug.                      |
| `admin/glossary/topics/topics-table.tsx` (NEW)       | `DataTable`: name, slug, terms, status, updated; toolbar search + status filter (code-style.md #9).             |
| `admin/glossary/topics/[id]/page.tsx` + editor (NEW) | Editor route modelled on the term editor: rich-text description, SEO section, published/draft switch.           |
| `admin/glossary/topics/topics-manager.tsx`           | DELETED. Its keyboard reorder becomes Move up / Move down row actions (plan §8.2 — no DnD dependency).          |
| `admin/_components/slug-field.tsx` (NEW)             | Autofills from the name while untouched, stops on manual edit, validates the shape as you type.                 |

`SlugField` is extracted rather than written once: PR 4 puts it on the term
editor too, and the article and lesson editors are the next call sites. Its
validation imports the contract's own slug rule — never a second regex.

**Tests:** `content.test.ts` — topic round-trip, description sanitized on
save, a duplicate is inactive with unique slugs per locale;
`slug-field.test.tsx` — autofills, then respects a manual edit.

---

## 6. PR 4 — multilingual, and topics reachable while writing a term

**Multilingual is already answered by ADR-043** and needs no new decision: the
`GlossaryTopicTranslation` table exists, only `en` is active, and the admin is
English-only by design. So this PR is machinery, not policy:

- The topic editor gets the locale switcher the term editor already has,
  writing one translation row per locale.
- `TranslationForm` is not resurrected — ADR-069 deleted it for cause.
- The public topic page already resolves through `pickTranslation`, so
  activating a locale stays a data change plus a catalog.

**Inline topic creation** — the term editor's topic combobox gains a "Create
topic" affordance, the same shape as the article editor's inline category and
tag creation (changes-10, ADR-046). It creates name + slug only and re-gates
on `glossary.create`; the editor is where the rest gets filled in.

---

## 7. PR 5 — the quiz list, and duplicate for quizzes and terms

- `quizzes-table.tsx`: "Listed publicly" and the category badge become tonal.
  Reuse `categoryTone()` — it already derives a tone from the free-text
  `Quiz.category` on the public quiz card, so admin and public cannot drift.
  `deleted` becomes `destructive`.
- Add an explicit **Active** column (visibility and not deleted), so the
  brief's "there should be active status" is a column rather than an inference
  from badges.
- `duplicateQuiz` and `duplicateGlossaryTerm` in `@repo/core`, modelled on
  `duplicateLesson` (`lessons.ts:563`): copy every translation, force `DRAFT`,
  suffix the slug, never copy `publishedAt` or attempt counts. Row action in
  both tables and in both editors' header menus, matching the article editor.

**Tests:** `quizzes.test.ts` / `content.test.ts` — a duplicate is DRAFT, has
no `publishedAt`, carries every translation, and no attempts follow it.

---

## 8. PR 6 — the media picker

- `media-picker-dialog.tsx`: `max-w-3xl` → `max-w-5xl`, a taller grid
  (`max-h-[70vh]`) and 3/5 columns at `sm`/`lg`. The thumbnails are the point
  of the dialog and currently get a quarter of a 48rem box.
- The header gets a toned band, reusing `EditorSection`'s accent treatment
  rather than a new colour: no hex literals (code-style.md #1), and the admin
  already has a vocabulary for "this band means something".
- `DialogTitle` and `DialogDescription` stay (ADR-057 #5 guards them).

---

## 9. PR 7 — the public glossary topic pages

`/glossary/topics` and `/glossary/topics/[topic]` get the pass ADR-069 gave
`/glossary`, reusing its parts rather than inventing any:

- `PageHero` masthead with generated art (ADR-047 §3 — the sixth instance;
  the generator is `scripts/lib/art.mjs`, output is committed and
  byte-deterministic, never hand-edited).
- Topic cards with the `.sheen` treatment and a stretched title link. **Any
  control besides the title stays `relative z-10`** — `course-card.test.tsx`
  and `quiz-card.test.tsx` both exist because that rule was learned twice.
- The brief's "clearly show the category exists": term cards on a topic page
  carry the topic badge, and the page opens with a counted stat strip.
- Related / suggested: the other topics, ordered by `sortOrder`, current one
  marked and unlinked — the `ArchiveTaxonomy` pattern from /news, not a new
  recommender.
- `loading.tsx` for both routes; every other learn route has one.
- Prose measure is `Container size="narrow"`, never a `max-w-*` utility — it
  loses to `.container-page` at equal specificity (ADR-069's own finding).

---

## 10. Criterion → test

| Criterion                                           | Test                                              |
| --------------------------------------------------- | ------------------------------------------------- |
| Publish moves a glossary term to PUBLISHED          | `content-status-panel.test.tsx` + manual in-app   |
| Publish moves a video topic to PUBLISHED            | the same panel test — one component, both callers |
| A valid session survives past 5 minutes of browsing | `proxy.test.ts` stale-cache case + manual         |
| An anonymous request is still turned away           | `proxy.test.ts` no-cookie case                    |
| A topic's rich description is sanitized             | `content.test.ts` — script tag in, stripped out   |
| A duplicated quiz/term is DRAFT and unpublished     | `quizzes.test.ts`, `content.test.ts`              |
| Slug autofills, then respects a manual edit         | `slug-field.test.tsx`                             |
| The topic table filters and searches                | RTL smoke on `topics-table.tsx`                   |
| Public topic pages have no serious/critical a11y    | axe, added to the Module 14 suite                 |

---

## 11. Open questions — owner

**Q1. "there should be devider between static or courses topic..both can be
added."** I could not resolve this, and the two readings build different
things:

(a) The topic PICKER groups topics into a "glossary topics" group and a
"course topics" group with a separator — which implies course-derived topics
exist as a concept. Today they do not: `GlossaryTopic` has no relation to
`Course`.
(b) The topics TABLE separates seeded/static topics from ones an editor
created — a provenance flag, not a relation.

Neither is built. Which is it?

**D2 (a decision, not a question). The `SCHEDULED` state strands content
today.** `CONTENT_TRANSITIONS` offers APPROVED → SCHEDULED for every content
entity, and **no entity except `Article` has a `scheduledFor` column; nothing
anywhere publishes a scheduled row.** So a term or lesson moved to SCHEDULED
sits there permanently — it is not scheduled, it is parked. This is plausibly
the other half of the owner's publish report. Three ways out:

1. **Implement it** — `scheduledFor` on the content entities plus a cron or
   worker route that publishes due rows. Real scheduling, real infrastructure,
   its own ADR; the repo has no scheduled jobs at all today (the term of the
   day is deterministic precisely to avoid one).
2. **Remove `SCHEDULED`** from the transition map for the entities that cannot
   honour it, so the button stops appearing. One line, honest, reversible.
3. Leave it and document the trap.

My recommendation is **2 now, 1 when scheduling is genuinely wanted** — a
button that silently parks content is worse than no button. But this changes a
map the repo calls frozen, so it needs the owner's word and an ADR either way.

**Q2. Does the owner's own admin account hold `glossary.publish`?** PR 2
answers it from the database. If it does not, that is a seed question: should
the content-editor role publish glossary terms, or is publishing reserved?
