import { getTranslations } from "next-intl/server";
import { DetailPageSkeleton } from "@repo/ui/components/page-skeletons";

// One subscriber record (changes-45), the user record's archetype.
export default async function Loading() {
  const t = await getTranslations("admin");
  return <DetailPageSkeleton label={t("loading")} cards={3} />;
}
