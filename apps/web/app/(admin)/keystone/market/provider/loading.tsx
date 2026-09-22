import { getTranslations } from "next-intl/server";
import { FormPageSkeleton } from "@repo/ui/components/page-skeletons";

// The provider form (changes-25 T4): header and three stacked sections.
// (changes-21 Phase A: one skeleton per page archetype, from @repo/ui.)
export default async function Loading() {
  const t = await getTranslations("admin");
  return <FormPageSkeleton label={t("loading")} />;
}
