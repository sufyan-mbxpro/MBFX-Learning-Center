# SKILL — Module 03: @repo/rbac

Reference: `docs/reference/rbac.ts` (port with cache + auth-import changes),
plan.md Module 03. Semantics are FROZEN — escalation tests document them.

## Frozen semantics

- Permission keys are flat `resource.action` strings — no hierarchy, no
  wildcards inferred.
- **Evaluation order: deny > super_admin > allow.** A DENY on super_admin
  wins (deny is checked first). Preserve exactly.
- STAFF gate precedes any permission check ("two locks").
- `canAssignRole`: strict `<` on level; super_admin exempt from the level
  comparison but still needs `permissions.assign`; equal level rejected.
- Loader returns null subject for deleted/inactive users.
- `requirePermission` throws typed errors; a shared error boundary maps them
  to 401/403.

## Changes from the reference file

- Cache layer per ADR-004 (`"use cache"`), tags `rbac:{userId}` unchanged;
  `invalidateSubject` on any role/permission change.
- `auth()` import swaps to the Better Auth session helper (same call shape —
  Module 04 guarantees it).
- `recordAudit()` home (here vs core) is an open micro-decision — write the
  ADR when implementing.

## Required tests (90% floor; Testcontainers for the loader)

`can()` truth table: learner+role → false; staff no role → false; grant →
true; DENY beats grant; DENY beats super_admin; `canAny`/`canAll` empty-array
edges; `canAssignRole` matrix; loader null-subject; cache invalidation
visible on next read.

**CI cross-check script:** every permission string used by
`requirePermission|requireAnyPermission|<Can permission=` exists in the seed
registry — catches typo'd keys (the silent-403 bug). Wire into CI here.
