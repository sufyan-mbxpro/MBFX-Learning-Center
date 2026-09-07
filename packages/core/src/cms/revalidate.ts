// ADR-025 tag vocabulary, the page half. Always `revalidateTag(tag,
// { expire: 0 })` — never revalidatePath, never a route-level `revalidate`
// export (architecture.md #12).
import { revalidateTag } from "next/cache";
import type { PageKind } from "@repo/db";

export function revalidatePageTags(params: {
  id: string;
  translations: { locale: string; path: string }[];
  kind: PageKind;
  contentType: string | null;
}): void {
  revalidateTag(`page:${params.id}`, { expire: 0 });
  for (const t of params.translations) {
    revalidateTag(`page-path:${t.locale}:${t.path}`, { expire: 0 });
  }
  if ((params.kind as string) === "DETAIL" && params.contentType) {
    revalidateTag(`layout:${params.contentType}`, { expire: 0 });
  }
}
