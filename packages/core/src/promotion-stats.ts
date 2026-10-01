// Promotion counters (ADR-170, changes-52 P7): the service behind
// `POST /api/promotions/events` and the admin's views and clicks.
//
// Counts, never events. A row is (promotion, UTC day, surface) and three
// numbers; nothing here can name a visitor, because nothing that could is ever
// passed in. The route's own guards (same origin, per-IP limit, one count per
// network per day) run BEFORE this; the one guard that needs the database's
// idea of "live" runs HERE, so no caller can count an event without it.
import { db } from "@repo/db";
import {
  acceptedPromotionEvents,
  type PromotionEvent,
  type PromotionSurfaceFlags,
  type PromotionEventType,
  type PromotionSurfaceInput,
} from "@repo/contracts";

/** The counter each event type increments. A closed map, so no column name ever comes from input. */
const COLUMN: Record<PromotionEventType, "impressions" | "clicks" | "dismissals"> = {
  IMPRESSION: "impressions",
  CLICK: "clicks",
  DISMISS: "dismissals",
};

/** `YYYY-MM-DD` in UTC — the counters' day, the same for every reader everywhere. */
export function statsDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Count the events that pass ADR-170 #3.1 against `live` — the cached public
 * list the popup read — and return how many were counted.
 *
 * One `INSERT … ON DUPLICATE KEY UPDATE` per event, so two beacons at once
 * cannot lose an increment (Prisma's upsert reads, then writes). A promotion
 * hard-deleted since the list was cached fails its foreign key; that event is
 * dropped rather than failing the others — a counter owes nobody an error.
 */
export async function recordPromotionEvents(
  events: readonly PromotionEvent[],
  live: readonly PromotionSurfaceFlags[],
  now: Date = new Date(),
): Promise<number> {
  const accepted = acceptedPromotionEvents(events, live);
  const day = statsDay(now);
  let counted = 0;
  for (const event of accepted) {
    const column = COLUMN[event.type];
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO promotion_daily_stats (promotionId, day, surface, ${column}, updatedAt)
         VALUES (?, ?, ?, 1, NOW(3))
         ON DUPLICATE KEY UPDATE ${column} = ${column} + 1, updatedAt = NOW(3)`,
        event.id,
        day,
        event.surface,
      );
      counted += 1;
    } catch {
      /* the promotion is gone; nothing to count against */
    }
  }
  return counted;
}

export interface PromotionTotals {
  impressions: number;
  clicks: number;
  dismissals: number;
}

const ZERO: PromotionTotals = { impressions: 0, clicks: 0, dismissals: 0 };

/** All-time totals per promotion, every surface together — the admin list's columns. */
export async function getPromotionTotals(
  ids: readonly string[],
): Promise<Map<string, PromotionTotals>> {
  if (ids.length === 0) return new Map();
  const rows = await db.promotionDailyStat.groupBy({
    by: ["promotionId"],
    where: { promotionId: { in: [...ids] } },
    _sum: { impressions: true, clicks: true, dismissals: true },
  });
  return new Map(
    rows.map((row) => [
      row.promotionId,
      {
        impressions: row._sum.impressions ?? 0,
        clicks: row._sum.clicks ?? 0,
        dismissals: row._sum.dismissals ?? 0,
      },
    ]),
  );
}

export interface PromotionDayStats {
  /** `YYYY-MM-DD`, UTC. */
  day: string;
  popup: PromotionTotals;
  band: PromotionTotals;
  bar: PromotionTotals;
}

export interface PromotionStats {
  total: PromotionTotals;
  popup: PromotionTotals;
  band: PromotionTotals;
  bar: PromotionTotals;
  /** The last `days` UTC days that have any count, newest first. Empty days are absent. */
  daily: PromotionDayStats[];
}

function add(a: PromotionTotals, b: PromotionTotals): PromotionTotals {
  return {
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    dismissals: a.dismissals + b.dismissals,
  };
}

/** The editor's Results section: all-time totals per surface, and the recent days. */
export async function getPromotionStats(
  promotionId: string,
  days = 30,
  now: Date = new Date(),
): Promise<PromotionStats> {
  const rows = await db.promotionDailyStat.findMany({
    where: { promotionId },
    orderBy: { day: "desc" },
  });

  const bySurface: Record<PromotionSurfaceInput, PromotionTotals> = {
    POPUP: ZERO,
    BAND: ZERO,
    BAR: ZERO,
  };
  const byDay = new Map<string, PromotionDayStats>();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const sinceDay = statsDay(since);

  for (const row of rows) {
    const counts = { impressions: row.impressions, clicks: row.clicks, dismissals: row.dismissals };
    bySurface[row.surface] = add(bySurface[row.surface], counts);
    const day = statsDay(row.day);
    if (day < sinceDay) continue;
    const entry = byDay.get(day) ?? { day, popup: ZERO, band: ZERO, bar: ZERO };
    if (row.surface === "POPUP") entry.popup = add(entry.popup, counts);
    else if (row.surface === "BAR") entry.bar = add(entry.bar, counts);
    else entry.band = add(entry.band, counts);
    byDay.set(day, entry);
  }

  return {
    total: add(add(bySurface.POPUP, bySurface.BAND), bySurface.BAR),
    popup: bySurface.POPUP,
    band: bySurface.BAND,
    bar: bySurface.BAR,
    daily: [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day)),
  };
}
