// Which linked-content types a public reader cannot reach right now because a
// feature flag switched their section off (ADR-167, changes-52 P4).
//
// Flags gate at the ROUTE, never in @repo/core — the repo's rule for every
// flagged surface, and the reason `/api/search` carries the same map. A
// promotion linking into a switched-off section is hidden exactly like one
// linking to a draft, instead of sending a visitor to a 404.
//
// Shared by the popup's endpoint and the home band, so the two cannot disagree
// about what is reachable.
import type { PromotionTargetTypeInput } from "@repo/contracts";
import { isFeatureVisible } from "@repo/settings";

export const PROMOTION_TARGET_FLAGS: Record<PromotionTargetTypeInput, string> = {
  COURSE: "courses",
  LESSON: "courses",
  QUIZ: "quizzes",
  ARTICLE: "news",
  VIDEO_TOPIC: "videos",
  GLOSSARY_TERM: "glossary",
  TOOL: "calculators",
};

/**
 * Sorted, so equal sets are one cache entry in `getLivePromotions`.
 *
 * `null` subject on purpose, as `/api/search` does: these surfaces read no
 * session, so a flag scoped to AUTHENTICATED correctly counts as off.
 */
export async function unavailablePromotionTargets(): Promise<PromotionTargetTypeInput[]> {
  const entries = Object.entries(PROMOTION_TARGET_FLAGS) as [PromotionTargetTypeInput, string][];
  const visible = await Promise.all(entries.map(([, flag]) => isFeatureVisible(flag, null)));
  return entries
    .filter((_, index) => !visible[index])
    .map(([type]) => type)
    .sort();
}
