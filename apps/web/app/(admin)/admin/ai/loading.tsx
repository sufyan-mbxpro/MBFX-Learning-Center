import { getTranslations } from "next-intl/server";
import { DashboardSkeleton } from "@repo/ui/components/page-skeletons";

// The usage screen: four tiles, then charts, then the recent-calls table.
// (changes-21 Phase A: one skeleton per page archetype, from @repo/ui.)
export default async function Loading() {
  const t = await getTranslations("admin");
  return <DashboardSkeleton label={t("loading")} />;
}
