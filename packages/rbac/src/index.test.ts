import { describe, expect, it, vi } from "vitest";
import { can, canAll, canAny, canAssignRole, invalidateSubject, type Subject } from "./index.ts";

// vi.mock (and vi.hoisted) are hoisted above imports by vitest's transform,
// so this applies before ./index.ts's own `import ... from "next/cache"` evaluates.
const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag,
}));

function subject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: "user-1",
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 0,
    allowed: new Set(),
    denied: new Set(),
    ...overrides,
  };
}

describe("can() — frozen evaluation order: deny > super_admin > allow", () => {
  it("returns false for a null subject", () => {
    expect(can(null, "lessons.view")).toBe(false);
  });

  it("returns false for a LEARNER even with a role granting the permission (staff gate first)", () => {
    const s = subject({
      userType: "LEARNER",
      roleKeys: ["editor"],
      allowed: new Set(["lessons.view"]),
    });
    expect(can(s, "lessons.view")).toBe(false);
  });

  it("returns false for STAFF with no matching role/permission", () => {
    const s = subject({ userType: "STAFF" });
    expect(can(s, "lessons.view")).toBe(false);
  });

  it("returns true when a role grants the permission", () => {
    const s = subject({ allowed: new Set(["lessons.view"]) });
    expect(can(s, "lessons.view")).toBe(true);
  });

  it("a DENY override beats an ALLOW grant for the same permission", () => {
    const s = subject({
      allowed: new Set(["lessons.delete"]),
      denied: new Set(["lessons.delete"]),
    });
    expect(can(s, "lessons.delete")).toBe(false);
  });

  it("a DENY override beats super_admin — deny is checked before the super_admin bypass", () => {
    const s = subject({
      roleKeys: ["super_admin"],
      denied: new Set(["users.impersonate"]),
    });
    expect(can(s, "users.impersonate")).toBe(false);
  });

  it("super_admin bypasses the allow-list for anything not explicitly denied", () => {
    const s = subject({ roleKeys: ["super_admin"] });
    expect(can(s, "anything.not.seeded")).toBe(true);
  });
});

describe("canAny() / canAll()", () => {
  const s = subject({ allowed: new Set(["lessons.view"]) });

  it("canAny on an empty array is false (vacuous truth would be a security bug here)", () => {
    expect(canAny(s, [])).toBe(false);
  });

  it("canAll on an empty array is true (nothing to fail)", () => {
    expect(canAll(s, [])).toBe(true);
  });

  it("canAny is true if at least one permission matches", () => {
    expect(canAny(s, ["courses.view", "lessons.view"])).toBe(true);
  });

  it("canAll is false unless every permission matches", () => {
    expect(canAll(s, ["courses.view", "lessons.view"])).toBe(false);
  });
});

describe("canAssignRole() — privilege-escalation guard", () => {
  it("rejects a null subject", () => {
    expect(canAssignRole(null, 10)).toBe(false);
  });

  it("rejects assigning a role at the same level (strict <, not <=)", () => {
    const s = subject({
      maxRoleLevel: 50,
      allowed: new Set(["permissions.assign"]),
    });
    expect(canAssignRole(s, 50)).toBe(false);
  });

  it("allows assigning a strictly lower-level role when permissions.assign is granted", () => {
    const s = subject({
      maxRoleLevel: 50,
      allowed: new Set(["permissions.assign"]),
    });
    expect(canAssignRole(s, 49)).toBe(true);
  });

  it("rejects without permissions.assign even at a lower target level", () => {
    const s = subject({ maxRoleLevel: 50 });
    expect(canAssignRole(s, 10)).toBe(false);
  });

  it("super_admin is exempt from the level comparison entirely — bypasses even permissions.assign", () => {
    const s = subject({ roleKeys: ["super_admin"], maxRoleLevel: 100 });
    expect(canAssignRole(s, 100)).toBe(true);
  });
});

describe("invalidateSubject", () => {
  it("revalidates the frozen rbac:{userId} tag with no stale window (immediate, security-sensitive)", async () => {
    revalidateTag.mockClear();
    await invalidateSubject("user-42");
    expect(revalidateTag).toHaveBeenCalledWith("rbac:user-42", { expire: 0 });
  });
});
