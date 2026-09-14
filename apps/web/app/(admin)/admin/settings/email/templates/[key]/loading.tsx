import { getTranslations } from "next-intl/server";
import { EditorPageSkeleton } from "@repo/ui/components/page-skeletons";

// The template editor is a two-column editor, not a settings form — so it owns
// its own skeleton rather than inheriting `settings/loading.tsx`'s form shape
// (changes-21 Phase A; `loading-states.test.ts` requires this of every record
// route).
export default async function Loading() {
  const t = await getTranslations("admin");
  return <EditorPageSkeleton label={t("loading")} />;
}
