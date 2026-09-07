# ADR-053: Publishing an article is save-then-publish, and the button that says so is the only one

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 15 (News & Analysis — article editor)
**Supersedes:** — (revises the split recorded in `publish-panel.tsx`'s header
comment and implied by `docs/changes/changes-07-plan.md` §1.2 item 7)
**Superseded by:** —

## Context

The owner's report: "There are 2 publish buttons, one is only publish & 1 is
update & publish button — these should perform same functionalities."

They are not two buttons for one job. They were two halves of one job, and
neither half announced that it was a half:

| Button                          | Called                    | Did                                  | Did NOT                  |
| ------------------------------- | ------------------------- | ------------------------------------ | ------------------------ |
| Header **"Update & Publish"**   | `saveArticleAction`       | Saved every panel in one transaction | Change the status. Ever. |
| Publish panel **"Publish now"** | `transitionArticleAction` | Flipped the status                   | Save the open form       |

Two defects follow directly, and both are invisible to every check in the repo:

1. **The header button's label was false.** An author writing a draft filled
   in the screen, clicked a button reading "Update & Publish", got a "Saved"
   toast, and the post was still a draft. Nothing on the screen said the
   publish had not happened.
2. **"Publish now" published the wrong bytes.** It read no form state, so with
   unsaved edits on screen it put the LAST-SAVED body in front of readers.
   The author's screen and the public page disagreed, and the screen looked
   right.

`publish-panel.tsx` recorded the reason for the split:

> Lifecycle transitions are deliberately NOT part of the header's single save:
> publishing is a state machine with its own permission gate
> (`articleKindPermission(kind, "publish")`), and folding it into a content
> save would mean every autosave-shaped action could publish.

That reasoning protects something real, and this ADR keeps it. But it does not
support the shipped behaviour, for two reasons found on inspection:

- **The gate is enforced in `transitionArticle`, not by the buttons' being
  separate.** Sequencing two calls from one click does not merge them; the
  transition still runs its own `articleKindPermission(kind, "publish")` check
  and `assertArticleTransition`. Nothing about a shared click loosens that.
- **There is no autosave on this screen.** `save` is called from exactly one
  `onClick`. The "autosave-shaped action" the comment feared does not exist,
  so the split was paying a real usability cost to avoid a hypothetical one.

## Decision

### 1. One operation: save, then transition

`article-editor.tsx` exposes `submitForm(thenTransitionTo?, scheduledForIso?)`
— `await saveArticleAction(buildPayload())`, then, if asked, `await
transitionArticleAction(...)`. The header button and the publish panel both
run it. That is the whole of "these should perform same functionalities":
publishing now always ships what is on screen.

The two calls are **sequenced, not merged.** No service changes. The publish
permission gate, the legality check and the separate audit rows
(`articles.save` and `articles.transition`) are untouched — which is what lets
this reverse the split's _conclusion_ while keeping its _premise_.

### 2. The header button's label states what the click will do

It is no longer the fixed string "Update & Publish":

- **"Publish"** when the post is a `DRAFT`, the actor may publish, and
  `PUBLISHED` is a legal transition — the click saves and publishes.
- **"Update"** otherwise — the click saves. For an already-published post this
  IS save-and-publish: it stays published, with the new content live.

So the label is never a promise the click does not keep, in either direction.
Catalog: `admin.updateAndPublish` is replaced by `admin.updatePost`,
`admin.publishPost` and `admin.publishedToast` (admin namespace, English-only
per ADR-043 #2).

### 3. `SCHEDULED` is not treated as "not yet published"

A scheduled post shows **"Update"**, not "Publish". `SCHEDULED → PUBLISHED` is
a legal transition, so the literal rule would have made a save on a scheduled
post go live immediately and silently cancel its schedule. Fixing a typo must
not do that. Publishing a scheduled post early stays an explicit click on the
panel's "Publish now".

### 4. Only the transitions that face readers save first

`PUBLISHED` and `SCHEDULED` save the form first. `DRAFT` (unpublish) and
`ARCHIVED` take content DOWN; saving into them would be a surprise, not a
service, so they call `transitionArticleAction` alone as before.

Because those two now save, they are disabled when the editor's `canSave` is
false — the same gate the header button has always had. A publish that cannot
save must not half-run.

## Consequences

- A draft goes live in one click instead of two, and the second click is no
  longer the one that silently did nothing.
- "Publish now" and "Schedule" are disabled while the form is incomplete (no
  title, no category, malformed video URL). Previously they were clickable and
  would publish an incomplete post. This is a behaviour change beyond the
  reported bug, and is intended.
- Publishing writes **two** audit rows (`articles.save`, then
  `articles.transition`) where it used to write one of them. This is correct —
  two things happened — but a report counting `articles.transition` to mean
  "was published" is unaffected, while one counting `articles.save` to mean
  "was edited without publishing" is now wrong.
- Not atomic: the save can succeed and the transition fail (e.g. the actor
  lacks the publish permission). The content is then saved and the post stays
  a draft, with the error toasted. That is the safe direction to fail, and
  making it one transaction would mean merging the two services — exactly what
  the original comment warned against.
- `e2e/admin/article-editor.spec.ts` matches the header button on
  `/^(Publish|Update)$/`, anchored so it cannot catch "Publish now". Those
  specs remain `fixme` on the auth-hydration blocker (unchanged by this ADR).

## Alternatives considered

- **Rename the header button to "Update" and leave the split.** Honest, and
  half the work — but it refuses the actual request, and it leaves "Publish
  now" still publishing stale bytes. Rejected.
- **Make the header button always publish, keeping the literal label.** Put to
  the owner, who chose the state-aware label. It removes any way to save a
  draft without publishing it, which is a worse bug than the one being fixed.
- **Fold the transition into `saveArticle` as one transaction.** Rejected on
  the original comment's own reasoning: one service that both saves and
  publishes is one gate away from a save that publishes.
- **Save first on every transition, including Archive.** Rejected: writing the
  author's unsaved edits into a post they are taking off the site is a
  surprise with no upside.

## Compliance

- security.md #1 — `requirePermission` unchanged; both actions still gate, and
  `transitionArticle`'s publish check is untouched.
- code-style.md #2 — new strings are catalog keys; admin namespace, so
  `en.json` only (ADR-043 #2). `check:catalog-completeness` passes.
- testing.md #2 — the regression is verified against the running app and the
  server's own HTML (see the DEVLOG entry for this date). The Playwright spec
  that would assert it in CI is written but blocked on the auth-hydration
  defect that predates this change.
