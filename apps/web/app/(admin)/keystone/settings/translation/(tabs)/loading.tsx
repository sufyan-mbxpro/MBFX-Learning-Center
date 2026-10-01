import { getTranslations } from "next-intl/server";
import { DashboardSkeleton } from "@repo/ui/components/page-skeletons";

// The overview: three tiles, then the languages and failures tables.
export default async function Loading() {
  const t = await getTranslations("admin");
  return <DashboardSkeleton label={t("loading")} />;
}
