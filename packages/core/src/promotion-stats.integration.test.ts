// changes-52 P7 (ADR-170) against a real MariaDB.
//
// What earns the container: the counter is one `INSERT … ON DUPLICATE KEY
// UPDATE` on a composite key, a foreign key drops an event for a vanished
// promotion, and the day column is a DATE. Each is a fact about MariaDB,
// which a mocked Prisma would only assert about itself.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type { PromotionEvent } from "@repo/contracts";
import type * as StatsModule from "./promotion-stats.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let stats: typeof StatsModule;

const DAY_ONE = new Date("2026-10-03T23:59:00.000Z");
const DAY_TWO = new Date("2026-10-04T00:01:00.000Z");

let popupId: string;
let bandId: string;

const event = (overrides: Partial<PromotionEvent>): PromotionEvent => ({
  id: popupId,
  surface: "POPUP",
  type: "IMPRESSION",
  ...overrides,
});

async function createPromotion(showAsPopup: boolean, showInBand: boolean): Promise<string> {
  const row = await db.promotion.create({
    data: {
      kind: "OFFER",
      status: "ACTIVE",
      placements: ["home"],
      showAsPopup,
      showInBand,
      startsAt: new Date("2026-10-01T00:00:00.000Z"),
      endsAt: new Date("2026-10-08T00:00:00.000Z"),
    },
  });
  return row.id;
}

const live = () => [
  { id: popupId, showAsPopup: true, showInBand: false, showAsBar: false },
  { id: bandId, showAsPopup: true, showInBand: true, showAsBar: true },
];

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_promotion_stats")
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
  stats = await import("./promotion-stats.ts");
}, 240_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

beforeEach(async () => {
  await db.promotionDailyStat.deleteMany();
  await db.promotion.deleteMany();
  popupId = await createPromotion(true, false);
  bandId = await createPromotion(true, true);
});

describe("recordPromotionEvents", () => {
  it("increments one row per promotion, day and surface", async () => {
    await stats.recordPromotionEvents([event({})], live(), DAY_ONE);
    await stats.recordPromotionEvents([event({}), event({ type: "CLICK" })], live(), DAY_ONE);

    const rows = await db.promotionDailyStat.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ impressions: 2, clicks: 1, dismissals: 0, surface: "POPUP" });
    expect(rows[0]!.day.toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });

  it("loses no increment when beacons arrive together", async () => {
    await Promise.all(
      Array.from({ length: 25 }, () => stats.recordPromotionEvents([event({})], live(), DAY_ONE)),
    );
    const row = await db.promotionDailyStat.findFirstOrThrow();
    expect(row.impressions).toBe(25);
  });

  it("starts a new row at the UTC day boundary", async () => {
    await stats.recordPromotionEvents([event({})], live(), DAY_ONE);
    await stats.recordPromotionEvents([event({})], live(), DAY_TWO);
    expect(await db.promotionDailyStat.count()).toBe(2);
  });

  it("never counts a promotion that is not in the live list, or on a surface it does not use", async () => {
    const draftId = await createPromotion(true, true);
    const counted = await stats.recordPromotionEvents(
      [
        event({ id: draftId }),
        event({ id: "invented" }),
        event({ surface: "BAND" }), // popupId has no band
        event({ id: bandId, surface: "BAND", type: "CLICK" }),
      ],
      live(),
      DAY_ONE,
    );
    expect(counted).toBe(1);
    const rows = await db.promotionDailyStat.findMany();
    expect(rows.map((r) => [r.promotionId, r.surface, r.clicks])).toEqual([[bandId, "BAND", 1]]);
  });

  it("drops an event for a promotion deleted since the list was cached, and keeps the rest", async () => {
    const goneId = await createPromotion(true, false);
    await db.promotion.delete({ where: { id: goneId } });
    const counted = await stats.recordPromotionEvents(
      [event({ id: goneId }), event({})],
      [...live(), { id: goneId, showAsPopup: true, showInBand: false, showAsBar: false }],
      DAY_ONE,
    );
    expect(counted).toBe(1);
    expect(await db.promotionDailyStat.count()).toBe(1);
  });

  it("goes with its promotion", async () => {
    await stats.recordPromotionEvents([event({})], live(), DAY_ONE);
    await db.promotion.delete({ where: { id: popupId } });
    expect(await db.promotionDailyStat.count()).toBe(0);
  });
});

describe("the admin reads", () => {
  beforeEach(async () => {
    await stats.recordPromotionEvents(
      [event({}), event({ type: "CLICK" }), event({ type: "DISMISS" })],
      live(),
      DAY_ONE,
    );
    await stats.recordPromotionEvents([event({})], live(), DAY_TWO);
    await stats.recordPromotionEvents(
      [event({ id: bandId, surface: "BAND" }), event({ id: bandId })],
      live(),
      DAY_TWO,
    );
  });

  it("totals each promotion across days and surfaces", async () => {
    const totals = await stats.getPromotionTotals([popupId, bandId, "none"]);
    expect(totals.get(popupId)).toEqual({ impressions: 2, clicks: 1, dismissals: 1 });
    expect(totals.get(bandId)).toEqual({ impressions: 2, clicks: 0, dismissals: 0 });
    expect(totals.has("none")).toBe(false);
  });

  it("splits by surface and lists recent days newest first", async () => {
    const result = await stats.getPromotionStats(bandId, 30, DAY_TWO);
    expect(result.popup.impressions).toBe(1);
    expect(result.band.impressions).toBe(1);
    expect(result.total.impressions).toBe(2);
    expect(result.daily).toEqual([
      {
        day: "2026-10-04",
        popup: { impressions: 1, clicks: 0, dismissals: 0 },
        band: { impressions: 1, clicks: 0, dismissals: 0 },
        bar: { impressions: 0, clicks: 0, dismissals: 0 },
      },
    ]);

    const popup = await stats.getPromotionStats(popupId, 30, DAY_TWO);
    expect(popup.daily.map((d) => d.day)).toEqual(["2026-10-04", "2026-10-03"]);
  });

  it("counts the banner as its own surface, dismissals included (ADR-173)", async () => {
    await stats.recordPromotionEvents(
      [
        event({ id: bandId, surface: "BAR" }),
        event({ id: bandId, surface: "BAR", type: "DISMISS" }),
        // The popup-only promotion has no banner, so this is not counted.
        event({ surface: "BAR" }),
      ],
      live(),
      DAY_TWO,
    );
    const result = await stats.getPromotionStats(bandId, 30, DAY_TWO);
    expect(result.bar).toEqual({ impressions: 1, clicks: 0, dismissals: 1 });
    expect(result.total.impressions).toBe(3);
    expect(result.daily[0]?.bar).toEqual({ impressions: 1, clicks: 0, dismissals: 1 });
    const popupOnly = await stats.getPromotionStats(popupId, 30, DAY_TWO);
    expect(popupOnly.bar.impressions).toBe(0);
  });

  it("keeps old days in the totals but out of the recent list", async () => {
    const result = await stats.getPromotionStats(popupId, 1, DAY_TWO);
    expect(result.daily.map((d) => d.day)).toEqual(["2026-10-04"]);
    expect(result.total.impressions).toBe(2);
  });
});
