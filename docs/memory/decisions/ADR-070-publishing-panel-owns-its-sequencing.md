# ADR-070: The publishing panel owns its sequencing; the STAFF gate tests for a session

**Status:** Accepted
**Date:** 2026-09-10
**Module:** 09 (admin shell), 11 (content system), 04 (auth), 12 (public site)
**Supersedes:** —
**Superseded by:** —

## Context

Two defects reported by the owner in `changes-14-admin-side-update.md` turned
out to share a shape: in both, a mechanism that was correct in design was made
optional in practice, and nothing could tell that it had been skipped.

**1. Publish published nothing.** `ContentStatusPanel` took a single callback,
`submitForm(thenTransitionTo?: string)`, and called it with the target status
for the publishing transitions. Each editor was expected to honour the
argument: save the open form, then move. Five editors passed it. Two —
`glossary/[id]/glossary-editor.tsx` and `learn/videos/[id]/video-editor.tsx` —
declared `async ()`, dropped the argument, saved, and reported success while
the status stayed exactly where it was. A term could sit at APPROVED
indefinitely with the editor insisting it had saved.

TypeScript cannot catch this. A zero-parameter function is assignable to a
one-parameter type, so the prop's own type could never have flagged it, and no
test clicked Publish. The videos editor shipped the same morning with the same
bug, acquired independently — which is the evidence that matters: **a contract
a caller can silently fail to honour will keep being silently failed.**

**2. The admin signed staff out every five minutes.** `packages/auth` sets
`session.cookieCache.maxAge` to five minutes against an `expiresIn` of seven
days, and `proxy.ts`'s `staffGate` decided STAFF-ness from that signed cookie
alone. Nothing rewrites the cookie on an admin page view: Better Auth refreshes
it when its own handler runs, and the admin surface reads the session inside a
server component, where Next.js does not permit setting a cookie. Five minutes
after sign-in the cache is gone, the database session is valid for another
seven days, and the gate redirected every navigation to `/admin/sign-in`.

The same expiry had already broken Save once. That fix exempted `next-action`
requests and left the navigation case in place; `staffGate`'s own comment
described the mechanism in full.

A third, smaller decision belongs here because it is the same reasoning applied
to data rather than control flow: `GlossaryTopic` grew an editor in changes-18,
and the question of whether a topic is content or taxonomy had to be settled
before its screen could be designed.

## Decision

**1. `ContentStatusPanel` takes `save` and `transitionTo` separately and
sequences them itself.**

```ts
const move = (to: string) =>
  run(async () => {
    if (PUBLISHING.includes(to)) await save();
    await transitionTo(to);
  });
```

The panel already decided which transitions save first; it now performs that
decision instead of delegating it. The old bug becomes unrepresentable rather
than guarded — there is no argument left for a caller to drop. The three
editors that honoured the contract lost their now-dead `thenTransitionTo`
parameter. The article editor is untouched: it uses `publish-panel.tsx`, a
different component for the four-state article machine whose `submitForm` also
carries `scheduledForIso`.

**2. The STAFF gate tests for a session token; the cookie cache is a fast path
on top of it.** An anonymous request has no token and is still turned away at
the edge. A request that HAS a session falls through to `(admin)/layout.tsx`,
which loads the subject from the database and redirects a non-STAFF user.

This is ADR-006's own division of labour restored, not bent: the proxy is a
gate, the layout is the boundary, and security.md #3's "re-checked server-side"
is what now does the deciding for an authenticated request.

Rejected alternatives, for the record:

- _Raise `cookieCache.maxAge`._ Does not fix it. The cache still expires and is
  still never rewritten; it lengthens the interval between bounces and makes
  revocation staler.
- _Call `auth()` in the proxy._ Prisma and a database round-trip on every admin
  request, and the proxy deciding — architecture.md #3 forbids it.

**3. A glossary topic is taxonomy, not content.** It keeps `isActive` and does
NOT run the seven-state `CONTENT_TRANSITIONS` machine, even though its editor
now looks like the term editor beside it. The screen presents that boolean as
Published / Draft, which is display framing of an existing column under
ADR-044 #5, not a new state model.

D27 built `GlossaryTopic` as a mirror of `ArticleCategory`, and a category is an
attribute of content rather than content itself. Giving it review, SEO review,
approval and scheduling would allow a topic to be APPROVED but invisible while
the terms filed under it are live — a state no reader can make sense of and no
editor can be taught.

Its `description` becomes rich text (`Text`, sanitized on save) because it is
rendered as prose on the public topic page. `seoKeywords` is a plain
`VarChar(255)` for the meta tag and is deliberately NOT named
`seoFocusKeyword`: `SeoAnalysis` scores prose against one focus term, and a
topic page has no prose to score, so the other name would promise an analysis
that does not exist.

## Consequences

- **Publishing works on glossary terms and video topics**, which it did not
  before, and the two remaining ways to break it are visible: a call site that
  passes neither prop fails to typecheck, and one that revives a single
  `submitForm` prop fails `content-status-panel-contract.test.ts`.
- **A learner poking at `/admin` now meets a server-side redirect** instead of
  an edge one — one extra hop, no access. The learner-session probes against
  every `/admin/*` route stay owed to Module 14 (security.md #7), and they
  matter slightly more now than they did.
- **The cookie cache's five-minute `maxAge` is no longer load-bearing** for
  access. It remains what it was designed to be: an optimisation.
- **A topic's rich `description` must be flattened wherever it is used as a
  string.** `GlossaryTopicView.description` is plain text for cards and the
  meta tag; `GlossaryTopicDetail.descriptionHtml` carries the markup for the
  one surface that renders prose. This is ADR-069's `simpleExplanation`
  finding applied before it could ship a second time.
- **Topic authorship stays on the `glossary.*` keys**, unchanged. No new
  permission keys were added, for the reason ADR-058 #8 gives.
- Two pure helpers moved into `@repo/utils` as a consequence of the above:
  `stableHash`/`pickByHash` (four copies of the same FNV-1a loop existed, and
  the admin needed a fifth) and `slugify` (it lived in `@repo/core`, which a
  client component cannot import, so the admin's autofilling slug field could
  not reach the one definition of the rule). `@repo/core` re-exports `slugify`,
  so no existing import changed.
