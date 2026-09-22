import { getTranslations } from "next-intl/server";
import { FormPageSkeleton } from "@repo/ui/components/page-skeletons";

// Profile: the details form and the password form (changes-21 Phase A: one skeleton per page archetype, from @repo/ui).
export default async function Loading() {
  const t = await getTranslations("admin");
  return <FormPageSkeleton label={t("loading")} sections={2} fields={2} />;
}
