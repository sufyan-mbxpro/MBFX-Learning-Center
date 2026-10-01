// ADR-169 / changes-53 — the review platforms behind the "Share your
// experience" band. The set of platforms is `REVIEW_PLATFORM_KEYS`
// (@repo/contracts); a row holds one platform's switch, order, identifier and
// custom link. Links only: nothing here calls a vendor or holds a secret.
//
// Cached under `settings:general`, the tag `site.reviewsUrl` lived under
// before this table replaced it, so the band's invalidation lifecycle is the
// one it always had (architecture.md #12: no new tag).
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { db } from "@repo/db";
import {
  REVIEW_PLATFORM_KEYS,
  normalizeReviewIdentifier,
  resolveReviewUrl,
  type ReviewPlatformKey,
  type ReviewPlatformsSaveInput,
} from "@repo/contracts";
import { recordAudit } from "./index.ts";

export const REVIEW_PLATFORMS_TAG = "settings:general";

export interface ReviewPlatformAdminRow {
  platform: ReviewPlatformKey;
  isEnabled: boolean;
  identifier: string;
  customUrl: string;
  /** What a visitor would be sent to with the SAVED values; null = no button. */
  resolvedUrl: string | null;
}

export interface ReviewLink {
  platform: ReviewPlatformKey;
  url: string;
}

const isKey = (value: string): value is ReviewPlatformKey =>
  (REVIEW_PLATFORM_KEYS as readonly string[]).includes(value);

/**
 * Every registry platform in display order. A registry key with no row yet
 * (a platform added after this install was seeded) appears switched off at
 * the end, so adding a platform needs no data migration. A row whose key the
 * registry no longer lists is ignored.
 */
export async function listReviewPlatforms(): Promise<ReviewPlatformAdminRow[]> {
  const rows = await db.reviewPlatform.findMany({
    orderBy: [{ sortOrder: "asc" }, { platform: "asc" }],
    select: { platform: true, isEnabled: true, identifier: true, customUrl: true },
  });
  const known = rows.filter((row) => isKey(row.platform));
  const present = new Set(known.map((row) => row.platform));
  const missing = REVIEW_PLATFORM_KEYS.filter((key) => !present.has(key)).map((platform) => ({
    platform,
    isEnabled: false,
    identifier: null,
    customUrl: null,
  }));
  return [...known, ...missing].map((row) => ({
    platform: row.platform as ReviewPlatformKey,
    isEnabled: row.isEnabled,
    identifier: row.identifier ?? "",
    customUrl: row.customUrl ?? "",
    resolvedUrl: resolveReviewUrl(row),
  }));
}

/**
 * Saves the whole Reviews tab in one transaction; array order becomes
 * `sortOrder`. The caller has already run `requirePermission("settings.update")`
 * and parsed the input with `reviewPlatformsSaveSchema` (security.md #1, #6).
 * The identifier is stored normalised (a pasted "https://www.mbfx.co/" is
 * stored as "mbfx.co"), so the preview and the public link agree.
 */
export async function saveReviewPlatforms(
  actorId: string,
  input: ReviewPlatformsSaveInput,
): Promise<void> {
  const before = await listReviewPlatforms();
  const after = input.platforms.map((row, sortOrder) => ({
    platform: row.platform,
    isEnabled: row.isEnabled,
    sortOrder,
    identifier: normalizeReviewIdentifier(row.platform, row.identifier),
    customUrl: row.customUrl.trim() || null,
  }));

  await db.$transaction(
    after.map((row) =>
      db.reviewPlatform.upsert({
        where: { platform: row.platform },
        update: { ...row, updatedById: actorId },
        create: { ...row, updatedById: actorId },
      }),
    ),
  );

  await recordAudit({
    userId: actorId,
    action: "reviewPlatforms.update",
    entityType: "reviewPlatform",
    entityId: "all",
    changes: {
      before: before.map(({ resolvedUrl: _resolved, ...row }) => row),
      after,
    },
  });
  revalidateTag(REVIEW_PLATFORMS_TAG, { expire: 0 });
}

/** Pure DB read, exported for tests (ADR-004). Enabled rows that resolve to a link, in order. */
export async function loadActiveReviewLinks(): Promise<ReviewLink[]> {
  const rows = await db.reviewPlatform.findMany({
    where: { isEnabled: true },
    orderBy: [{ sortOrder: "asc" }, { platform: "asc" }],
    select: { platform: true, identifier: true, customUrl: true },
  });
  const links: ReviewLink[] = [];
  for (const row of rows) {
    if (!isKey(row.platform)) continue;
    const url = resolveReviewUrl(row);
    // A switched-on row with nothing valid to link to draws no button,
    // rather than a button that goes nowhere (ADR-169 #4).
    if (url) links.push({ platform: row.platform, url });
  }
  return links;
}

/** The public read: what the reviews band draws. Never the identifier column itself. */
export async function getActiveReviewLinks(): Promise<ReviewLink[]> {
  "use cache";
  cacheTag(REVIEW_PLATFORMS_TAG);
  cacheLife({ revalidate: 3600 });
  return loadActiveReviewLinks();
}
