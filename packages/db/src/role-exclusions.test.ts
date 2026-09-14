// security.md #4 and ADR-078 #4 — nothing below `super_admin` holds an
// escalation key.
//
// Half of this is a unit test of the constant; the other half has to read
// `prisma/seed.ts` as SOURCE, and that needs saying. The seed is a script that
// connects to a database and writes to it, so importing it to inspect `ROLES`
// would mean standing up MariaDB to assert a list of strings. The two check
// scripts (`check-permission-keys.mjs`, `check-email-templates.mjs`) read the
// same file the same way for the same reason.
//
// What makes source-reading sound here is the SHAPE of the claim: every role
// except `admin` and `read_only` lists its permissions as string literals, so
// "no role grants this key" is exactly "this key appears in no role's
// permissions array" — a textual property. `admin` is the filter through
// `isSuperAdminOnlyPermission`, which the unit half covers, and `read_only`
// takes `.view` keys, which the last test pins.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SUPER_ADMIN_ONLY_PERMISSIONS, isSuperAdminOnlyPermission } from "./role-exclusions.ts";

const seedPath = fileURLToPath(new URL("../prisma/seed.ts", import.meta.url));
const seed = readFileSync(seedPath, "utf8");

/** The `permissions: [ … ]` literal of every role that lists its keys. */
function roleArrayLiterals(source: string): string[] {
  return [...source.matchAll(/permissions:\s*\[([\s\S]*?)\]/g)].map((match) => match[1] ?? "");
}

describe("the exclusion list", () => {
  it("holds exactly the four keys the ADRs name", () => {
    // A fifth entry is a privilege decision and needs its own ADR — this
    // failing is the prompt to write one, not to update the expectation.
    expect([...SUPER_ADMIN_ONLY_PERMISSIONS]).toEqual([
      "roles.manage",
      "permissions.assign",
      "users.impersonate",
      "email.settings.manage",
    ]);
  });

  it("includes email.settings.manage (ADR-078 #4)", () => {
    expect(isSuperAdminOnlyPermission("email.settings.manage")).toBe(true);
  });

  it("does not exclude the other email keys — templates, tests and the log are `admin`", () => {
    for (const key of [
      "email.templates.view",
      "email.templates.update",
      "email.templates.test",
      "email.log.view",
    ]) {
      expect(isSuperAdminOnlyPermission(key)).toBe(false);
    }
  });
});

describe("the seed grants none of them to a named role", () => {
  it("builds `admin` by filtering through the constant, not an inline list", () => {
    expect(seed).toContain("!isSuperAdminOnlyPermission(k)");
    // The inline array this replaced must not come back beside it.
    expect(seed).not.toMatch(/"roles\.manage",\s*\n?\s*"permissions\.assign"/);
  });

  it.each([...SUPER_ADMIN_ONLY_PERMISSIONS])("no role's permissions array lists %s", (key) => {
    const listed = roleArrayLiterals(seed).filter((literal) => literal.includes(`"${key}"`));
    expect(listed).toEqual([]);
  });

  it("read_only takes only `.view` keys, so it cannot pick one up", () => {
    expect(seed).toContain('k.endsWith(".view")');
    for (const key of SUPER_ADMIN_ONLY_PERMISSIONS) {
      expect(key.endsWith(".view")).toBe(false);
    }
  });

  it("registers every email key exactly once, in the permission registry", () => {
    // `support` is granted `email.log.view` explicitly, so that one appears
    // twice by design; the rest appear only where they are declared.
    for (const key of ["email.settings.manage", "email.templates.update", "email.templates.test"]) {
      expect(seed.split(`"${key}"`).length - 1).toBe(1);
    }
    expect(seed.split('"email.log.view"').length - 1).toBe(2);
  });
});
