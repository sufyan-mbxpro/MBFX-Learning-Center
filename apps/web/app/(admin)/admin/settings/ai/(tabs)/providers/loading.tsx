import { getTranslations } from "next-intl/server";
import { DetailPageSkeleton } from "@repo/ui/components/page-skeletons";

// A grid of provider cards, not a table.
export default async function Loading() {
  const t = await getTranslations("admin");
  return <DetailPageSkeleton label={t("loading")} cards={2} />;
}
