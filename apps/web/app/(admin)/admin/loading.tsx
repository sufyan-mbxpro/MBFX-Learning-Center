import { getTranslations } from "next-intl/server";
import { PageLoader } from "@repo/ui/components/page-loader";

// Route-level pending state for every /admin/* navigation (changes-01,
// image-7: centered spinner + label inside the shell chrome).
export default async function AdminLoading() {
  const t = await getTranslations("admin");
  return <PageLoader label={t("loading")} />;
}
