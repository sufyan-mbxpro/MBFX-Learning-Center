// Which permissions the `admin` role does NOT get (security.md #4, ADR-078 #4).
//
// This was a literal array inside `prisma/seed.ts`'s `admin` role — a filter
// expression three levels inside an object literal, which is a poor place for
// the repo's sharpest privilege rule to live. It is a named constant now so
// that it can be read, commented per entry, and asserted
// (`role-exclusions.test.ts`).
//
// `super_admin` holds `"*"` and needs no entry of its own; `admin` is built by
// filtering the registry through this list. Every other role lists its
// permissions explicitly, and `read_only` takes the `.view` keys — none of
// which ends in `.view`, which is why this one list is sufficient.

export const SUPER_ADMIN_ONLY_PERMISSIONS = [
  // Editing roles is editing the privilege graph itself.
  "roles.manage",
  // Assigning a permission directly is the same escalation, one step down.
  "permissions.assign",
  // Acting as someone else is every permission they hold.
  "users.impersonate",
  // ADR-078 #4: the SMTP host is a mail-interception path. An admin who can
  // repoint delivery captures the next password-reset link for anyone — a
  // super_admin included — which walks straight around `canAssignRole`'s
  // strict `<`. The password being write-only does not help: the host is the
  // sensitive field. Template editing, test sends and the delivery log stay
  // with `admin`, which is why the email settings screen splits by permission
  // instead of hiding whole.
  "email.settings.manage",
] as const;

export type SuperAdminOnlyPermission = (typeof SUPER_ADMIN_ONLY_PERMISSIONS)[number];

/** True when `admin` — and every role below it — must not hold this key. */
export function isSuperAdminOnlyPermission(key: string): boolean {
  return (SUPER_ADMIN_ONLY_PERMISSIONS as readonly string[]).includes(key);
}
