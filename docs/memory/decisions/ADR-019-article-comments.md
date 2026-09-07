# ADR-019: Article comments — schema and moderation design

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 15 (News & Analysis / `articles`) — extends Module 15, does not
reopen it.
**Supersedes:** —
**Superseded by:** —

## Context

`docs/news-analysis-module-plan.md` listed comments as explicitly
out-of-scope for launch, and ADR-015's Consequences section named it a
deferred piece with "a named home above" but no home was actually written
down — only that `comments.moderate` (permission, seeded under the
`content` category, already granted to the `Moderator` role) and
`community.comments` (feature flag, `AUTHENTICATED` visibility, seeded
`isEnabled: false`) exist ahead of the feature, per plan.md A7's stated
policy: "Seeding a permission before its feature exists is fine (it gates
nothing); shipping the feature without wiring the permission is not."
plan.md A7 also names `Comment` directly as one of the schema gaps to spec
"later" — this is that spec.

The trigger: a visual reference for the article detail page
(`docs/changes/changes-05.md`'s screenshot) includes a "Leave a Comment"
form with free-text **name**/**email** fields, i.e. anonymous commenting.
That shape conflicts with the flag already seeded for this feature —
`AUTHENTICATED` visibility implies a signed-in `User`, not an anonymous
name/email pair — and with security.md #6/#10 (no ad hoc identity capture
outside the real auth system). This ADR resolves the conflict in favor of
the already-seeded flag semantics, the same reconciliation move ADR-015
made for the rest of the imported plan.

This ADR is a **design record only**. Per explicit direction, the schema
below is added to `packages/db/prisma/schema.prisma` in the same change as
this ADR, but **no migration is generated or applied**, and no service,
action, or UI code ships with it — that is deliberately left for a
follow-up pass so the design can be reviewed before the feature is built.

## Decision

1. **One flat `Comment` model, no threading at launch.** Reactions/replies
   are a plan.md-unlisted feature; a flat per-article list matches what the
   reference screenshot actually shows and keeps the moderation queue
   (`comments.moderate`) simple: approve/reject one row at a time, no tree
   traversal.

   ```prisma
   enum CommentStatus {
     PENDING
     APPROVED
     REJECTED
   }

   model Comment {
     id        String        @id @default(cuid())
     articleId String
     userId    String
     // Plain text, not sanitized HTML (ADR-009 governs rich bodies; a
     // comment is not one) — rendered escaped, never dangerouslySetInnerHTML.
     body      String        @db.VarChar(2000)
     status    CommentStatus @default(PENDING)
     createdAt DateTime      @default(now())
     updatedAt DateTime      @updatedAt
     deletedAt DateTime?

     article   Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
     user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@index([articleId, status, createdAt])
     @@index([userId])
     @@map("comments")
   }
   ```

   `Article.comments Comment[]` and `User.comments Comment[]` back-relations
   are added at the same time (Prisma requires both sides declared).

2. **No name/email fields — the commenter is `session.user`.** The reference
   mockup's anonymous form is not built. A comment is only reachable behind
   a real session; `body` is the only user-entered field. This is the direct
   fix for the Context conflict above and matches how every other mutation
   in this repo is scoped to an authenticated/authorized subject
   (security.md #1, #6).
3. **Moderation is pre-publish (`PENDING` default), not post-hoc
   flagging.** A new comment is invisible on the public page until a holder
   of `comments.moderate` (the seeded `Moderator` role, plus any role
   granted the key) approves it. Rejected rows are kept (not hard-deleted)
   for audit/appeal history; `deletedAt` is reserved for a user or moderator
   removing a comment outright. Chosen over auto-publish + report-to-remove
   because the feature launches with zero spam tooling (no CAPTCHA, no
   rate-limit-and-shadow-ban heuristics) — pre-publish is the only gate
   available on day one, and it reuses a permission that is already granted
   to the right role rather than inventing a second moderation path.
4. **Visibility gate mirrors `publicArticleWhere()`'s shape.** A comment is
   publicly visible when: `status === "APPROVED" && !deletedAt &&
isFeatureVisible("community.comments", subject)` **and** the parent
   article itself is publicly visible. The last clause matters because an
   article can be unpublished/deactivated after comments were approved on
   it — an orphaned comment thread under a 404'd article must not leak
   through a separate, un-gated comment query.
5. **Rate limiting reuses the existing pattern, not a new subsystem.**
   security.md #13 already requires this; `@repo/auth`'s Better Auth config
   has a working Redis-backed rate limiter for `/api/auth/[...all]`
   (ADR-001 finding #4). The comment-post server action gets its own narrow
   limit (proposed: 5 comments / 10 minutes / user, exponential backoff on
   rejection same as login) implemented the same way login lockout is —
   `packages/auth`'s hooks are the precedent, not a new package.
6. **No new permission, no new feature-flag key.** `comments.moderate` and
   `community.comments` already exist for exactly this. `news.manage`/
   `analysis.*` are unaffected — comment moderation is its own permission
   because a news editor and a comment moderator are not necessarily the
   same person (plan.md's seeded `Moderator` role already reflects this
   separation).
7. **Cache tag: reuse `content`, article-scoped, no per-comment tag.**
   Same reasoning as ADR-015 #11 — architecture.md #12's vocabulary is
   frozen. A comment mutation revalidates `content` the same way a
   publish/unpublish does; the extra invalidation blast radius (all
   content, not just one article) is accepted at this volume the same way
   ADR-015 accepted it for articles.

## Consequences

- The moderation queue is a new admin screen (`/admin/articles/comments` or
  a tab on the article detail admin screen — left open for the
  implementation pass) gated on `comments.moderate`; it does not exist yet.
- Comments are English-only-shaped like everything else pre-i18n-content
  (ADR-007) — no translation table, since a comment is the commenter's own
  words, not admin-authored content requiring localization.
- `VarChar(2000)` on `body` is a launch guess, not a measured requirement;
  cheap to widen later, no migration-breaking concern either direction.
- Deferred by this ADR, explicitly not decided here: threading/replies,
  reactions (like/upvote), CAPTCHA or other bot mitigation beyond the
  rate limit in #5, email notification on reply, and whether
  `comments.moderate` alone is sufficient or a two-step
  (reporter-flags-then-moderator-reviews) flow is needed once real traffic
  exists.
- Until the follow-up implementation pass lands, `schema.prisma` carries a
  model with no migration — `pnpm db:migrate` has not been run. Anyone
  picking this up must generate and review that migration before writing
  the service layer against it.

## Alternatives considered

- **Anonymous name/email commenting**, matching the reference screenshot
  literally. Rejected: conflicts with the already-seeded `AUTHENTICATED`
  flag visibility, reopens the mass-assignment/spam surface security.md #6
  and #13 exist to close, and every other write path in this repo is
  identity-scoped to a real session — an anonymous exception here would be
  the only one in the codebase.
- **Post-publish, report-to-remove moderation** (comment goes live
  immediately; moderators react to reports). Rejected for launch: no report
  UI or spam heuristics exist yet either, so this would ship with strictly
  worse guarantees than pre-publish for the same amount of missing tooling
  — revisit once volume/false-positive data exists to justify the switch.
- **Threaded replies (`parentId`) from the start.** Rejected: not in the
  reference, not in plan.md, and doubles the moderation UI's complexity
  (tree vs. flat list) for a launch feature with no demonstrated demand yet.
- **A second `comments` cache tag.** Rejected on the same grounds ADR-015 #11
  already used — architecture.md #12 freezes the tag vocabulary; `content`
  already covers "something under an article changed."

## Compliance

- When implemented: `postComment` server action requires a session
  (redirect/401 otherwise, no anonymous path), parses input through a new
  `@repo/contracts` schema (security.md #6), writes `PENDING`, and does
  **not** require `comments.moderate` (any authenticated user may post,
  matching the `AUTHENTICATED` flag). `approveComment`/`rejectComment`/
  `deleteComment` require `comments.moderate` first (security.md #1) and
  write an audit row each (security.md #5).
- The public comment query is the single source of truth for the visibility
  rule in Decision #4, unit-tested the same way `publicArticleWhere()` is
  (ADR-015's Compliance section) — no second ad hoc filter anywhere else in
  the codebase.
- `scripts/check-permission-keys.mjs` already covers `comments.moderate`
  once a real `requirePermission("comments.moderate")` call site exists —
  no script change needed.
