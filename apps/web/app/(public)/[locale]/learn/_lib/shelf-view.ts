// The shelves' VIEW row — All · Featured · Popular · Newest (ADR-139 #5).
//
// Pure, so the rule is testable without a DOM (the same reason
// `assessment-state.ts` is a file of its own). The shelves hold every card in
// their cached payload, so a view is a filter and a sort over it in client
// state, never a URL (D26).

export const SHELF_VIEWS = ["all", "featured", "popular", "newest"] as const;
export type ShelfView = (typeof SHELF_VIEWS)[number];

export interface ShelfViewItem {
  isFeatured: boolean;
  /** ISO, or null for a row published before the column was written. */
  publishedAt: string | null;
  /** Enrollments, attempts — whatever this shelf counts. Absent: no Popular view. */
  popularity?: number;
}

/**
 * The views this shelf can honestly offer. `featured` only when something IS
 * featured (a chip whose only result is an empty state is a broken promise),
 * and `popular` only when the shelf carries a count.
 */
export function availableShelfViews(items: readonly ShelfViewItem[]): ShelfView[] {
  return SHELF_VIEWS.filter((view) => {
    if (view === "featured") return items.some((item) => item.isFeatured);
    if (view === "popular") return items.some((item) => item.popularity !== undefined);
    return true;
  });
}

const time = (iso: string | null) => (iso === null ? 0 : Date.parse(iso) || 0);

/**
 * One view of `items`. `all` keeps the editors' order but lifts featured rows
 * to the front (ADR-139 #3); the sort is stable, so ties keep that order too.
 */
export function applyShelfView<T extends ShelfViewItem>(items: readonly T[], view: ShelfView): T[] {
  switch (view) {
    case "featured":
      return items.filter((item) => item.isFeatured);
    case "popular":
      return [...items].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    case "newest":
      return [...items].sort((a, b) => time(b.publishedAt) - time(a.publishedAt));
    default:
      return [...items].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  }
}
