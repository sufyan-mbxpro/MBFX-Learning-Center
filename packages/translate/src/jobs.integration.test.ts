// The job queue against a real MariaDB (ADR-162). Every claim here is about
// what the DATABASE does under concurrency or at a boundary, which is why a
// mock could not settle any of them.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import type { db as DbClient } from "@repo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type * as JobsModule from "./jobs.ts";
import type * as ErrorsModule from "./errors.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let jobs: typeof JobsModule;
let errors: typeof ErrorsModule;

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_jobs_test")
    .withUsername("test")
    .withUserPassword("test")
    .start();
  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  process.env.DATABASE_URL = url;
  db = (await import("@repo/db")).db;
  jobs = await import("./jobs.ts");
  errors = await import("./errors.ts");
}, 180_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

beforeEach(async () => {
  await db.translationJob.deleteMany();
});

const key = (id: string, locale = "ar") => ({ entityType: "article", entityId: id, locale });

describe("enqueue", () => {
  it("creates one PENDING job per key and is idempotent", async () => {
    await jobs.enqueueTranslationJobs([key("a1"), key("a1", "es"), key("a1")]);
    const rows = await db.translationJob.findMany({ orderBy: { locale: "asc" } });
    expect(rows.map((r) => [r.locale, r.status, r.kind])).toEqual([
      ["ar", "PENDING", "ITEM"],
      ["es", "PENDING", "ITEM"],
    ]);
  });

  it("re-arms a DONE or FAILED job and leaves a RUNNING one alone", async () => {
    await db.translationJob.createMany({
      data: [
        { kind: "ITEM", ...key("done"), status: "DONE", attempts: 1 },
        { kind: "ITEM", ...key("failed"), status: "FAILED", attempts: 3, lastError: "auth_failed" },
        {
          kind: "ITEM",
          ...key("running"),
          status: "RUNNING",
          claimToken: "t",
          claimedAt: new Date(),
        },
      ],
    });
    await jobs.enqueueTranslationJobs([key("done"), key("failed"), key("running")]);

    const byId = Object.fromEntries(
      (await db.translationJob.findMany()).map((r) => [r.entityId, r]),
    );
    expect(byId.done).toMatchObject({ status: "PENDING", attempts: 0 });
    expect(byId.failed).toMatchObject({ status: "PENDING", attempts: 0, lastError: null });
    expect(byId.running).toMatchObject({ status: "RUNNING", claimToken: "t", rerun: true });
  });

  it("runs again a job whose source changed after it wrote but before it finished", async () => {
    // The race ADR-162 #2 was amended for: the handler's hash check has
    // already passed, so only the flag can catch the edit.
    await jobs.enqueueTranslationJobs([key("raced")]);
    await jobs.runTranslationQueue({
      handlers: {
        article: async () => {
          await jobs.enqueueTranslationJobs([key("raced")]); // an editor saves now
          return "done";
        },
      },
    });
    const row = await db.translationJob.findFirstOrThrow();
    expect(row).toMatchObject({ status: "PENDING", rerun: false, claimToken: null });

    // The next pass reads the new source and finishes for real.
    await jobs.runTranslationQueue({ handlers: { article: async () => "done" } });
    expect((await db.translationJob.findFirstOrThrow()).status).toBe("DONE");
  });
});

describe("claim", () => {
  it("never gives the same job to two runners claiming at once", async () => {
    await jobs.enqueueTranslationJobs(
      Array.from({ length: 40 }, (_, i) => key(`a${String(i).padStart(2, "0")}`)),
    );
    const claims = await Promise.all(
      Array.from({ length: 4 }, () => jobs.claimJobs({ limit: 15 })),
    );
    const ids = claims.flat().map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(40);
    expect(await db.translationJob.count({ where: { status: "RUNNING" } })).toBe(40);
  });

  it("claims only jobs that are due, and only one entity's when asked", async () => {
    await db.translationJob.createMany({
      data: [
        { kind: "ITEM", ...key("later"), runAfter: new Date(Date.now() + 60_000) },
        { kind: "ITEM", ...key("mine") },
        { kind: "ITEM", ...key("other") },
        { kind: "BACKFILL_LOCALE", entityType: "*", entityId: "*", locale: "ar" },
      ],
    });
    const mine = await jobs.claimJobs({ entity: { type: "article", id: "mine" } });
    expect(mine.map((j) => j.entityId)).toEqual(["mine"]);
    const rest = await jobs.claimJobs();
    // Not the future one, and never a backfill: those are expanded, not run.
    expect(rest.map((j) => j.entityId)).toEqual(["other"]);
  });

  it("recovers a lease that ran out, and only that one", async () => {
    const now = new Date();
    await db.translationJob.createMany({
      data: [
        {
          kind: "ITEM",
          ...key("stale"),
          status: "RUNNING",
          claimToken: "old",
          claimedAt: new Date(now.getTime() - jobs.LEASE_MS - 1000),
        },
        { kind: "ITEM", ...key("fresh"), status: "RUNNING", claimToken: "new", claimedAt: now },
      ],
    });
    expect(await jobs.recoverStaleJobs(now)).toBe(1);
    const stale = await db.translationJob.findFirstOrThrow({ where: { entityId: "stale" } });
    expect(stale).toMatchObject({ status: "PENDING", claimToken: null });
  });
});

describe("run", () => {
  it("marks done, re-queues on a moved source, and revalidates once per batch", async () => {
    await jobs.enqueueTranslationJobs([key("ok"), key("moved")]);
    let revalidations = 0;
    const summary = await jobs.runTranslationQueue({
      handlers: { article: async (job) => (job.entityId === "moved" ? "requeue" : "done") },
      afterBatch: () => {
        revalidations += 1;
      },
    });
    expect(summary).toMatchObject({ claimed: 2, done: 1, requeued: 1 });
    expect(revalidations).toBe(1);
    const byId = Object.fromEntries(
      (await db.translationJob.findMany()).map((r) => [r.entityId, r.status]),
    );
    expect(byId).toEqual({ ok: "DONE", moved: "PENDING" });
  });

  it("retries with backoff, then fails after three attempts", async () => {
    await jobs.enqueueTranslationJobs([key("flaky")]);
    const failing = {
      article: async () => {
        throw new errors.TranslateError("provider_error", "503");
      },
    };
    let now = new Date();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const clock = now;
      const summary = await jobs.runTranslationQueue({ handlers: failing, now: () => clock });
      expect(summary.claimed).toBe(1);
      // Make the backoff due for the next round.
      await db.translationJob.updateMany({ data: { runAfter: new Date(0) } });
      now = new Date(now.getTime() + 60_000);
    }
    const row = await db.translationJob.findFirstOrThrow();
    expect(row).toMatchObject({ status: "FAILED", attempts: 3, lastError: "provider_error" });
  });

  it("schedules the retry by the backoff", async () => {
    await jobs.enqueueTranslationJobs([key("flaky")]);
    const now = new Date("2026-09-25T10:00:00Z");
    await jobs.runTranslationQueue({
      handlers: {
        article: async () => {
          throw new errors.TranslateError("network_error", "down");
        },
      },
      now: () => now,
    });
    const row = await db.translationJob.findFirstOrThrow();
    expect(row).toMatchObject({ status: "PENDING", attempts: 1, lastError: "network_error" });
    expect(row.runAfter.toISOString()).toBe("2026-09-25T10:01:00.000Z");
  });

  it("pauses on the budget until next month without spending an attempt", async () => {
    await jobs.enqueueTranslationJobs([key("capped")]);
    const now = new Date("2026-09-25T10:00:00Z");
    const summary = await jobs.runTranslationQueue({
      handlers: {
        article: async () => {
          throw new errors.TranslateError("budget_exceeded", "cap");
        },
      },
      now: () => now,
    });
    expect(summary.paused).toBe(1);
    const row = await db.translationJob.findFirstOrThrow();
    expect(row).toMatchObject({ status: "PENDING", attempts: 0, lastError: "budget_exceeded" });
    expect(row.runAfter.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("pauses on Google's quota for half an hour", async () => {
    await jobs.enqueueTranslationJobs([key("quota")]);
    const now = new Date("2026-09-25T10:00:00Z");
    await jobs.runTranslationQueue({
      handlers: {
        article: async () => {
          throw new errors.TranslateError("quota_exceeded", "q");
        },
      },
      now: () => now,
    });
    const row = await db.translationJob.findFirstOrThrow();
    expect(row.runAfter.toISOString()).toBe("2026-09-25T10:30:00.000Z");
  });

  it("records our own bug as internal_error, and a type with no handler the same way", async () => {
    await jobs.enqueueTranslationJobs([key("bug"), { ...key("x"), entityType: "unknown" }]);
    await jobs.runTranslationQueue({
      handlers: {
        article: async () => {
          throw new Error("undefined is not a function");
        },
      },
    });
    const rows = await db.translationJob.findMany();
    expect(rows.every((r) => r.lastError === "internal_error")).toBe(true);
  });

  it("does nothing, and calls no callback, with an empty queue", async () => {
    let called = false;
    const summary = await jobs.runTranslationQueue({
      handlers: {},
      afterBatch: () => {
        called = true;
      },
    });
    expect(summary.claimed).toBe(0);
    expect(called).toBe(false);
  });
});

describe("backfill (ADR-162 #9)", () => {
  const ids = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(3, "0")}`);
  const sourceOf = (entityType: string, all: string[]): JobsModule.BackfillSource => ({
    entityType,
    page: async (after, take) => all.filter((id) => after === null || id > after).slice(0, take),
  });

  it("walks every type a page at a time and finishes", async () => {
    const sources = [sourceOf("article", ids("a", 5)), sourceOf("course", ids("c", 3))];
    await jobs.enqueueLocaleBackfill("es");

    // Two pages per tick of two ids: the walk needs three ticks.
    const first = await jobs.expandBackfill({ sources, pages: 2, pageSize: 2 });
    expect(first).toEqual({ claimed: 1, enqueued: 4, completed: 0 });
    let backfill = await db.translationJob.findFirstOrThrow({ where: { kind: "BACKFILL_LOCALE" } });
    expect(backfill).toMatchObject({ status: "PENDING", cursor: "article|a003", claimToken: null });

    const second = await jobs.expandBackfill({ sources, pages: 2, pageSize: 2 });
    expect(second.enqueued).toBe(3); // a004, then c000 c001
    const third = await jobs.expandBackfill({ sources, pages: 2, pageSize: 2 });
    expect(third).toMatchObject({ enqueued: 1, completed: 1 });

    backfill = await db.translationJob.findFirstOrThrow({ where: { kind: "BACKFILL_LOCALE" } });
    expect(backfill).toMatchObject({ status: "DONE", cursor: null });
    const items = await db.translationJob.findMany({ where: { kind: "ITEM" } });
    expect(items.map((r) => `${r.entityType}:${r.entityId}:${r.locale}`).sort()).toEqual([
      ...ids("a", 5).map((id) => `article:${id}:es`),
      ...ids("c", 3).map((id) => `course:${id}:es`),
    ]);
  });

  it("is claimed by one runner at a time", async () => {
    await jobs.enqueueLocaleBackfill("es");
    let calls = 0;
    const slow: JobsModule.BackfillSource = {
      entityType: "article",
      page: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [];
      },
    };
    const results = await Promise.all([
      jobs.expandBackfill({ sources: [slow] }),
      jobs.expandBackfill({ sources: [slow] }),
    ]);
    expect(results.map((r) => r.claimed).sort()).toEqual([0, 1]);
    expect(calls).toBe(1);
  });

  it("restarts from the beginning when Sync is pressed again", async () => {
    await db.translationJob.create({
      data: {
        kind: "BACKFILL_LOCALE",
        entityType: "*",
        entityId: "*",
        locale: "es",
        status: "DONE",
        cursor: null,
      },
    });
    await db.translationJob.create({
      data: {
        kind: "BACKFILL_LOCALE",
        entityType: "*",
        entityId: "*",
        locale: "ar",
        status: "PENDING",
        cursor: "article|a100",
      },
    });
    await jobs.enqueueLocaleBackfill("es");
    await jobs.enqueueLocaleBackfill("ar");
    const rows = await db.translationJob.findMany({ orderBy: { locale: "asc" } });
    expect(rows.map((r) => [r.locale, r.status, r.cursor])).toEqual([
      ["ar", "PENDING", null],
      ["es", "PENDING", null],
    ]);
  });

  it("marks a running backfill to run again from the start", async () => {
    await jobs.enqueueLocaleBackfill("es");
    const source: JobsModule.BackfillSource = {
      entityType: "article",
      page: async () => {
        await jobs.enqueueLocaleBackfill("es"); // Sync pressed mid-walk
        return [];
      },
    };
    await jobs.expandBackfill({ sources: [source] });
    const row = await db.translationJob.findFirstOrThrow({ where: { kind: "BACKFILL_LOCALE" } });
    expect(row).toMatchObject({ status: "PENDING", rerun: false, cursor: null });
  });

  it("finishes without walking for a locale that is no longer active", async () => {
    await jobs.enqueueLocaleBackfill("es");
    let walked = false;
    const summary = await jobs.expandBackfill({
      sources: [
        {
          entityType: "article",
          page: async () => {
            walked = true;
            return ["a1"];
          },
        },
      ],
      isLocaleActive: async () => false,
    });
    expect(summary).toEqual({ claimed: 1, enqueued: 0, completed: 0 });
    expect(walked).toBe(false);
    expect((await db.translationJob.findFirstOrThrow()).status).toBe("DONE");
  });

  it("counts a failing walk as an attempt, like an item", async () => {
    await jobs.enqueueLocaleBackfill("es");
    await jobs.expandBackfill({
      sources: [
        {
          entityType: "article",
          page: async () => {
            throw new Error("db gone");
          },
        },
      ],
    });
    const row = await db.translationJob.findFirstOrThrow();
    expect(row).toMatchObject({ status: "PENDING", attempts: 1, lastError: "internal_error" });
  });

  it("runs from the queue tick, and the items it enqueued in the same tick", async () => {
    await jobs.enqueueLocaleBackfill("es");
    const handled: string[] = [];
    const summary = await jobs.runTranslationQueue({
      handlers: {
        article: async (job) => {
          handled.push(job.entityId);
          return "done";
        },
      },
      backfill: [sourceOf("article", ["a1", "a2"])],
    });
    expect(summary).toMatchObject({ backfillEnqueued: 2, claimed: 2, done: 2 });
    expect(handled.sort()).toEqual(["a1", "a2"]);
  });

  // Regression (ADR-165 change-set): a tick walks at most BACKFILL_PAGES_PER_TICK
  // types. When every one of them was empty it enqueued nothing, and the drain
  // read "claimed 0, enqueued 0" as an empty queue and stopped with the walk
  // unfinished — hiding every type past the tenth until the next cron call.
  it("reports a claimed walk that crossed only empty types, so a drain continues", async () => {
    await jobs.enqueueLocaleBackfill("es");
    const empty = Array.from({ length: jobs.BACKFILL_PAGES_PER_TICK + 2 }, (_, i) =>
      sourceOf(`empty_${i}`, []),
    );
    const first = await jobs.runTranslationQueue({ handlers: {}, backfill: empty });
    expect(first).toMatchObject({ claimed: 0, backfillEnqueued: 0, backfillClaimed: 1 });
    expect((await db.translationJob.findFirstOrThrow()).status).toBe("PENDING");

    const second = await jobs.runTranslationQueue({ handlers: {}, backfill: empty });
    expect(second).toMatchObject({ backfillClaimed: 1 });
    expect((await db.translationJob.findFirstOrThrow()).status).toBe("DONE");

    // Nothing left: the tick claims nothing at all.
    const third = await jobs.runTranslationQueue({ handlers: {}, backfill: empty });
    expect(third).toMatchObject({ claimed: 0, backfillEnqueued: 0, backfillClaimed: 0 });
  });
});

describe("inactive locales (ADR-163 #4)", () => {
  it("finishes a job for an inactive locale without its handler", async () => {
    await jobs.enqueueTranslationJobs([key("x", "es"), key("y", "ar")]);
    const handled: string[] = [];
    let revalidated = false;
    const summary = await jobs.runTranslationQueue({
      handlers: {
        article: async (job) => {
          handled.push(job.locale);
          return "done";
        },
      },
      isLocaleActive: async (locale) => locale === "ar",
      afterBatch: () => {
        revalidated = true;
      },
    });
    expect(handled).toEqual(["ar"]);
    expect(summary).toMatchObject({ claimed: 2, done: 1, skipped: 1 });
    expect(revalidated).toBe(true);
    expect(await db.translationJob.count({ where: { status: "DONE" } })).toBe(2);
  });
});

describe("retry, counts and housekeeping", () => {
  it("re-arms only FAILED jobs, for one locale when asked", async () => {
    await db.translationJob.createMany({
      data: [
        {
          kind: "ITEM",
          ...key("f1", "es"),
          status: "FAILED",
          attempts: 3,
          lastError: "auth_failed",
        },
        {
          kind: "ITEM",
          ...key("f2", "ar"),
          status: "FAILED",
          attempts: 3,
          lastError: "auth_failed",
        },
        { kind: "ITEM", ...key("d1", "es"), status: "DONE" },
      ],
    });
    expect(await jobs.retryFailedJobs("es")).toBe(1);
    const byId = Object.fromEntries(
      (await db.translationJob.findMany()).map((r) => [r.entityId, [r.status, r.attempts]]),
    );
    expect(byId).toEqual({ f1: ["PENDING", 0], f2: ["FAILED", 3], d1: ["DONE", 0] });
    expect(await jobs.retryFailedJobs()).toBe(1);
  });

  it("counts by locale, kind and status, and lists failures newest first", async () => {
    await db.translationJob.createMany({
      data: [
        { kind: "ITEM", ...key("p1", "es") },
        { kind: "ITEM", ...key("p2", "es") },
        {
          kind: "ITEM",
          ...key("f1", "es"),
          status: "FAILED",
          lastError: "bad_request",
          updatedAt: new Date("2026-09-01T00:00:00Z"),
        },
        {
          kind: "ITEM",
          ...key("f2", "es"),
          status: "FAILED",
          lastError: "auth_failed",
          updatedAt: new Date("2026-09-02T00:00:00Z"),
        },
      ],
    });
    const counts = await jobs.countJobs();
    expect(counts.sort((a, b) => a.status.localeCompare(b.status))).toEqual([
      { locale: "es", kind: "ITEM", status: "FAILED", count: 2 },
      { locale: "es", kind: "ITEM", status: "PENDING", count: 2 },
    ]);
    const failed = await jobs.listFailedJobs({ locale: "es" });
    expect(failed.map((f) => [f.entityId, f.lastError])).toEqual([
      ["f2", "auth_failed"],
      ["f1", "bad_request"],
    ]);
  });

  it("purges DONE jobs past a week and usage rows past 90 days", async () => {
    const now = new Date("2026-09-28T00:00:00Z");
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
    await db.translationJob.createMany({
      data: [
        { kind: "ITEM", ...key("old"), status: "DONE", updatedAt: daysAgo(8) },
        { kind: "ITEM", ...key("new"), status: "DONE", updatedAt: daysAgo(6) },
        { kind: "ITEM", ...key("oldfail"), status: "FAILED", updatedAt: daysAgo(30) },
      ],
    });
    await db.translateUsage.deleteMany();
    const usage = (createdAt: Date) => ({
      status: "OK",
      sourceLocale: "en",
      targetLocale: "es",
      format: "TEXT",
      segments: 1,
      characters: 10,
      costUsd: "0.000200",
      durationMs: 5,
      createdAt,
    });
    await db.translateUsage.createMany({
      data: [usage(daysAgo(91)), usage(daysAgo(89))] as never,
    });

    expect(await jobs.purgeTranslationRows(now)).toEqual({ jobs: 1, usage: 1 });
    expect((await db.translationJob.findMany()).map((r) => r.entityId).sort()).toEqual([
      "new",
      "oldfail",
    ]);
  });
});

describe("parseBackfillCursor", () => {
  const types = ["article", "course"];
  it("starts at the first type with no cursor", () => {
    expect(jobs.parseBackfillCursor(null, types)).toEqual({ typeIndex: 0, after: null });
  });
  it("resumes inside a type, or at its start", () => {
    expect(jobs.parseBackfillCursor("course|c9", types)).toEqual({ typeIndex: 1, after: "c9" });
    expect(jobs.parseBackfillCursor("course|", types)).toEqual({ typeIndex: 1, after: null });
  });
  it("starts over when the type left the registry", () => {
    expect(jobs.parseBackfillCursor("gone|x", types)).toEqual({ typeIndex: 0, after: null });
  });
});

describe("nextBudgetPeriod", () => {
  it("rolls over the year", () => {
    expect(jobs.nextBudgetPeriod(new Date("2026-12-31T23:59:00Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
});
