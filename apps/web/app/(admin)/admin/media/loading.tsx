import { getTranslations } from "next-intl/server";
import { PageHeaderSkeleton } from "@repo/ui/components/page-skeletons";
import { Skeleton } from "@repo/ui/components/skeleton";

// The media library's pending shape (changes-21 Phase A): header, the 36px
// toolbar, then the tile grid in the library's own columns — a table
// skeleton here would be the wrong shape for a grid of thumbnails.
export default async function MediaLoading() {
  const t = await getTranslations("admin");
  return (
    <div role="status" aria-live="polite" aria-busy className="flex w-full flex-col gap-6">
      <span className="sr-only">{t("loading")}</span>
      <PageHeaderSkeleton actions />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-full sm:w-64" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 15 }, (_, index) => (
          <Skeleton key={index} className="aspect-square w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
