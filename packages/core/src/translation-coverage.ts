// Coverage arithmetic for the translation dashboard (ADR-163 #6). Pure and
// dependency-free apart from the status enum, so it is unit-testable without
// loading the content services the type registry imports.
import type { TranslationStatus } from "@repo/db";

/** A translation's state as the dashboard counts it; `missing` is "no row". */
export type CoverageBucket = "machine" | "human" | "outdated" | "needsReview" | "draft" | "missing";

export type CoverageCounts = Record<CoverageBucket, number> & { total: number };

const STATUS_BUCKET: Record<TranslationStatus, CoverageBucket> = {
  MACHINE_TRANSLATED: "machine",
  TRANSLATED: "human",
  OUTDATED: "outdated",
  NEEDS_REVIEW: "needsReview",
  DRAFT: "draft",
};

export function emptyCoverage(): CoverageCounts {
  return { total: 0, machine: 0, human: 0, outdated: 0, needsReview: 0, draft: 0, missing: 0 };
}

/** Counts by status into buckets, with `missing` = sources that have no row. */
export function toCoverage(
  total: number,
  byStatus: ReadonlyArray<{ status: TranslationStatus; count: number }>,
): CoverageCounts {
  const counts = emptyCoverage();
  counts.total = total;
  let present = 0;
  for (const { status, count } of byStatus) {
    counts[STATUS_BUCKET[status]] += count;
    present += count;
  }
  // A translation row can outlive its source's English text; never below zero.
  counts.missing = Math.max(0, total - present);
  return counts;
}

/** Adds `from` into `into`, bucket by bucket. */
export function addCoverage(into: CoverageCounts, from: CoverageCounts): void {
  for (const key of Object.keys(into) as Array<keyof CoverageCounts>) into[key] += from[key];
}
