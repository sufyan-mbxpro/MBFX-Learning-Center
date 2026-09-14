// The meter (ADR-097 #7).
//
// Called from `runAiTask`'s `finally` and from nowhere else — never from a
// feature, never from a route. A feature cannot forget to meter because a
// feature never meters.
//
// **The log holds no prompt and no completion.** There are no body columns to
// fill, which is the design and not an omission: a log holding bodies is a
// second copy of unpublished drafts and learner text, under a different gate
// with a different retention. It answers "what did this cost, who spent it,
// against which entity" — not "what did it say". `reason` is a closed taxonomy
// value, never a provider message, because provider messages quote the prompt
// back.
//
// One transaction writes three things, with atomic `increment`s rather than
// read-modify-write: two admins generating at once must not lose one of the two
// costs (ADR-056's enrollment counter, same failure, different table).
import { db, type AiCallStatus, type AiProviderKind, type Prisma } from "@repo/db";

import type { AiReason } from "./errors.ts";

/** Raw rows purge at 90 days; the rollups are kept forever (ADR-097 #7). */
export const AI_USAGE_RETENTION_DAYS = 90;

export interface RecordUsageInput {
  feature: string;
  provider: AiProviderKind;
  modelId: string;
  status: AiCallStatus;
  reason?: AiReason | null;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  costUsd: number;
  durationMs?: number;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  at?: Date;
}

/**
 * Whether a thrown error is MariaDB's unique-constraint violation.
 *
 * `upsert` is NOT atomic: under concurrency two transactions both find no row
 * and both insert, and the second gets a 1062. Prisma surfaces it as P2002.
 * This is not theoretical — the integration test's six concurrent calls hit it
 * on the first run, which is exactly why that test exists.
 */
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown })?.code === "P2002";
}

/** UTC midnight of a timestamp's day — the rollup's bucket. */
function utcDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

function period(at: Date): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Write the row, the daily rollup and the period counter, in one transaction.
 *
 * A REFUSED row costs $0 and still counts as a call. That is deliberate: "why
 * did nothing happen" is the question the usage screen has to answer, and a
 * refusal that leaves no trace makes it unanswerable. If a real instance ever
 * shows refusal volume distorting the picture, the fix is to stop counting
 * refusals into `AiBudgetPeriod.calls` — they already cost nothing — not to
 * stop writing them.
 */
export async function recordUsage(input: RecordUsageInput): Promise<void> {
  const at = input.at ?? new Date();
  const day = utcDay(at);
  const inputTokens = Math.max(0, Math.round(input.inputTokens ?? 0));
  const outputTokens = Math.max(0, Math.round(input.outputTokens ?? 0));
  const cachedInputTokens = Math.max(0, Math.round(input.cachedInputTokens ?? 0));
  const costUsd = Math.max(0, input.costUsd);
  const isFailure = input.status === "FAILED" || input.status === "REFUSED";

  await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await tx.aiUsage.create({
        data: {
          feature: input.feature,
          provider: input.provider,
          modelId: input.modelId,
          status: input.status,
          reason: input.reason ?? null,
          inputTokens,
          outputTokens,
          cachedInputTokens,
          costUsd,
          durationMs: Math.max(0, Math.round(input.durationMs ?? 0)),
          userId: input.userId ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          createdAt: at,
        },
      });

      const dailyKey = {
        date: day,
        feature: input.feature,
        provider: input.provider,
        modelId: input.modelId,
      };
      const dailyIncrements = {
        calls: { increment: 1 },
        failures: { increment: isFailure ? 1 : 0 },
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        cachedInputTokens: { increment: cachedInputTokens },
        costUsd: { increment: costUsd },
      };

      try {
        await tx.aiUsageDaily.upsert({
          where: { date_feature_provider_modelId: dailyKey },
          update: dailyIncrements,
          create: {
            ...dailyKey,
            calls: 1,
            failures: isFailure ? 1 : 0,
            inputTokens,
            outputTokens,
            cachedInputTokens,
            costUsd,
          },
        });
      } catch (error) {
        // Somebody else created the bucket between our read and our insert. The
        // row now exists, so the increment is all that was ever needed — and it
        // IS atomic, which is why the retry cannot race in turn.
        if (!isUniqueViolation(error)) throw error;
        await tx.aiUsageDaily.update({
          where: { date_feature_provider_modelId: dailyKey },
          data: dailyIncrements,
        });
      }

      const periodIncrements = { costUsd: { increment: costUsd }, calls: { increment: 1 } };
      try {
        await tx.aiBudgetPeriod.upsert({
          where: { period: period(at) },
          update: periodIncrements,
          // A period row normally exists by now — `getBudgetState` created it
          // before the call. The create branch covers the one case it does not: a
          // refusal so early that nothing read the budget.
          create: { period: period(at), budgetUsd: 0, costUsd, calls: 1 },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        await tx.aiBudgetPeriod.update({
          where: { period: period(at) },
          data: periodIncrements,
        });
      }
    },
    // ADR-056's lesson, in a second domain. Under MariaDB's default REPEATABLE
    // READ the retry above reads from a snapshot taken BEFORE the concurrent
    // insert committed, so it finds no row and fails with "record not found" —
    // a fix that looks right and drifts anyway. `ReadCommitted` makes each read
    // inside the transaction take a fresh snapshot, which is what makes the
    // catch-and-increment correct rather than merely plausible.
    { isolationLevel: "ReadCommitted" },
  );
}

/** The per-user hourly window (plan §11.3). */
export async function countRecentCalls(userId: string, windowMs = 3_600_000): Promise<number> {
  // One indexed count on `(userId, createdAt)`, which is nothing next to the
  // provider call it guards. Deliberately NOT Redis: `ioredis` is declared by
  // `@repo/auth` only, and `@repo/ai` importing `auth` would invert the layering
  // ADR-078 spent a page protecting. It is a guard against a stuck client loop,
  // not an anti-abuse control — every caller is already staff behind two locks.
  return db.aiUsage.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - windowMs) } },
  });
}

// ─── Reads, for the usage dashboard (A7) ─────────────────────

export interface AiUsageRow {
  id: string;
  feature: string;
  provider: AiProviderKind;
  modelId: string;
  status: AiCallStatus;
  reason: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  durationMs: number;
  userId: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
}

export interface ListUsageInput {
  feature?: string | null;
  status?: AiCallStatus | null;
  userId?: string | null;
  since?: Date | null;
  limit?: number;
  cursor?: string | null;
}

export interface ListUsagePage {
  rows: AiUsageRow[];
  nextCursor: string | null;
}

/** The recent-calls table. Keyset paged, `listMediaAssets`'s contract. */
export async function listUsageRows(input: ListUsageInput = {}): Promise<ListUsagePage> {
  const limit = Math.min(Math.max(1, input.limit ?? 50), 200);
  const rows = await db.aiUsage.findMany({
    where: {
      ...(input.feature ? { feature: input.feature } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.since ? { createdAt: { gte: input.since } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const page = rows.slice(0, limit);
  return {
    rows: page.map((row) => ({ ...row, costUsd: Number(row.costUsd) })),
    nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
}

export interface AiUsageSummary {
  calls: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  /** `0` when there were no calls, never `NaN`. */
  averageCostUsd: number;
}

/** Totals over a window, from the ROLLUP — never a scan of raw rows. */
export async function summarizeUsage(since: Date, until?: Date): Promise<AiUsageSummary> {
  const rows = await db.aiUsageDaily.findMany({
    where: { date: { gte: since, ...(until ? { lte: until } : {}) } },
    select: {
      calls: true,
      failures: true,
      inputTokens: true,
      outputTokens: true,
      cachedInputTokens: true,
      costUsd: true,
    },
  });

  const total = rows.reduce(
    (acc, row) => ({
      calls: acc.calls + row.calls,
      failures: acc.failures + row.failures,
      inputTokens: acc.inputTokens + row.inputTokens,
      outputTokens: acc.outputTokens + row.outputTokens,
      cachedInputTokens: acc.cachedInputTokens + row.cachedInputTokens,
      costUsd: acc.costUsd + Number(row.costUsd),
    }),
    { calls: 0, failures: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 },
  );

  return { ...total, averageCostUsd: total.calls > 0 ? total.costUsd / total.calls : 0 };
}

export interface AiUsageDailyPoint {
  date: Date;
  feature: string;
  provider: AiProviderKind;
  modelId: string;
  calls: number;
  failures: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

/** The chart's source: one row per (day, feature, provider, model). */
export async function usageDailySeries(since: Date, until?: Date): Promise<AiUsageDailyPoint[]> {
  const rows = await db.aiUsageDaily.findMany({
    where: { date: { gte: since, ...(until ? { lte: until } : {}) } },
    orderBy: [{ date: "asc" }, { feature: "asc" }],
  });
  return rows.map((row) => ({
    date: row.date,
    feature: row.feature,
    provider: row.provider,
    modelId: row.modelId,
    calls: row.calls,
    failures: row.failures,
    costUsd: Number(row.costUsd),
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
  }));
}

/**
 * The retention sweep, joined to `/api/cron/housekeeping`.
 *
 * Raw rows carry a `userId` — who spent what — and that is PII on a clock. The
 * rollups carry no person and are kept, which is what lets spend history
 * outlive it and keeps a twelve-month chart from scanning a year of raw rows.
 */
export async function purgeUsageOlderThan(days = AI_USAGE_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const result = await db.aiUsage.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
