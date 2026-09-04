// Content-translation lifecycle utilities (Module 06 SKILL.md: "content
// translation utilities: sourceHash computation + the OUTDATED flip on
// source change"). Pure functions — the write path that calls these when a
// Course/Lesson/GlossaryTerm source is saved belongs to Module 11's content
// services (the tables already exist per Module 01's schema; the CRUD that
// writes to them does not yet).
import { createHash } from "node:crypto";

/** SHA-256 hex digest of the source-locale content, stored on each translation row (`sourceHash` column) at translation time. */
export function computeSourceHash(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

/**
 * A translation is OUTDATED when it was translated against an earlier
 * version of the source (`storedSourceHash` set, but no longer matching).
 * `null` means "never translated" — a DRAFT row with nothing to compare
 * against yet, a different state from OUTDATED, so this returns `false`
 * for it rather than treating "not yet translated" as "translation stale."
 */
export function isTranslationOutdated(
  currentSourceHash: string,
  storedSourceHash: string | null,
): boolean {
  return storedSourceHash !== null && storedSourceHash !== currentSourceHash;
}
