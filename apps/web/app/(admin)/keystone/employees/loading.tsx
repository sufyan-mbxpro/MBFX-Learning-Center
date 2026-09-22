import { getTranslations } from "next-intl/server";
import { TablePageSkeleton } from "@repo/ui/components/page-skeletons";

// List screen: header, toolbar, compact table (changes-21 Phase A: one skeleton per page archetype, from @repo/ui).
export default async function Loading() {
  const t = await getTranslations("admin");
  return <TablePageSkeleton label={t("loading")} />;
}
