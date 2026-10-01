import { describe, expect, it } from "vitest";
import { toCoverage } from "./translation-coverage.ts";

describe("toCoverage (ADR-163 #6)", () => {
  it("buckets statuses and counts sources with no row as missing", () => {
    expect(
      toCoverage(10, [
        { status: "MACHINE_TRANSLATED", count: 4 },
        { status: "TRANSLATED", count: 2 },
        { status: "OUTDATED", count: 1 },
        { status: "NEEDS_REVIEW", count: 1 },
      ]),
    ).toEqual({
      total: 10,
      machine: 4,
      human: 2,
      outdated: 1,
      needsReview: 1,
      draft: 0,
      missing: 2,
    });
  });

  it("never reports a negative gap", () => {
    // A row can outlive its source's English text; the count must not go below zero.
    expect(toCoverage(1, [{ status: "DRAFT", count: 3 }]).missing).toBe(0);
  });
});
