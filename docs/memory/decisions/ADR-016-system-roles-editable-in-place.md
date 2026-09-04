# ADR-016: System roles are editable in place (name, description, permissions); key, level and existence stay locked

**Status:** Accepted
**Date:** 2026-09-03
**Module:** 10 (users, roles, employees) — changes-02
**Supersedes:** the "system roles clone-only" scope line in plan.md Module 10 / `.claude/skills/users-employees/SKILL.md` (the lock-out rationale it carried is preserved below)
**Superseded by:** —

## Context

plan.md Module 10 and the Module 10 skill describe system roles as
"clone-only": `updateRoleMeta`, `setRolePermission(s)` and `deleteRole`
all threw `SystemRoleError` for `isSystem = true` rows, and the role detail
page hid the edit button and rendered the permission grid read-only for
them. The stated reason was lock-out risk — an admin deleting or gutting
`super_admin`/`admin` and locking everyone out.

changes-02 (docs/changes/changes-02.md) asks for permissions to be
"checkable/uncheckable" and the role name and description to be editable.
Reproduced live: an admin opening the seeded `admin`, `editor` or `support`
role sees check marks instead of checkboxes and no Edit button, because
every seeded role is a system role. The only roles that were editable were
ones nobody had created yet — the feature was invisible in a fresh install.

Two facts make the clone-only lock stricter than the risk it guards:

1. `super_admin` bypasses the allow-list (`deny > super_admin > allow`,
   Module 03), so its RolePermission rows are decorative — editing them
   cannot lock a super_admin out.
2. `canAssignRole`'s strict `<` level guard (security.md #4) already stops
   every actor from editing a role at or above their own level. Nobody can
   touch `super_admin` (level 100) because nobody outranks it, and the
   last-super_admin guards on demotion/deactivation still stand.

What actually prevents lock-out is *existence* (no delete), *rank* (level
guard) and *the super_admin bypass* — not immutability of a label or of the
lesser system roles' permission sets.

## Decision

- System roles MAY have their **name**, **description** and **permission
  set** edited through the normal services (`updateRoleMeta`,
  `setRolePermission`, `setRolePermissions`), subject to the same
  `roles.manage` gate and strict-`<` level guard as custom roles.
- System roles MUST NOT have their **key** or **level** changed, and MUST
  NOT be deleted. `updateRoleMeta` rejects a `level` change on a system
  role with `SystemRoleError`; `deleteRole` keeps its existing guard.
- The role detail page renders the permission grid editable and shows the
  Edit modal for system roles whenever the actor holds `roles.manage` and
  outranks the role; the modal disables the level field for system roles.

## Consequences

- The seeded `admin`/`editor`/… permission sets are now admin-editable
  data, not code. A reseed keeps admin edits (seed upserts are create-only
  for admin-editable rows — Module 01's convention) — verified by the
  existing seed round-trip test remaining green.
- An admin can still grant a lesser system role more than intended; the
  audit rows (`roles.grantPermission(s)` / `roles.update`) and the per-
  member `rbac:{userId}` flush make that visible and reversible, same as
  for custom roles.
- `super_admin` stays effectively immutable for everyone by the level
  guard alone; no special-casing by key is introduced.

## Alternatives considered

- **Keep clone-only and tell admins to clone.** Rejected: it hides the
  feature in every fresh install and doubles the role list for a cosmetic
  rename.
- **Unlock only name/description, keep permissions locked.** Rejected: the
  request is explicitly about permissions, and the lock-out argument does
  not apply to permission rows (facts 1–2 above).

## Compliance

- `packages/core/src/changes01.integration.test.ts` — the former "refuses
  to edit a system role" cases now assert: name/description edit succeeds,
  level change is rejected, delete is rejected, permission grant/revoke on
  a system role succeeds and audits.
- Review checklist: any new role mutation must keep `deleteRole`'s system
  guard and the strict-`<` level guard.
