import { getTranslations } from "next-intl/server";
import { DashboardSkeleton } from "@repo/ui/components/page-skeletons";

// Analytics: metric cards over chart cards (changes-21 Phase A: one skeleton per page archetype, from @repo/ui).
export default async function Loading() {
  const t = await getTranslations("admin");
  return <DashboardSkeleton label={t("loading")} />;
}
