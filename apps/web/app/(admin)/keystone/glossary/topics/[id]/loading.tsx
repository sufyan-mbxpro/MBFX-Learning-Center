import { getTranslations } from "next-intl/server";
import { EditorPageSkeleton } from "@repo/ui/components/page-skeletons";

// The topic editor (no tab tray) (changes-21 Phase A: one skeleton per page archetype, from @repo/ui).
export default async function Loading() {
  const t = await getTranslations("admin");
  return <EditorPageSkeleton label={t("loading")} tabs={0} />;
}
