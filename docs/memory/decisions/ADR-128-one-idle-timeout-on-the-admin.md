# ADR-128: One idle timeout on the admin — the watcher follows the server's expiry

**Status:** Accepted
**Date:** 2026-09-17
**Module:** 04 (auth), 09 (admin shell)
**Supersedes:** ADR-041's `IDLE_TIMEOUT_MS` constant and its fixed 60-second
warning. ADR-041's other decisions stand: admin-only, mounted once in
`AdminShell`, a warning dialog before sign-out, sign-out through Better Auth's
endpoint, `pointerdown`/`keydown`/`scroll`/visible as activity.
**Extends:** ADR-105 (the timeout is the session's own expiry).
**Superseded by:** —

## Context

The owner reported that the admin session timeout in Settings → General "is
not working as per selected settings". changes-38 had already fixed the
SERVER half (the expiry reached Redis, and Better Auth's refresh stopped
re-arming a week). The report was still true, because there were two timers
and they had never met:

- **ADR-041** (2026-09-06) shipped a client watcher with a hard-coded ten
  minutes. It owns everything a person SEES: the "Still there?" dialog and the
  redirect to sign-in.
- **ADR-105** (2026-09-15) made the timeout a setting and enforced it on the
  server as the session's `expiresAt`. It never mentions ADR-041.

So whatever was selected, the dialog opened at nine minutes and signed out at
ten — "never" included. And the selected value expired silently: at two
minutes, an open admin page stayed on screen and failed on the next click.
Worse, typing is not a server request, so an editor who wrote for longer than
the timeout without saving had the session end under them while the watcher
believed they were active.

## Decision

1. **The server's expiry is the only deadline.** `AdminShell` reads
   `security.adminSessionTimeout`; "never" mounts no watcher. The watcher
   schedules its warning from what the server reports, not from its own
   constant.
2. **Two routes, and the difference between them is the point.**
   `GET /admin/api/session` PEEKS through the new `peekSession()` in
   `@repo/auth` (`disableCookieCache` + `disableRefresh`, no ADR-105 slide), so
   asking an idle tab's question does not keep the session alive.
   `GET /admin/api/session/activity` calls `auth()`, which is ADR-105's own
   definition of activity. Both answer `{ remainingMs, timeoutMs }` for a STAFF
   session and 401 otherwise, never a redirect a `fetch` would follow into HTML.
   `remainingMs` is relative, so a skewed client clock cannot move the warning.
   Neither takes a permission key: a staff session is asking about itself.
3. **Activity reaches the server**, throttled to one call per 15 seconds, and
   coming back to the tab forces one. That keeps a person who is typing signed
   in, and lets a laptop waking from sleep find out immediately that its
   session ended.
4. **The slide threshold scales with short timeouts.** `staffSlideThresholdMs`
   is a minute or a quarter of the timeout, whichever is shorter, and the
   warning window is the same (`idleWarningMs`). With ADR-105's flat minute,
   the two-minute setting let an active person's stored expiry drop to sixty
   seconds out, inside a sixty-second warning. `idle-timing.test.ts` asserts
   for every offered duration that the worst case while active stays outside
   the window.
5. **Other tabs are followed, not ended.** Before opening the dialog, and again
   at zero, the watcher peeks. A session another tab kept alive closes the
   dialog instead of signing that tab out.
6. **`auth()` returns the expiry after its slide**, not the one it read before.
   This is additive, and it is what the activity route reports.

## Consequences

- The dialog and the server now agree for every setting, and "never" means
  never on both.
- An active admin costs one extra small GET at most every 15 seconds. The
  ADR-105 write throttle still bounds the database cost, since `auth()` writes
  only when the expiry has decayed past the threshold.
- The learner probe (`learner-admin-probe.spec.ts`) carries both routes;
  `admin-surface.test.ts` refused the change until it did.
- Still UX over the boundary. With JavaScript off, the server expiry signs the
  session out exactly as before.
