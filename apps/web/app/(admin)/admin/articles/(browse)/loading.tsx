import { getTranslations } from "next-intl/server";
import { TablePageSkeleton } from "@repo/ui/components/page-skeletons";

// List screen: toolbar and compact table only. The heading and the tab strip
// belong to `(browse)/layout.tsx`, which stays mounted across a tab click, so
// this skeleton must not draw a second header under them (ADR-140 §4).
export default async function Loading() {
  const t = await getTranslations("admin");
  return <TablePageSkeleton label={t("loading")} filters={2} header={false} />;
}
