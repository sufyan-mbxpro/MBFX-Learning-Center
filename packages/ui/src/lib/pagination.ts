// The arithmetic both public pagers share (changes-37, ADR-121 §2).
//
// There are two pagers on the public site and they must look and count the
// same: `/news`'s, which NAVIGATES (a news page is a real, indexable URL), and
// the learn shelves', which pages a list already in the payload without a
// round trip. One window rule, one page size, written once — a second copy of
// `pageWindow` is how two pagers come to disagree about where the ellipsis
// goes.

/** Cards per page on every client-paged shelf (owner, changes-37). */
export const DEFAULT_PAGE_SIZE = 6;

/**
 * Which page numbers to show: always the first and last, plus the current
 * page and its neighbours, with `"gap"` standing in for a run of hidden ones.
 * Zero-based in, zero-based out; seven pages or fewer are all shown.
 */
export function pageWindow(current: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);

  const pages = new Set<number>([0, pageCount - 1, current]);
  for (const offset of [-1, 1]) {
    const page = current + offset;
    if (page > 0 && page < pageCount - 1) pages.add(page);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let previous: number | null = null;
  for (const page of sorted) {
    if (previous !== null && page - previous > 1) out.push("gap");
    out.push(page);
    previous = page;
  }
  return out;
}

/** How many pages `total` items fill. Never less than one: an empty list is one empty page. */
export function pageCountFor(total: number, pageSize = DEFAULT_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/** A requested page, clamped into range — a filter that shrank the list must not strand the reader past its end. */
export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(0, Math.trunc(page)), Math.max(0, pageCount - 1));
}

/** The items on one zero-based page. */
export function pageSlice<T>(items: readonly T[], page: number, pageSize = DEFAULT_PAGE_SIZE): T[] {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}
