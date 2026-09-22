import { getTranslations } from "next-intl/server";
import { DetailPageSkeleton } from "@repo/ui/components/page-skeletons";

// One user record (changes-21 Phase A: one skeleton per page archetype, from @repo/ui).
export default async function Loading() {
  const t = await getTranslations("admin");
  return <DetailPageSkeleton label={t("loading")} cards={3} />;
}
