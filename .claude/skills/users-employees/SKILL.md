# SKILL — Module 10: Users, roles, employees

plan.md Module 10 + architecture doc §6.2/§7. Users = identity/access;
employees = HR context. Separate tables, nullable `userId` link.

## Screens & rules

- **Users list/detail** on the shared DataTable: filters (type, status,
  role, date range), bulk activate/deactivate/assign-role/export. Row
  actions permission-gated — Support sees reset-password, not delete.
- **Role manager:** system roles clone-only (never delete — lockout risk);
  `canAssignRole` strict-`<` level guard enforced SERVER-side; permission
  matrix editor grouped by `groupName`.
- **Per-user overrides:** grant or DENY with a required reason field —
  audited. DENY beats everything (frozen rbac semantics).
- **Employees:** CRUD, department/designation admin, org chart from
  `reportingToId`, **offboarding**: employee → TERMINATED, user deactivated,
  and sessions revoked — one transactional server action.
- Last super_admin cannot be demoted/deactivated.

## Required tests

Escalation rejected (Editor granting Admin-level role → 403 + no write);
last-super-admin self-demotion blocked; **offboarding atomicity with fault
injection** (revocation failure rolls back the status change); DataTable
server-side pagination/sort against seeded fixtures; CSV export matches the
filtered set; E2E happy + denied paths per screen.
