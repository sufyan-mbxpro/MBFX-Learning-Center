# ADR-094 — One public session read, and the visitor band on every page

- **Status:** Accepted
- **Date:** 2026-09-14
- **Module:** 12 (public site), 04 (`@repo/auth`)
- **Supersedes:** nothing. **Extends:** ADR-052 (two sign-in surfaces) and the
  client-side session rule `auth-slot.tsx` introduced in changes-21.

## Context

changes-28's brief (image 52) asks for a banner on every page offering sign-in
and account creation to a visitor who has neither.

The public surface is static and cached (ADR-004). A SERVER session read on it
puts an uncached `auth()` — a DB or Redis round trip that deliberately bypasses
the cookie cache — on every public navigation, which is what Cache Components'
dev insight flagged when `AuthSlot` first did it. So `AuthSlot` reads the
session on the CLIENT, from Better Auth's `get-session` endpoint, which honours
the fast signed cookie cache; the server shell carries no session read at all.
Auth state on a public page is DISPLAY, not authorization. The real boundaries
— the proxy gate, the admin layout's `loadSubject` re-check, and
`requirePermission()` in every mutation — are untouched by any of this.

A second island that needs the same answer is therefore two fetches for one
question, two independent loading states, and two chances for the header and
the footer to disagree about who is reading the page.

## Decision

**1. One provider, one fetch.** `PublicSessionProvider`
(`_components/public-session.tsx`) performs the public surface's single
`/api/auth/get-session` call and publishes the result through
`usePublicSession()`. It is mounted in the public root layout wrapping both
consumers. `AuthSlot` stops fetching and consumes it.
`public-session.test.ts` asserts the endpoint appears in exactly one file.

**2. A STAFF session reads as anonymous, and that decision moves to the
provider.** ADR-052's rule is unchanged — staff sign in at `/admin/sign-in` and
belong to the admin surface, and putting "System Administrator" in the public
header both advertises the portal the public site deliberately hides and hands
a visitor an identity chip with nowhere to go. What changes is that it is
applied ONCE, where the session is read, so every consumer inherits it rather
than each remembering to.

**3. A failed read resolves to anonymous, never to an error state.** The worst
outcome is a signed-in learner briefly seeing a sign-up prompt. A stuck spinner
in the header of every cached page is worse and lasts longer.

**4. `usePublicSession()` outside the provider returns `loading`, it does not
throw.** Every consumer already has to render something sane while the fetch is
in flight, so `loading` is a state they all handle — and a throw would turn a
misplaced island into a blank page rather than a missing chip.

**5. The visitor band renders for `anonymous` alone.** One condition
(`status !== "anonymous" → null`), not a loading check plus a learner check, so
a fourth session state can never fall through to showing it. Absent while
loading is deliberate: the band would otherwise appear and then vanish for
every signed-in learner — a layout shift at the bottom of every page — in
exchange for showing an anonymous visitor the offer about 200ms sooner.

**6. It sits above the footer, in flow, and is never pinned to the viewport.**
The reference pins an equivalent bar to the bottom of the window. This one does
not, for two reasons: a fixed bar covers content on exactly the screens that
have least of it, landing on top of the thing a phone reader is trying to
finish; and a persistent fixed element competes with the sticky header for the
small vertical budget a 667px phone has. In flow it is unmissable at the end of
a page, which is when an account offer is welcome rather than in the way.

**7. It is chrome, so it is code — there is no setting behind it.** ADR-042,
and code-style.md #28 in particular: a seeded, typed, admin-editable row whose
value reaches no code is worse than a missing feature, and a switch for a band
that has one job is a row nobody will ever change.

## Consequences

- Every public page now carries one client-side session fetch. It already did —
  the header's — so this adds no request; it removes the second one changes-28
  would otherwise have introduced.
- The band is invisible to a crawler and to a JS-disabled visitor, because it
  renders only after the session resolves. That is correct for a personalised
  element: the alternative is server-rendering it, which is the uncached
  `auth()` on every cached page this whole approach exists to avoid.
- A STAFF member browsing the public site is offered a learner account. Harmless
  and a direct consequence of #2, which is the rule that matters more.
- `apps/web` has no jsdom environment and no React Testing Library — RTL lives
  in `@repo/ui`, where components are pure and take props. The guard here is
  therefore a source test, like every other test under `apps/web/app`. Adding
  jsdom, `@testing-library/react` and a fetch stub to this package to assert
  three rules that are plainly visible in the source was not worth the
  dependency or the suite time.
