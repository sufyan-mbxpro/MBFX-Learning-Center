// The interval pickers' one invariant: an option the admin can choose is an
// option the schema accepts. The choices and the bounds are two declarations
// of the same range, and a picker offering a value the server then rejects is
// the failure mode this file exists to make impossible.
import { describe, expect, it } from "vitest";

import { MARKET_REFRESH_CHOICES, MARKET_STALE_CHOICES, marketProviderSchema } from "./market.ts";

const base = {
  driver: "ALPHAVANTAGE" as const,
  baseUrl: "https://www.alphavantage.co",
  isEnabled: true,
};

describe("market interval choices", () => {
  it.each(MARKET_REFRESH_CHOICES)("accepts %i as a refresh interval", (seconds) => {
    expect(
      marketProviderSchema.safeParse({ ...base, refreshSeconds: seconds, staleSeconds: 86_400 })
        .success,
    ).toBe(true);
  });

  it.each(MARKET_STALE_CHOICES)("accepts %i as a stale window", (seconds) => {
    expect(
      marketProviderSchema.safeParse({ ...base, refreshSeconds: 300, staleSeconds: seconds })
        .success,
    ).toBe(true);
  });

  it("offers each value once, in ascending order", () => {
    for (const list of [MARKET_REFRESH_CHOICES, MARKET_STALE_CHOICES]) {
      expect(new Set(list).size).toBe(list.length);
      expect([...list]).toEqual([...list].sort((a, b) => a - b));
    }
  });

  it("still treats a blank API key as unchanged", () => {
    // Pinned here because the picker rewrites this form: editing an interval
    // must not be the save that wipes the credential (ADR-087 #5).
    const parsed = marketProviderSchema.parse({
      ...base,
      refreshSeconds: 300,
      staleSeconds: 86_400,
    });
    expect(parsed.apiKey).toBeUndefined();
  });
});
