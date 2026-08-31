// packages/rbac/src/index.ts
//
// One evaluator, used by middleware, server actions, and UI gating.
// Rule: DENY beats ALLOW, always. That lets you revoke a single capability
// from a single person without inventing a bespoke role — which is how
// permission systems degrade into thirty near-identical roles.

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@repo/db";
import { PermissionEffect } from "@prisma/client";

export interface Subject {
  id: string;
  userType: "LEARNER" | "STAFF";
  roleKeys: string[];
  maxRoleLevel: number;
  allowed: Set<string>;
  denied: Set<string>;
}

// ─────────────────────────────────────────────────────────────
// Loading
// ─────────────────────────────────────────────────────────────

async function loadSubject(userId: string): Promise<Subject | null> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      userType: true,
      roles: {
        select: {
          role: {
            select: {
              key: true,
              level: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
      permissions: {
        select: { effect: true, permission: { select: { key: true } } },
      },
    },
  });

  if (!user) return null;

  const allowed = new Set<string>();
  const denied = new Set<string>();
  let maxRoleLevel = 0;

  for (const { role } of user.roles) {
    maxRoleLevel = Math.max(maxRoleLevel, role.level);
    for (const { permission } of role.permissions) allowed.add(permission.key);
  }

  for (const override of user.permissions) {
    const target = override.effect === PermissionEffect.DENY ? denied : allowed;
    target.add(override.permission.key);
  }

  return {
    id: user.id,
    userType: user.userType,
    roleKeys: user.roles.map((r) => r.role.key),
    maxRoleLevel,
    allowed,
    denied,
  };
}

/**
 * Two cache layers, deliberately.
 *  - `cache` dedupes within a single render pass, so twelve <Can> components
 *    cause one query, not twelve.
 *  - `unstable_cache` persists across requests, tagged per user so a role
 *    change takes effect immediately rather than after a TTL.
 */
export const getSubject = cache(async (userId: string) =>
  unstable_cache(() => loadSubject(userId), ["rbac-subject", userId], {
    tags: [`rbac:${userId}`],
    revalidate: 300,
  })(),
);

/** Call after any role or permission change. */
export async function invalidateSubject(userId: string) {
  const { revalidateTag } = await import("next/cache");
  revalidateTag(`rbac:${userId}`);
}

// ─────────────────────────────────────────────────────────────
// Evaluation
// ─────────────────────────────────────────────────────────────

export function can(subject: Subject | null, permission: string): boolean {
  if (!subject) return false;

  // Staff gate comes before the permission check. A learner account cannot
  // reach admin capability by acquiring a role — two locks, not one.
  if (subject.userType !== "STAFF") return false;

  if (subject.denied.has(permission)) return false;
  if (subject.roleKeys.includes("super_admin")) return true;

  return subject.allowed.has(permission);
}

export function canAny(subject: Subject | null, permissions: string[]): boolean {
  return permissions.some((p) => can(subject, p));
}

export function canAll(subject: Subject | null, permissions: string[]): boolean {
  return permissions.every((p) => can(subject, p));
}

/**
 * Privilege-escalation guard. Someone with `roles.manage` must not be able to
 * grant a role at or above their own level, or Editor becomes Super Admin.
 */
export function canAssignRole(subject: Subject | null, targetRoleLevel: number): boolean {
  if (!subject) return false;
  if (subject.roleKeys.includes("super_admin")) return true;
  if (!can(subject, "permissions.assign")) return false;
  return targetRoleLevel < subject.maxRoleLevel;
}

// ─────────────────────────────────────────────────────────────
// Enforcement — the real boundary
// ─────────────────────────────────────────────────────────────

export class ForbiddenError extends Error {
  constructor(public permission: string) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthenticatedError";
  }
}

/**
 * First line of every mutating server action and route handler.
 * Hidden UI is a courtesy; this is the control.
 */
export async function requirePermission(permission: string): Promise<Subject> {
  const { auth } = await import("@repo/auth");
  const session = await auth();

  if (!session?.user?.id) throw new UnauthenticatedError();

  const subject = await getSubject(session.user.id);
  if (!can(subject, permission)) throw new ForbiddenError(permission);

  return subject!;
}

export async function requireAnyPermission(permissions: string[]): Promise<Subject> {
  const { auth } = await import("@repo/auth");
  const session = await auth();

  if (!session?.user?.id) throw new UnauthenticatedError();

  const subject = await getSubject(session.user.id);
  if (!canAny(subject, permissions)) throw new ForbiddenError(permissions.join(" | "));

  return subject!;
}

// ─────────────────────────────────────────────────────────────
// Usage
// ─────────────────────────────────────────────────────────────

/*
  Server action — the enforcement point:

    "use server";
    export async function deleteLesson(id: string) {
      const subject = await requirePermission("lessons.delete");
      await db.lesson.update({ where: { id }, data: { deletedAt: new Date() } });
      await recordAudit(subject.id, "lesson.delete", "lesson", id);
      revalidateTag("lessons");
    }

  Route middleware — coarse gate, avoids rendering a page the user
  will only be bounced from:

    // apps/admin/middleware.ts
    const ROUTE_PERMISSIONS: Record<string, string> = {
      "/users": "users.view",
      "/employees": "employees.view",
      "/settings/theme": "theme.update",
      "/audit": "audit.view",
    };

  UI gate — presentation only:

    <Can permission="users.delete">
      <Button variant="destructive">Delete</Button>
    </Can>
*/

/** Server component gate. */
export async function Can({
  permission,
  anyOf,
  children,
  fallback = null,
}: {
  permission?: string;
  anyOf?: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { auth } = await import("@repo/auth");
  const session = await auth();
  if (!session?.user?.id) return fallback;

  const subject = await getSubject(session.user.id);
  const ok = permission ? can(subject, permission) : anyOf ? canAny(subject, anyOf) : false;

  return ok ? children : fallback;
}
