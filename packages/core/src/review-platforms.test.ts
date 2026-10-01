// ADR-169: @repo/db keeps a copy of the platform list for the seed, because it
// sits below @repo/contracts. This package depends on both, so it holds the
// two equal — the TRANSLATABLE_SETTING_KEY_LIST arrangement.
import { describe, expect, it } from "vitest";
import { REVIEW_PLATFORM_SEED_DEFAULTS, REVIEW_PLATFORM_SEED_KEYS } from "@repo/db";
import { REVIEW_PLATFORM_KEYS, resolveReviewUrl } from "@repo/contracts";

describe("review platform seed", () => {
  it("seeds exactly the registry's platforms, in its order", () => {
    expect([...REVIEW_PLATFORM_SEED_KEYS]).toEqual([...REVIEW_PLATFORM_KEYS]);
  });

  it("seeds every enabled platform with a link that resolves", () => {
    for (const platform of REVIEW_PLATFORM_SEED_KEYS) {
      const row = REVIEW_PLATFORM_SEED_DEFAULTS[platform];
      if (!row.isEnabled) continue;
      expect(resolveReviewUrl({ platform, ...row })).toMatch(/^https:\/\//);
    }
  });

  it("keeps the address site.reviewsUrl was seeded with (ADR-135), so a fresh band is unchanged", () => {
    expect(
      resolveReviewUrl({ platform: "trustpilot", ...REVIEW_PLATFORM_SEED_DEFAULTS.trustpilot }),
    ).toBe("https://www.trustpilot.com/review/mbfx.co");
  });
});
