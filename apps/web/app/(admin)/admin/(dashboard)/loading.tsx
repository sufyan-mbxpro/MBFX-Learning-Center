import { getTranslations } from "next-intl/server";
import { DashboardSkeleton } from "@repo/ui/components/page-skeletons";

// The dashboard's own pending shape (changes-21 Phase A). It sits in a route
// group so it wraps ONLY `/admin`: `admin/loading.tsx` above stays the generic
// spinner every other admin route falls back to, which a dashboard-shaped
// skeleton would be wrong for.
export default async function DashboardLoading() {
  const t = await getTranslations("admin");
  return <DashboardSkeleton label={t("loading")} />;
}
