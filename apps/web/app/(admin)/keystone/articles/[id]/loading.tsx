import { getTranslations } from "next-intl/server";
import { EditorPageSkeleton } from "@repo/ui/components/page-skeletons";

// The article editor: tabs over the main column and the aside (changes-21 Phase A: one skeleton per page archetype, from @repo/ui).
export default async function Loading() {
  const t = await getTranslations("admin");
  return <EditorPageSkeleton label={t("loading")} />;
}
