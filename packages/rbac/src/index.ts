// @repo/rbac — one evaluator, used by the proxy, server actions, and UI
// gating. Rule: DENY beats ALLOW, always. That lets you revoke a single
// capability from a single person without inventing a bespoke role — which
// is how permission systems degrade into thirty near-identical roles.
//
// Semantics here are FROZEN (SKILL.md) — see the escalation tests in
// index.test.ts before changing evaluation order.
import { cache } from "react";
import type { ReactNode } from "react";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { db, PermissionEffect } from "@repo/db";

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

/**
 * Pure DB read, exported (not just the cached `getSubject`) so tests can
 * exercise the loader — including cache-invalidation scenarios — without
 * depending on Next's `"use cache"` compiler transform, which is inert
 * outside a real Next.js build/dev process (ADR-004). `getSubject` is the
 * one production code should call; this is the one tests call.
 */
export async function loadSubject(userId: string): Promise<Subject | null> {
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
 *  - React's `cache()` dedupes within a single render pass, so twelve
 *    <Can> components cause one query, not twelve.
 *  - `"use cache"` (ADR-004) persists across requests, tagged per user so a
 *    role change takes effect immediately rather than after a TTL — the
 *    tag `rbac:{userId}` is frozen API (architecture.md #12).
 */
export const getSubject = cache(async (userId: string): Promise<Subject | null> => {
  return getCachedSubject(userId);
});

async function getCachedSubject(userId: string): Promise<Subject | null> {
  "use cache";
  cacheTag(`rbac:${userId}`);
  cacheLife({ revalidate: 300 });
  return loadSubject(userId);
}

/** Call after any role or permission change. */
export async function invalidateSubject(userId: string): Promise<void> {
  revalidateTag(`rbac:${userId}`, { expire: 0 });
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
 * Privilege-escalation guard. Someone with `roles.manage` must not be able
 * to grant a role at or above their own level, or Editor becomes Super
 * Admin. Strict `<` — an equal-level grant is rejected too.
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
 * First line of every mutating server action and route handler
 * (security.md #1). Hidden UI is a courtesy; this is the control.
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
// UI gate — presentation only. The server action / route handler boundary
// above is the real control; a hidden button is not security.
// ─────────────────────────────────────────────────────────────

export async function Can({
  permission,
  anyOf,
  children,
  fallback = null,
}: {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}): Promise<ReactNode> {
  const { auth } = await import("@repo/auth");
  const session = await auth();
  if (!session?.user?.id) return fallback;

  const subject = await getSubject(session.user.id);
  const ok = permission ? can(subject, permission) : anyOf ? canAny(subject, anyOf) : false;

  return ok ? children : fallback;
}
