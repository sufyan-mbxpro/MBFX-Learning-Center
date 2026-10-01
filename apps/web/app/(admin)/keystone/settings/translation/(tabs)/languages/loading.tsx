import { getTranslations } from "next-intl/server";
import { TablePageSkeleton } from "@repo/ui/components/page-skeletons";

// A list of languages, not a form.
export default async function Loading() {
  const t = await getTranslations("admin");
  return <TablePageSkeleton label={t("loading")} />;
}
