// Shared, string-free helpers for the AI screens.
//
// No catalog strings live here — a package-shaped file with English in it is
// the bug code-style.md #2 exists to stop, and these are read by both server
// and client components.
import type { AiUsageFilter } from "@repo/contracts";

export type AiRange = NonNullable<AiUsageFilter["range"]>;

export const AI_RANGES = ["day", "week", "month", "quarter", "year"] as const;

export function isAiRange(value: string | undefined): value is AiRange {
  return (AI_RANGES as readonly string[]).includes(value ?? "");
}

/**
 * The start of a range, in UTC.
 *
 * Every window in this platform is UTC, including the budget month — a spend
 * cap that moves with a viewer's timezone is two caps, and a chart whose
 * "today" disagrees with the cap's is a support ticket.
 */
export function rangeStart(range: AiRange, now: Date = new Date()): Date {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  switch (range) {
    case "day":
      return new Date(day);
    case "week":
      return new Date(day - 6 * 86_400_000);
    case "month":
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    case "quarter":
      return new Date(day - 89 * 86_400_000);
    case "year":
      return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
  }
}

/** `1,234` — tokens are counts, and a seven-digit run of digits is unreadable. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("en").format(Math.round(value));
}

/** `1.2s` / `840ms` — a duration nobody has to divide in their head. */
export function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}
