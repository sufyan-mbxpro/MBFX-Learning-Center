// The budget month, the cap, and the notify-once flag.
//
// `AiBudgetPeriod` holds ONE row per UTC month, read on every call before the
// provider is touched, so the check is a single indexed row read rather than a
// sum over a growing table.
//
// **The cap in force is COPIED onto the period, not read live.** Raising the
// cap mid-month is therefore an explicit act — it rewrites `budgetUsd` through
// the limits screen, which says so above the field — rather than a silent
// retroactive one. The alternative, joining `ai.monthlyBudgetUsd` at read time,
// would make "what was the cap in March" unanswerable the moment someone
// changed it in April.
//
// Every window here is UTC, including the month: a spend cap that moves with a
// viewer's timezone is two caps.
import { db } from "@repo/db";

export type BudgetStatus = "ok" | "warning" | "capped";

export interface BudgetState {
  /** "YYYY-MM", UTC. */
  period: string;
  status: BudgetStatus;
  spentUsd: number;
  budgetUsd: number;
  /** `true` when `budgetUsd` is 0 — the screen says "unlimited" in words. */
  unlimited: boolean;
  calls: number;
  /**
   * What a call may still cost and be allowed through. It is NOT
   * `budget - spent` when the cap is unlimited, and it is the figure the limits
   * screen shows as "available to spend" — the visible half of the pre-flight
   * check over-estimating (ADR-100's consequence).
   */
  availableUsd: number;
  warnedAt: Date | null;
  capReachedAt: Date | null;
  notifiedAt: Date | null;
}

/** The current UTC month, as the period key. */
export function currentPeriod(at: Date = new Date()): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toState(
  row: {
    period: string;
    costUsd: unknown;
    calls: number;
    budgetUsd: unknown;
    warnedAt: Date | null;
    capReachedAt: Date | null;
    notifiedAt: Date | null;
  },
  warnPercent: number,
): BudgetState {
  const spentUsd = Number(row.costUsd);
  const budgetUsd = Number(row.budgetUsd);
  const unlimited = budgetUsd <= 0;

  let status: BudgetStatus = "ok";
  if (!unlimited) {
    // `>=` on the boundary, not `>`. A period that has spent exactly its cap is
    // capped: the alternative lets one more call through every month, and the
    // integration test confirms the direction by relaxing this and failing.
    if (spentUsd >= budgetUsd) status = "capped";
    else if (spentUsd >= (budgetUsd * warnPercent) / 100) status = "warning";
  }

  return {
    period: row.period,
    status,
    spentUsd,
    budgetUsd,
    unlimited,
    calls: row.calls,
    availableUsd: unlimited ? Number.POSITIVE_INFINITY : Math.max(0, budgetUsd - spentUsd),
    warnedAt: row.warnedAt,
    capReachedAt: row.capReachedAt,
    notifiedAt: row.notifiedAt,
  };
}

/**
 * The current period's state, creating the row on first use.
 *
 * A new UTC month creates a new row: spend resets, nothing is "re-enabled"
 * manually, and the banner clears itself. That is why there is no monthly cron
 * — the month rolling over is the event, and the first call of the month is
 * what observes it.
 */
export async function getBudgetState(input: {
  budgetUsd: number;
  warnPercent: number;
  at?: Date;
}): Promise<BudgetState> {
  const period = currentPeriod(input.at);
  const row = await db.aiBudgetPeriod.upsert({
    where: { period },
    // A period that already exists keeps the cap it started with — the whole
    // point of copying rather than reading live.
    update: {},
    create: { period, budgetUsd: input.budgetUsd },
  });
  return toState(row, input.warnPercent);
}

/**
 * Push a changed cap onto the CURRENT period.
 *
 * Called by the limits screen's save, never by a generation path. This is the
 * explicit act the "copied, not read live" design requires: an admin who raises
 * the budget sees it take effect this month because they changed it, not
 * because a read happened to pick up a new number.
 */
export async function applyBudgetSettings(input: { budgetUsd: number; at?: Date }): Promise<void> {
  const period = currentPeriod(input.at);
  await db.aiBudgetPeriod.upsert({
    where: { period },
    update: {
      budgetUsd: input.budgetUsd,
      // Raising the cap clears the flags: the warning and the cap notice both
      // describe a threshold that no longer holds, and leaving them set would
      // suppress the NEXT notification when the new cap is approached.
      warnedAt: null,
      capReachedAt: null,
      notifiedAt: null,
    },
    create: { period, budgetUsd: input.budgetUsd },
  });
}

/**
 * Zero the current period's spend.
 *
 * Exists for the "raise the cap now" case and is audited by its caller, because
 * a spend cap that only a deploy can lift is a cap that gets worked around.
 */
export async function resetBudgetPeriod(input: { budgetUsd: number; at?: Date }): Promise<void> {
  const period = currentPeriod(input.at);
  await db.aiBudgetPeriod.upsert({
    where: { period },
    update: {
      costUsd: 0,
      calls: 0,
      budgetUsd: input.budgetUsd,
      warnedAt: null,
      capReachedAt: null,
      notifiedAt: null,
    },
    create: { period, budgetUsd: input.budgetUsd },
  });
}

/** What crossed, if anything, on the write that just happened. */
export type BudgetEvent = "warning" | "capped";

/**
 * Evaluate the transition AFTER a write, and claim the notification.
 *
 * Returns an event only the FIRST time each threshold is crossed in a period,
 * and stamps the row in the same statement — `updateMany` with the flag's own
 * `null` in the WHERE clause, so two concurrent calls cannot both claim it.
 * Without that dedupe a capped platform sends a notification storm, one per
 * blocked call.
 *
 * It does NOT notify. `@repo/ai` never notifies, because it does not know who a
 * subject is (plan §5) — the caller passes a handler, which is how the
 * `recordNotification` in `@repo/core` gets reached without this package
 * importing it.
 */
export async function claimBudgetEvent(input: {
  warnPercent: number;
  at?: Date;
}): Promise<{ state: BudgetState; event: BudgetEvent | null }> {
  const period = currentPeriod(input.at);
  const row = await db.aiBudgetPeriod.findUnique({ where: { period } });
  if (!row) {
    return {
      state: {
        period,
        status: "ok",
        spentUsd: 0,
        budgetUsd: 0,
        unlimited: true,
        calls: 0,
        availableUsd: Number.POSITIVE_INFINITY,
        warnedAt: null,
        capReachedAt: null,
        notifiedAt: null,
      },
      event: null,
    };
  }

  const state = toState(row, input.warnPercent);
  const now = input.at ?? new Date();

  if (state.status === "capped") {
    const claimed = await db.aiBudgetPeriod.updateMany({
      where: { period, notifiedAt: null },
      data: { capReachedAt: row.capReachedAt ?? now, notifiedAt: now },
    });
    return { state, event: claimed.count > 0 ? "capped" : null };
  }

  if (state.status === "warning") {
    const claimed = await db.aiBudgetPeriod.updateMany({
      where: { period, warnedAt: null },
      data: { warnedAt: now },
    });
    return { state, event: claimed.count > 0 ? "warning" : null };
  }

  return { state, event: null };
}
