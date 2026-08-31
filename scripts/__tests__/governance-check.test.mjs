import { describe, expect, it } from "vitest";
import { checkAdrRule, checkDevlogRule } from "../governance-check.mjs";

describe("governance:check — DEVLOG rule", () => {
  // The negative test plan.md Module 00 requires: a package change without a
  // DEVLOG entry must fail.
  it("FAILS when packages/* changes without a DEVLOG entry", () => {
    const result = checkDevlogRule(["packages/theme/src/index.ts"]);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("DEVLOG");
  });

  it("passes when packages/* changes together with the DEVLOG", () => {
    expect(
      checkDevlogRule(["packages/theme/src/index.ts", "docs/logs/DEVLOG.md"]).ok,
    ).toBe(true);
  });

  it("passes when nothing under packages/* changed", () => {
    expect(checkDevlogRule(["apps/web/app/(public)/page.tsx"]).ok).toBe(true);
  });
});

describe("governance:check — ADR append-only rule", () => {
  const noDiff = () => "";

  it("passes for newly added ADRs", () => {
    const entries = [{ status: "A", path: "docs/memory/decisions/ADR-011-x.md" }];
    expect(checkAdrRule(entries, noDiff).ok).toBe(true);
  });

  it("FAILS when an existing ADR body is modified", () => {
    const entries = [{ status: "M", path: "docs/memory/decisions/ADR-006-single-app-route-groups.md" }];
    const readDiff = () => "+We changed our minds about the consequences.\n-old line\n";
    const result = checkAdrRule(entries, readDiff);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("append-only");
  });

  it("allows the superseding flow's Status / Superseded-by header edits", () => {
    const entries = [{ status: "M", path: "docs/memory/decisions/ADR-002-prisma-version.md" }];
    const readDiff = () =>
      "-**Status:** Accepted\n+**Status:** Superseded\n-**Superseded by:** —\n+**Superseded by:** ADR-015-prisma-8.md\n";
    expect(checkAdrRule(entries, readDiff).ok).toBe(true);
  });

  it("FAILS when an ADR is deleted", () => {
    const entries = [{ status: "D", path: "docs/memory/decisions/ADR-002-prisma-version.md" }];
    expect(checkAdrRule(entries, noDiff).ok).toBe(false);
  });

  it("ignores non-ADR files in the decisions dir", () => {
    const entries = [{ status: "M", path: "docs/memory/stack.md" }];
    expect(checkAdrRule(entries, noDiff).ok).toBe(true);
  });
});
