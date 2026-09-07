# ADR-041: Ten-minute idle auto sign-out on the admin surface

**Status:** Accepted
**Date:** 2026-09-06
**Module:** 04 (`@repo/auth`) / 09 (Admin shell)
**Supersedes:** —
**Superseded by:** —

## Context

The owner asked to "increase the automatic sign-out / session timeout to
10 minutes". The repo has no automatic sign-out of any kind today, so
there was nothing to increase; the two things the request could mean are
materially different and one of them is harmful:

- **Absolute session lifetime = 10 minutes.** `session.expiresIn` is
  currently `60 * 60 * 24 * 7` (7 days). Setting it to 600s signs every
  user out ten minutes after sign-in regardless of what they are doing —
  mid-article, mid-form. It also applies to learners on the public site,
  who have no reason to be affected.
- **Idle timeout = 10 minutes.** No activity for ten minutes ends the
  session; active work never triggers it.

Asked the owner directly rather than guessing (same posture as ADR-038's
theme-tab question). Answer: **idle timeout, ten minutes, admin surface
only.**

Context that shapes the mechanism: ADR-006's consequence #4 requires
compensating controls for learners and staff sharing one origin, and
names shorter staff session lifetime as one of them — an idle timeout
scoped to `/admin` is squarely in that family, and is the first of those
controls to actually ship. `session.cookieCache.maxAge` is 5 minutes, but
that is a read-cache TTL, not a lifetime; it never signed anyone out and
is not what the owner was observing.

## Decision

- **A client-side idle watcher mounted in the admin shell**, and nowhere
  else. `IDLE_TIMEOUT_MS = 10 * 60 * 1000`, with a **60-second warning
  dialog** before it fires: "stay signed in" cancels, ignoring it signs
  out. A silent sign-out that discards unsaved form state is a bug, not a
  security control.
- **Activity is `pointerdown`, `keydown`, `scroll`, and `visibilitychange`
  back to visible**, listened for passively on `document`, throttled to
  one timer reset per 5 seconds. Not `mousemove` — a resting mouse over a
  jittery trackpad would defeat the timer entirely.
- **Sign-out goes through `POST /api/auth/sign-out`**, the same Better
  Auth endpoint `SignOutButton` uses. The session row is deleted
  server-side, so this is a real revocation, not a client-side redirect.
- **`session.expiresIn` stays 7 days.** The idle timer is an additional
  bound, not a replacement for the lifetime, and the public surface keeps
  the long session the owner asked to leave alone.
- **This is UX-grade defence, and is documented as such.** It is client
  JavaScript: it can be disabled, and a closed tab stops the timer with
  the session still valid until `expiresIn`. It reduces the window on an
  unattended screen — the actual threat — and nothing else relies on it.
  Every server-side check (`requirePermission`, the layout's STAFF
  re-check, the proxy gate) is untouched and remains the boundary.

## Consequences

- An admin who leaves a long editor session (article body, theme editor)
  open and walks away loses unsaved work when the timer fires. The
  60-second warning is the mitigation, and it is a real one only if the
  admin is at the screen — which is exactly the case where they can act.
  Accepted deliberately: an "unsaved changes block the timer" carve-out
  would let any dirty form disable the control indefinitely.
- Ten minutes is short for an admin panel. It is the owner's stated
  number, so it ships as stated; it lives in one named constant in
  `idle-timeout.tsx` so changing it is a one-line edit, not a hunt.
- A background tab does not accrue idle time differently from a
  foreground one — `setTimeout` throttling in background tabs can delay
  the fire, so the effective timeout is "at least 10 minutes", never
  less. That asymmetry is the safe direction (it never signs out early)
  and is why `visibilitychange` counts as activity rather than as a reset
  suppressor.
- Two components can now end a session (`SignOutButton`, the idle
  watcher). They share the same endpoint call, so there is one revocation
  path, not two.

## Alternatives considered

- **`session.expiresIn = 600`.** Rejected on the owner's own answer, and
  on merit: it signs out active users and hits the public surface.
- **Server-enforced idle via a `lastActiveAt` column checked in the admin
  layout.** Genuinely stronger — it cannot be disabled client-side. Not
  chosen now because it needs a write on every admin request (or a
  throttled heartbeat), a schema change, and a Better Auth session-hook
  integration; the threat being addressed is an unattended logged-in
  screen, which the client timer covers. Recorded here as the upgrade
  path if the requirement ever hardens beyond UX.
- **Shortening `cookieCache.maxAge` instead.** Rejected: it does not sign
  anyone out; it only makes every admin request re-read the session from
  the database. It would have looked like a fix and done nothing.
- **Applying the watcher on both surfaces.** Rejected on the owner's
  answer — learners get no benefit and a real annoyance.

## Compliance

- The watcher is mounted in exactly one place (`AdminShell`), so "admin
  only" is structural rather than a rule to remember.
- `security.md` #11 (database-backed, revocable sessions) is satisfied by
  routing through Better Auth's sign-out endpoint rather than clearing a
  cookie client-side — a client-side-only "sign-out" would leave a live
  session row and is the specific failure this clause exists to prevent.
- The timeout constant and the warning window are unit-testable pure
  values; the watcher itself is covered by the Module 09 admin E2E suite
  when it lands (deferred, per the module table).
