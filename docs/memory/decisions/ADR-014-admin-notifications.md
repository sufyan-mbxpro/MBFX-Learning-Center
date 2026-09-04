# ADR-014: Admin notifications — dedicated `Notification` table, service-emitted

**Status:** Accepted
**Date:** 2026-09-02
**Module:** 09/10 (admin shell topbar; emitted from people/settings services)
**Supersedes:** —
**Superseded by:** —

## Context

The changes-01 request (docs/changes/changes-01.md) adds a notification icon
to the admin topbar showing "relevant admin notifications". No module spec in
plan.md Part D includes notifications: there is no `Notification` model, no
service, no permission key, and no UI anywhere in the repo. Adding one is a
schema and scope addition, which under Part F #10 requires an ADR before the
code.

Two shapes were on the table:

1. **Derive the bell from `AuditLog`.** No new table — show recent audit rows
   to anyone holding `audit.view`.
2. **A dedicated `Notification` table** addressed to a user, written by the
   same core services that already write audit rows, read by the bell.

`AuditLog` is a system-of-record trail: rows are not addressed to anyone,
have no read state, and are scoped by `audit.view` — a permission most staff
roles deliberately lack. A bell built on it would either leak audit scope to
every staff member or be empty for most of them, and "unread count" would
have no honest meaning.

## Decision

Add a `Notification` model to `packages/db/prisma/schema.prisma`:

- `id`, `userId` (recipient, FK → user, cascade delete), `type`
  (dot-namespaced event key, e.g. `role.assigned`), `title`, `body?`,
  `href?` (admin-relative link), `readAt?`, `createdAt`.
- Indexed `[userId, readAt]` and `[userId, createdAt]`.

`@repo/core` owns the writes (`recordNotification`) and the reads
(`listNotifications`, `countUnreadNotifications`, `markNotificationRead`,
`markAllNotificationsRead`). Notifications are **emitted inside existing
core service flows** at defined events — role assigned/removed to the
affected staff user, admin password reset, employee offboarded (to the
actor's manager chain is out of scope; recipient is the affected user's
account when it is STAFF), theme activated and settings updated (to the
acting admin as confirmation is pointless — these go to _other_ admins
holding the matching manage permission is also out of scope for v1; v1
recipients are only the directly affected staff user). No polling
infrastructure, no push channel, no fan-out table: plain DB reads on the
admin shell, revalidated by the reader's own navigation (`router.refresh()`
after mark-read).

Reading and marking-read require only an authenticated STAFF session scoped
to `userId = subject.id` — there is no cross-user notification read path and
therefore no new permission key.

## Consequences

- **A second event trail next to `AuditLog`.** Mitigation: notifications are
  presentation, audit is record — services emit both explicitly and nothing
  derives one from the other; a dropped notification write must never fail
  the parent mutation (write happens inside the same transaction where one
  exists, otherwise best-effort).
- **Table growth.** Unbounded per-user rows. Mitigation: the list read is
  capped (latest N); a retention sweep is deferred to Module 14 hardening
  and noted there.
- **No real-time delivery.** The bell updates on navigation, not push.
  Accepted for v1; a push channel would be its own ADR.

## Alternatives considered

- **Audit-derived bell** — rejected: wrong scoping (`audit.view`), no
  per-user addressing, no read state (see Context).
- **Third-party notification service** — rejected: external dependency and
  data egress for an internal admin convenience; nothing in the requirement
  needs delivery guarantees.

## Compliance

- Schema change lands with its migration and seed untouched (no seeded
  notifications).
- `recordNotification` lives in `@repo/core` only; the app never writes
  notification rows directly (architecture.md #2 — route handlers/actions
  call core).
- Read/mark actions assert `subject.id === row.userId` in the service;
  integration tests cover write→read→mark-read round-trip and the
  cross-user read returning nothing.
