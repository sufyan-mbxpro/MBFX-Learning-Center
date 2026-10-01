// ADR-169 / changes-53 — the review platforms the "Share your experience"
// band can send a reader to. The SET of platforms is code; whether each is
// on, its order, its identifier and its override are data
// (`review_platforms`, edited at Settings → General → Reviews).
//
// The admin types a PUBLIC identifier and the registry builds the
// write-a-review address, so nobody has to find the vendor's deep link. A
// custom https link overrides the built one for every platform, because a
// vendor that changes its URLs should not have to wait for a deploy.
import { z } from "zod";
import { externalUrlSchema } from "./learn.ts";

export const REVIEW_PLATFORM_KEYS = ["trustpilot", "google", "facebook"] as const;
export type ReviewPlatformKey = (typeof REVIEW_PLATFORM_KEYS)[number];
export const reviewPlatformKeySchema = z.enum(REVIEW_PLATFORM_KEYS);

// A registrable domain: labels of letters, digits and inner hyphens, ending in
// a TLD. No scheme, no path — `/evaluate/{domain}` is the whole address.
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
// Google Place IDs are URL-safe base64-ish tokens (`ChIJ…`).
const PLACE_ID = /^[A-Za-z0-9_-]{10,200}$/;
// A Facebook Page username (letters, digits, periods; at least five) or its
// numeric id, which the same pattern admits.
const PAGE_NAME = /^[A-Za-z0-9.]{5,100}$/;

interface ReviewPlatformDefinition {
  /** Normalises what was typed, then tests it. */
  normalize: (input: string) => string;
  pattern: RegExp;
  buildUrl: (identifier: string) => string;
}

export const REVIEW_PLATFORMS: Record<ReviewPlatformKey, ReviewPlatformDefinition> = {
  trustpilot: {
    // A pasted "https://www.mbfx.co/" is what an admin will reach for; the
    // domain inside it is what they meant.
    normalize: (input) =>
      input
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/+$/, ""),
    pattern: DOMAIN,
    buildUrl: (domain) => `https://www.trustpilot.com/evaluate/${encodeURIComponent(domain)}`,
  },
  google: {
    normalize: (input) => input.trim(),
    pattern: PLACE_ID,
    buildUrl: (placeId) =>
      `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`,
  },
  facebook: {
    // Facebook has no direct compose address; the Page's Reviews tab is where
    // a visitor recommends it. "@name" is how a Page is often written.
    normalize: (input) => input.trim().replace(/^@/, ""),
    pattern: PAGE_NAME,
    buildUrl: (page) => `https://www.facebook.com/${encodeURIComponent(page)}/reviews`,
  },
};

/** The identifier as the registry will use it, or null when it is not one. */
export function normalizeReviewIdentifier(
  platform: ReviewPlatformKey,
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const definition = REVIEW_PLATFORMS[platform];
  const value = definition.normalize(input);
  return definition.pattern.test(value) ? value : null;
}

/**
 * The address a reader is sent to: the custom link when it is a valid https
 * URL, else the one built from the identifier, else null. Re-validated at
 * READ time as well as on save, so a row edited outside the admin can never
 * put a `javascript:` link on a public page.
 */
export function resolveReviewUrl(row: {
  platform: string;
  identifier: string | null;
  customUrl: string | null;
}): string | null {
  const key = reviewPlatformKeySchema.safeParse(row.platform);
  if (!key.success) return null;
  const custom = row.customUrl?.trim();
  if (custom) return externalUrlSchema.safeParse(custom).success ? custom : null;
  const identifier = normalizeReviewIdentifier(key.data, row.identifier);
  return identifier ? REVIEW_PLATFORMS[key.data].buildUrl(identifier) : null;
}

const reviewPlatformRowSchema = z
  .object({
    platform: reviewPlatformKeySchema,
    isEnabled: z.boolean(),
    identifier: z.string().max(200),
    customUrl: z.union([z.literal(""), externalUrlSchema]),
  })
  .superRefine((row, ctx) => {
    const typed = row.identifier.trim();
    if (typed && !normalizeReviewIdentifier(row.platform, typed)) {
      ctx.addIssue({
        code: "custom",
        path: ["identifier"],
        params: { code: "invalidFormat" },
        message: "not a valid identifier for this platform",
      });
    }
    // A switched-on platform with nothing to link to would draw no button and
    // tell nobody why (ADR-169 #4). Named on the identifier, the field an
    // admin fills first.
    if (row.isEnabled && !typed && !row.customUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["identifier"],
        params: { code: "required" },
        message: "an enabled platform needs an identifier or a custom link",
      });
    }
  });

/**
 * The whole Reviews tab in one save. Array order IS the display order, and
 * every registry key appears exactly once, so a save can neither lose a
 * platform nor invent one.
 */
export const reviewPlatformsSaveSchema = z.object({
  platforms: z
    .array(reviewPlatformRowSchema)
    .length(REVIEW_PLATFORM_KEYS.length)
    .refine((rows) => new Set(rows.map((r) => r.platform)).size === REVIEW_PLATFORM_KEYS.length, {
      message: "every platform exactly once",
    }),
});
export type ReviewPlatformsSaveInput = z.infer<typeof reviewPlatformsSaveSchema>;
