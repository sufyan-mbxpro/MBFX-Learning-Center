// sourceHash lifecycle (SKILL.md required test): edit English lesson →
// Spanish translation flips OUTDATED, retranslate → back to normal.
import { describe, expect, it } from "vitest";
import { computeSourceHash, isTranslationOutdated } from "./source-hash.ts";

describe("computeSourceHash", () => {
  it("is deterministic for identical content", () => {
    expect(computeSourceHash("Pip value formula")).toBe(computeSourceHash("Pip value formula"));
  });

  it("changes when the source content changes", () => {
    expect(computeSourceHash("Pip value formula")).not.toBe(
      computeSourceHash("Pip value formula v2"),
    );
  });

  it("is a 64-character hex string (SHA-256)", () => {
    expect(computeSourceHash("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isTranslationOutdated — lifecycle", () => {
  it("a never-translated row (null storedSourceHash) is NOT 'outdated' — it's simply untranslated, a different state", () => {
    expect(isTranslationOutdated(computeSourceHash("Lesson v1"), null)).toBe(false);
  });

  it("a translation matching the current source hash is up to date", () => {
    const hash = computeSourceHash("Lesson v1");
    expect(isTranslationOutdated(hash, hash)).toBe(false);
  });

  it("edit English lesson (source hash changes) → the Spanish translation flips OUTDATED", () => {
    const originalHash = computeSourceHash("Lesson v1");
    const editedHash = computeSourceHash("Lesson v2 — corrected pip formula");
    // Spanish translation was made against v1.
    expect(isTranslationOutdated(editedHash, originalHash)).toBe(true);
  });

  it("retranslate against the new source → back to up to date", () => {
    const editedHash = computeSourceHash("Lesson v2 — corrected pip formula");
    expect(isTranslationOutdated(editedHash, editedHash)).toBe(false);
  });
});
