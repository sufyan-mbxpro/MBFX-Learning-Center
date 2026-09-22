import { getTranslations } from "next-intl/server";
import { TablePageSkeleton } from "@repo/ui/components/page-skeletons";

// A list, not a form — `settings/loading.tsx` reserves a form's shape.
export default async function Loading() {
  const t = await getTranslations("admin");
  return <TablePageSkeleton label={t("loading")} />;
}
