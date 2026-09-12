// changes-26, ADR-085 — the dashboard's content aggregation against a real
// MariaDB, which is the half `admin-dashboard.test.ts` deliberately does not
// cover.
//
// `CONTENT_MODELS` is six entries of three hand-written closures each, and
// every one of them repeats the same three clauses: the right delegate,
// `deletedAt: null`, and `status: PUBLISHED` with a `publishedAt` window. A
// copy-paste that leaves `db.lesson` in the quizzes entry, or drops the
// soft-delete clause from one of eighteen queries, type-checks and passes
// every unit test in the file next door — the numbers are simply wrong on
// one row of the dashboard. So each type is seeded with a DIFFERENT shape
// here: if a closure reads its neighbour's table, the assertion for both
// fails.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ContentStatus } from "@repo/db";
import type { db as DbClient } from "@repo/db";
import type * as AdminReadsModule from "./admin-reads.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let reads: typeof AdminReadsModule;

const DAY = 86_400_000;
const now = Date.now();
/** Inside the 7d, 30d and 90d windows. */
const inWindow = new Date(now - 3 * DAY);
/** Inside the PREVIOUS 30d window (now−60d … now−30d), outside the current one. */
const inPrevious = new Date(now - 40 * DAY);
/** Outside every window this test asks about. */
const ancient = new Date(now - 400 * DAY);

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_test")
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
  reads = await import("./admin-reads.ts");

  // ─── courses: one of every window, plus a soft-deleted one ───
  const host = await db.course.create({
    data: { track: "forex", status: ContentStatus.DRAFT },
  });
  await db.course.createMany({
    data: [
      { track: "forex", status: ContentStatus.PUBLISHED, publishedAt: inWindow },
      { track: "forex", status: ContentStatus.PUBLISHED, publishedAt: inPrevious },
      { track: "forex", status: ContentStatus.PUBLISHED, publishedAt: ancient },
      // Soft-deleted and published: must not reach ANY number.
      {
        track: "forex",
        status: ContentStatus.PUBLISHED,
        publishedAt: inWindow,
        deletedAt: new Date(),
      },
    ],
  });

  // ─── lessons: the review family, so the pipeline's middle bucket has something to fold ───
  const section = await db.courseSection.create({ data: { courseId: host.id } });
  await db.lesson.createMany({
    data: [
      { sectionId: section.id, status: ContentStatus.DRAFT },
      { sectionId: section.id, status: ContentStatus.DRAFT },
      { sectionId: section.id, status: ContentStatus.IN_REVIEW },
      { sectionId: section.id, status: ContentStatus.PUBLISHED, publishedAt: inWindow },
      {
        sectionId: section.id,
        status: ContentStatus.PUBLISHED,
        publishedAt: inWindow,
        deletedAt: new Date(),
      },
    ],
  });

  // ─── quizzes ───
  await db.quiz.createMany({
    data: [
      { track: "forex", status: ContentStatus.PUBLISHED, publishedAt: inWindow },
      { track: "forex", status: ContentStatus.ARCHIVED },
    ],
  });

  // ─── glossary: SCHEDULED, plus PUBLISHED with no publishedAt at all ───
  // A row published before the column existed, or moved by hand: it is live,
  // so it counts as published, but it belongs to no window and must not be
  // silently bucketed into one.
  await db.glossaryTerm.createMany({
    data: [
      { status: ContentStatus.SCHEDULED, scheduledFor: new Date(now + 5 * DAY) },
      { status: ContentStatus.PUBLISHED, publishedAt: null },
    ],
  });

  // ─── videos ───
  await db.videoTopic.createMany({
    data: [
      { track: "forex", status: ContentStatus.PUBLISHED, publishedAt: inWindow },
      { track: "forex", status: ContentStatus.SEO_REVIEW },
    ],
  });

  // ─── articles ───
  const category = await db.articleCategory.create({ data: {} });
  await db.article.createMany({
    data: [
      {
        categoryId: category.id,
        status: ContentStatus.PUBLISHED,
        publishedAt: inWindow,
      },
      {
        categoryId: category.id,
        status: ContentStatus.PUBLISHED,
        publishedAt: inPrevious,
      },
      { categoryId: category.id, status: ContentStatus.DRAFT },
    ],
  });
}, 180_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

function row(rows: AdminReadsModule.ContentEntityStats[], entity: string) {
  const found = rows.find((r) => r.entity === entity);
  expect(found, `no row for ${entity}`).toBeDefined();
  return found!;
}

describe("loadAdminContentStats", () => {
  it("reports each content type from its OWN table", async () => {
    const rows = await reads.loadAdminContentStats("30d");

    expect(rows.map((r) => r.entity)).toEqual([...reads.DASHBOARD_CONTENT_ENTITIES]);
    // Six distinct totals: a closure reading the wrong delegate breaks two.
    expect(row(rows, "courses").total).toBe(4);
    expect(row(rows, "lessons").total).toBe(4);
    expect(row(rows, "quizzes").total).toBe(2);
    expect(row(rows, "glossary").total).toBe(2);
    expect(row(rows, "videos").total).toBe(2);
    expect(row(rows, "articles").total).toBe(3);
  });

  it("excludes soft-deleted rows from every number", async () => {
    const rows = await reads.loadAdminContentStats("30d");

    // Courses and lessons each carry one deleted PUBLISHED row, dated inside
    // the window — so it would show up in the total, the published count,
    // the status fold and the period count if `deletedAt: null` were missing
    // from any one of the three closures.
    const courses = row(rows, "courses");
    expect(courses.total).toBe(4);
    expect(courses.published).toBe(3);
    expect(courses.publishedInPeriod).toBe(1);

    const lessons = row(rows, "lessons");
    expect(lessons.total).toBe(4);
    expect(lessons.published).toBe(1);
    expect(lessons.publishedInPeriod).toBe(1);
  });

  it("breaks a type down by workflow state, and the bars sum to the row", async () => {
    const rows = await reads.loadAdminContentStats("30d");

    const lessons = row(rows, "lessons");
    expect(lessons.byStatus.DRAFT).toBe(2);
    expect(lessons.byStatus.IN_REVIEW).toBe(1);
    expect(lessons.byStatus.PUBLISHED).toBe(1);

    expect(row(rows, "quizzes").byStatus.ARCHIVED).toBe(1);
    expect(row(rows, "glossary").byStatus.SCHEDULED).toBe(1);
    expect(row(rows, "videos").byStatus.SEO_REVIEW).toBe(1);

    for (const entry of rows) {
      const summed = Object.values(entry.byStatus).reduce((sum, count) => sum + count, 0);
      expect(summed, `${entry.entity} bars under-fill their row`).toBe(entry.total);
      expect(entry.published).toBe(entry.byStatus.PUBLISHED);
    }
  });

  it("splits the window from the one before it, and counts no row twice", async () => {
    const rows = await reads.loadAdminContentStats("30d");

    // Courses: one in each window, one 400 days back in neither.
    const courses = row(rows, "courses");
    expect(courses.published).toBe(3);
    expect(courses.publishedInPeriod).toBe(1);
    expect(courses.publishedInPreviousPeriod).toBe(1);

    const articles = row(rows, "articles");
    expect(articles.publishedInPeriod).toBe(1);
    expect(articles.publishedInPreviousPeriod).toBe(1);

    // 7d reaches neither the 40-day-old row nor its own previous window
    // (now−14d … now−7d), which is where a window built off the wrong
    // start date would still find it.
    const week = await reads.loadAdminContentStats("7d");
    expect(row(week, "articles").publishedInPeriod).toBe(1);
    expect(row(week, "articles").publishedInPreviousPeriod).toBe(0);
  });

  it("counts a PUBLISHED row with no publishedAt as live, but in no window", async () => {
    const rows = await reads.loadAdminContentStats("30d");

    const glossary = row(rows, "glossary");
    expect(glossary.published).toBe(1);
    expect(glossary.publishedInPeriod).toBe(0);
    expect(glossary.publishedInPreviousPeriod).toBe(0);
  });

  it("queries only the types it was asked for — a hidden block costs no read", async () => {
    const rows = await reads.loadAdminContentStats("30d", ["lessons", "quizzes", "videos"]);

    // `lessons.view`'s three types, in registry order rather than argument
    // order (ADR-085 #2: the narrowing happens in the read).
    expect(rows.map((r) => r.entity)).toEqual(["lessons", "quizzes", "videos"]);
  });

  it("returns nothing at all for a subject with no content key", async () => {
    expect(await reads.loadAdminContentStats("30d", [])).toEqual([]);
  });
});

describe("loadAdminContentSeries", () => {
  it("buckets publishing by date and sums to the period count", async () => {
    const [series, stats] = await Promise.all([
      reads.loadAdminContentSeries("30d"),
      reads.loadAdminContentStats("30d"),
    ]);

    expect(series).toHaveLength(30);
    for (const entity of reads.DASHBOARD_CONTENT_ENTITIES) {
      const summed = series.reduce((sum, point) => sum + point[entity], 0);
      expect(summed, `${entity} series disagrees with its stat card`).toBe(
        row(stats, entity).publishedInPeriod,
      );
    }
  });

  it("puts a row in the bucket for the day it was published", async () => {
    const series = await reads.loadAdminContentSeries("30d");
    const day = inWindow.toISOString().slice(0, 10);

    const point = series.find((p) => p.date === day);
    expect(point, `no bucket for ${day}`).toBeDefined();
    expect(point!.articles).toBe(1);
    expect(point!.courses).toBe(1);
  });

  it("leaves a type it did not read at zero rather than undefined", async () => {
    const series = await reads.loadAdminContentSeries("30d", ["articles"]);

    for (const point of series) {
      for (const entity of reads.DASHBOARD_CONTENT_ENTITIES) {
        // A missing key plots as NaN and takes the whole panel with it.
        expect(Number.isFinite(point[entity]), `${entity} is not a number`).toBe(true);
      }
    }
    expect(series.reduce((sum, point) => sum + point.articles, 0)).toBe(1);
    expect(series.reduce((sum, point) => sum + point.lessons, 0)).toBe(0);
  });

  it("folds to the coarser bucket on a long range without losing a row", async () => {
    // 90d is 13 weekly buckets, so the 40-day-old article lands in one of
    // them — the arithmetic that turns a date into an index is where an
    // off-by-one drops the oldest or the newest row on the floor.
    const series = await reads.loadAdminContentSeries("90d");
    expect(series).toHaveLength(13);
    expect(series.reduce((sum, point) => sum + point.articles, 0)).toBe(2);
    expect(series.reduce((sum, point) => sum + point.courses, 0)).toBe(2);
  });

  it("excludes a row published before the window opened", async () => {
    const series = await reads.loadAdminContentSeries("7d");

    // The 400-day-old and 40-day-old courses are both outside 7d. Without
    // the `gte` they would clamp into the first bucket and invent a spike.
    expect(series.reduce((sum, point) => sum + point.courses, 0)).toBe(1);
    expect(series[0]!.courses).toBe(0);
  });
});
