import { getTranslations } from "next-intl/server";
import { DetailPageSkeleton } from "@repo/ui/components/page-skeletons";

// The tools list (changes-25 T5) is a CARD GRID, not a table — eight cards
// of a known length, so the detail archetype fits where the table one would
// draw rows that never appear.
// (changes-21 Phase A: one skeleton per page archetype, from @repo/ui.)
export default async function Loading() {
  const t = await getTranslations("admin");
  return <DetailPageSkeleton label={t("loading")} cards={4} />;
}
