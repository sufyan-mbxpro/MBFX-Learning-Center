"use client";

// THE canonical URL-state writer for filterable admin lists. One semantics
// everywhere: empty/null removes the param, changing any filter resets the
// page (unless the patch itself is paging), and replace() keeps history
// clean while the server component re-renders with the new searchParams.
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Any filter change invalidates the current page — unless the caller
      // is explicitly paging.
      if (!("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return setParams;
}
