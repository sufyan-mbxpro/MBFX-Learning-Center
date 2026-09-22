import { getTranslations } from "next-intl/server";
import { FormPageSkeleton } from "@repo/ui/components/page-skeletons";

// One provider: the connection form, and (on an existing row) its models.
export default async function Loading() {
  const t = await getTranslations("admin");
  return <FormPageSkeleton label={t("loading")} />;
}
