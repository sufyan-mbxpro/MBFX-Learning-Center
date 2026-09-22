import { getTranslations } from "next-intl/server";
import { EditorPageSkeleton } from "@repo/ui/components/page-skeletons";

// The tool editor (changes-25 T5): main column plus a settings rail.
// (changes-21 Phase A: one skeleton per page archetype, from @repo/ui.)
export default async function Loading() {
  const t = await getTranslations("admin");
  return <EditorPageSkeleton label={t("loading")} />;
}
