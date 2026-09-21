"use client";

// THE canonical URL-state writer for filterable admin lists. One semantics
// everywhere: empty/null removes the param, changing any filter resets the
// page (unless the patch itself is paging), and replace() keeps history
// clean while the server component re-renders with the new searchParams.
//
// changes-44 #1: a page, sort or filter change reads as the table changing,
// not the screen reloading — the /news listing's treatment (changes-39). The
// write runs in a transition with `scroll: false`, so the current rows stay on
// screen and the window does not jump; `useUrlFiltersPending()` tells the
// table to dim them meanwhile, and `DataTable` brings its own top back into
// view when the new page lands, only if that top had scrolled away.
//
// The pending flag is a tiny module store rather than a return value because
// the writer and the table are often different components (the articles
// filters live in the page's controls, the pager in the table), and a filter
// change should dim the same rows a page change does.
import { useCallback, useEffect, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

let pendingWrites = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function track(delta: number) {
  pendingWrites += delta;
  for (const listener of listeners) listener();
}

/** True while any `useUrlFilters` write on the screen is waiting on the server. */
export function useUrlFiltersPending(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => pendingWrites > 0,
    () => false,
  );
}

export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!pending) return;
    track(1);
    return () => track(-1);
  }, [pending]);

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
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  return setParams;
}
