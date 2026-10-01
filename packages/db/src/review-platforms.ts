// The review platforms the seed creates rows for (ADR-169).
//
// A copy of `REVIEW_PLATFORM_KEYS` (@repo/contracts), because @repo/db sits
// below contracts and cannot import it. `@repo/core`, which depends on both,
// has a test holding the two lists equal — the `TRANSLATABLE_SETTING_KEY_LIST`
// arrangement. Array order is the seeded display order.
export const REVIEW_PLATFORM_SEED_KEYS = ["trustpilot", "google", "facebook"] as const;

/**
 * Trustpilot starts ON with the address `site.reviewsUrl` was seeded with
 * (ADR-135), so a fresh install shows the same band it did before ADR-169.
 * Google and Facebook start off: nothing to link to until an admin says so.
 */
export const REVIEW_PLATFORM_SEED_DEFAULTS: Record<
  (typeof REVIEW_PLATFORM_SEED_KEYS)[number],
  { isEnabled: boolean; identifier: string | null; customUrl: string | null }
> = {
  trustpilot: {
    isEnabled: true,
    identifier: "mbfx.co",
    customUrl: "https://www.trustpilot.com/review/mbfx.co",
  },
  google: { isEnabled: false, identifier: null, customUrl: null },
  facebook: { isEnabled: false, identifier: null, customUrl: null },
};
