import { getTranslations } from "next-intl/server";
import { TablePageSkeleton } from "@repo/ui/components/page-skeletons";

// A list, and the Phase A rule: the skeleton reserves the shape the screen
// lands in, so the counts row and the table do not push each other about.
export default async function Loading() {
  const t = await getTranslations("admin");
  return <TablePageSkeleton label={t("loading")} />;
}
