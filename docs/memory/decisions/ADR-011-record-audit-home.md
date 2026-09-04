# ADR-011: `recordAudit()` lives in `@repo/core`, not `@repo/rbac`

**Status:** Accepted
**Date:** 2026-09-01
**Module:** 03 (`@repo/rbac`) — SKILL.md flagged this as "an open
micro-decision — write the ADR when implementing."
**Supersedes:** —
**Superseded by:** —

## Context

security.md #5 requires every mutation to write an audit row. The reference
`rbac.ts`'s usage comment shows the intended call site — a server action
calls `requirePermission()` then `recordAudit()` back to back — but never
defines `recordAudit()` itself, leaving its package unresolved.

`@repo/rbac`'s job is authorization _evaluation_: `can()`, the enforcement
functions, and the `Subject` loader. `@repo/core` is defined in claude.md's
architecture map as "domain services — the only code that touches db," the
general home for cross-cutting write operations that aren't specific to one
vertical module.

## Decision

`recordAudit()` is implemented in `@repo/core`, not `@repo/rbac`, when the
first module that needs it lands (Module 08/11/13 territory per the package
map). `@repo/rbac` stays scoped to evaluation and enforcement only — it
does not gain a database-writing responsibility beyond the read-only
`Subject` loader it already has.

Call sites (server actions, route handlers) import both: `requirePermission`
from `@repo/rbac` for the boundary check, `recordAudit` from `@repo/core`
for the write, exactly as the reference code's usage comment already showed
them side by side.

## Consequences

- `@repo/rbac` has no `AuditLog` write path and never will — keeps its
  surface area matched to its one job (architecture.md's "apps are thin"
  principle applied one level down: packages should be thin to their one
  job too).
- Whichever module first calls `recordAudit()` is responsible for actually
  implementing it in `@repo/core` (signature, at minimum: actor id, action
  string, entity type/id, before/after change payload — matching the
  `AuditLog` model in `packages/db/prisma/schema.prisma`). Not implemented
  here since no module has reached that point yet.

## Alternatives considered

- **`@repo/rbac` implements `recordAudit()`.** Rejected: rbac would gain a
  write responsibility disconnected from its actual job (evaluating
  permissions), and every future package needing to audit a mutation would
  import rbac just for that function, growing its dependency surface for no
  authorization-related reason.

## Compliance

- Reviewed at Module 08/11/13 kickoff (whichever lands first and needs it):
  confirm `recordAudit()` is added to `@repo/core`, not re-litigated into
  `@repo/rbac` or duplicated per-module.
