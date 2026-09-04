import { describe, expect, it } from "vitest";
import {
  extractSeedRegistry,
  findPermissionUsages,
  findUnregisteredPermissions,
  run,
} from "../check-permission-keys.mjs";

const seedFixture = `
const PERMISSIONS = [
  ["content", "lessons.view", "View lessons"],
  ["content", "lessons.delete", "Delete lessons"],
  ["users", "users.impersonate", "Impersonate users"],
] as const;
`;

describe("check:permission-keys — extractSeedRegistry", () => {
  it("extracts the flat key (second tuple element), not the group or label", () => {
    const registry = extractSeedRegistry(seedFixture);
    expect([...registry].sort()).toEqual([
      "lessons.delete",
      "lessons.view",
      "users.impersonate",
    ]);
  });
});

describe("check:permission-keys — findPermissionUsages", () => {
  it("finds requirePermission, requireAnyPermission (each array entry), and <Can permission=", () => {
    const files = [
      {
        path: "a.ts",
        source: [
          `await requirePermission("lessons.view");`,
          `await requireAnyPermission(["lessons.delete", "users.impersonate"]);`,
          `<Can permission="lessons.publish">`,
        ].join("\n"),
      },
    ];
    const keys = findPermissionUsages(files).map((u) => u.key);
    expect(keys.sort()).toEqual([
      "lessons.delete",
      "lessons.publish",
      "lessons.view",
      "users.impersonate",
    ]);
  });

  it("ignores a computed/dynamic permission argument (nothing to statically check)", () => {
    const files = [{ path: "b.ts", source: `await requirePermission(permKeyVariable);` }];
    expect(findPermissionUsages(files)).toEqual([]);
  });
});

describe("check:permission-keys — findUnregisteredPermissions", () => {
  it("flags a typo'd key not present in the registry — the silent-403 bug", () => {
    const registry = extractSeedRegistry(seedFixture);
    const files = [{ path: "c.ts", source: `await requirePermission("lessons.viwe");` }];
    expect(findUnregisteredPermissions(files, registry)).toEqual([
      { file: "c.ts", key: "lessons.viwe" },
    ]);
  });

  it("passes a correctly-spelled registered key", () => {
    const registry = extractSeedRegistry(seedFixture);
    const files = [{ path: "d.ts", source: `await requirePermission("lessons.view");` }];
    expect(findUnregisteredPermissions(files, registry)).toEqual([]);
  });
});

describe("check:permission-keys — live workspace", () => {
  it("every permission string in the real repo exists in the real seed registry", () => {
    expect(run()).toBe(0);
  });
});
