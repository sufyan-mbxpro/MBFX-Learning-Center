"use client";

// The shelves' pager strings (changes-37, ADR-121 §2), from `common.pagination`
// — the same keys `/news`'s NumberedPagination reads, so the two pagers cannot
// drift apart in wording either. A hook rather than a prop from the page: the
// page-number name is a function of client state, and a function prop cannot
// cross the RSC boundary.
import { useTranslations } from "next-intl";
import type { ClientPaginationLabels } from "@repo/ui/components/client-pagination";

export function usePaginationLabels(): ClientPaginationLabels {
  const t = useTranslations("common.pagination");
  return {
    label: t("label"),
    previous: t("previous"),
    next: t("next"),
    morePages: t("morePages"),
    page: (page) => t("page", { page }),
  };
}
