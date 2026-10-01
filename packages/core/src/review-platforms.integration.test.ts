// ADR-169 / changes-53 — the review platforms service against real MariaDB:
// admin list, one-transaction save with audit + tag, the public read's
// filtering, and the migration that moved `site.reviewsUrl` into a row.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import { REVIEW_PLATFORM_KEYS, type ReviewPlatformsSaveInput } from "@repo/contracts";
import type * as ReviewModule from "./review-platforms.ts";
import { resetRevalidateTagCalls, revalidateTagCalls } from "./test-utils/next-cache-stub.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
const migrationSql = readFileSync(
  fileURLToPath(
    new URL(
      "../../db/prisma/migrations/20260929150000_review_platforms_changes53_adr169/migration.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let reviews: typeof ReviewModule;
let actorId: string;

const PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";

function input(
  rows: Partial<
    Record<
      (typeof REVIEW_PLATFORM_KEYS)[number],
      Partial<ReviewPlatformsSaveInput["platforms"][number]>
    >
  >,
  order: readonly (typeof REVIEW_PLATFORM_KEYS)[number][] = REVIEW_PLATFORM_KEYS,
): ReviewPlatformsSaveInput {
  return {
    platforms: order.map((platform) => ({
      platform,
      isEnabled: false,
      identifier: "",
      customUrl: "",
      ...rows[platform],
    })),
  };
}

/** The data half of the migration (everything after CREATE TABLE), run again on demand. */
async function runMigrationDataMove() {
  // Comments go first: a `;` inside one would otherwise split a statement.
  const statements = migrationSql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("INSERT") || s.startsWith("DELETE"));
  expect(statements).toHaveLength(2);
  for (const statement of statements) await db.$executeRawUnsafe(statement);
}

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
  reviews = await import("./review-platforms.ts");
  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "reviews-admin@example.com",
      name: "Reviews Admin",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  actorId = user.id;
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

beforeEach(async () => {
  await db.reviewPlatform.deleteMany();
  resetRevalidateTagCalls();
});

describe("listReviewPlatforms", () => {
  it("lists every registry platform, switched off, on an empty table", async () => {
    const rows = await reviews.listReviewPlatforms();
    expect(rows.map((r) => r.platform)).toEqual([...REVIEW_PLATFORM_KEYS]);
    expect(rows.every((r) => !r.isEnabled && r.resolvedUrl === null)).toBe(true);
  });

  it("ignores a row whose platform the registry does not list", async () => {
    await db.reviewPlatform.create({
      data: { platform: "yelp", isEnabled: true, customUrl: "https://yelp.com/x" },
    });
    const rows = await reviews.listReviewPlatforms();
    expect(rows.map((r) => r.platform)).not.toContain("yelp");
    expect(await reviews.loadActiveReviewLinks()).toEqual([]);
  });
});

describe("saveReviewPlatforms", () => {
  it("writes order, switches and normalised identifiers, with one audit row and the settings tag", async () => {
    await reviews.saveReviewPlatforms(
      actorId,
      input(
        {
          google: { isEnabled: true, identifier: ` ${PLACE_ID} ` },
          facebook: { isEnabled: true, identifier: "@mbfxofficial" },
          trustpilot: { identifier: "https://www.MBFX.co/" },
        },
        ["google", "facebook", "trustpilot"],
      ),
    );

    const rows = await reviews.listReviewPlatforms();
    expect(rows.map((r) => [r.platform, r.isEnabled, r.identifier])).toEqual([
      ["google", true, PLACE_ID],
      ["facebook", true, "mbfxofficial"],
      ["trustpilot", false, "mbfx.co"],
    ]);

    const audits = await db.auditLog.findMany({ where: { action: "reviewPlatforms.update" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.userId).toBe(actorId);
    expect(revalidateTagCalls).toEqual([{ tag: "settings:general", opts: { expire: 0 } }]);
  });

  it("stores an empty custom link as null and keeps a set one", async () => {
    await reviews.saveReviewPlatforms(
      actorId,
      input({ google: { isEnabled: true, customUrl: "https://g.page/r/abc/review" } }),
    );
    const google = await db.reviewPlatform.findUniqueOrThrow({ where: { platform: "google" } });
    const trustpilot = await db.reviewPlatform.findUniqueOrThrow({
      where: { platform: "trustpilot" },
    });
    expect(google.customUrl).toBe("https://g.page/r/abc/review");
    expect(trustpilot.customUrl).toBeNull();
  });
});

describe("loadActiveReviewLinks", () => {
  it("returns enabled platforms with a link, in order, as platform + url only", async () => {
    await reviews.saveReviewPlatforms(
      actorId,
      input(
        {
          facebook: { isEnabled: true, identifier: "mbfxofficial" },
          trustpilot: { isEnabled: true, identifier: "mbfx.co" },
          google: { isEnabled: false, identifier: PLACE_ID },
        },
        ["facebook", "trustpilot", "google"],
      ),
    );
    expect(await reviews.loadActiveReviewLinks()).toEqual([
      { platform: "facebook", url: "https://www.facebook.com/mbfxofficial/reviews" },
      { platform: "trustpilot", url: "https://www.trustpilot.com/evaluate/mbfx.co" },
    ]);
  });

  it("drops an enabled row whose values were corrupted outside the admin", async () => {
    await db.reviewPlatform.createMany({
      data: [
        { platform: "trustpilot", isEnabled: true, customUrl: "javascript:alert(1)" },
        { platform: "google", isEnabled: true, identifier: "bad id with spaces" },
        { platform: "facebook", isEnabled: true },
      ],
    });
    expect(await reviews.loadActiveReviewLinks()).toEqual([]);
  });
});

describe("migration 20260929150000 — site.reviewsUrl becomes the Trustpilot row", () => {
  async function seedSetting(value: unknown) {
    await db.setting.deleteMany({ where: { key: "site.reviewsUrl" } });
    await db.setting.create({
      data: {
        groupName: "general",
        key: "site.reviewsUrl",
        value: value as never,
        label: "Reviews page (Trustpilot)",
        isPublic: true,
      },
    });
  }

  it("carries a non-empty value into an enabled Trustpilot custom link and deletes the setting", async () => {
    await seedSetting("https://www.trustpilot.com/review/mbfx.co");
    await runMigrationDataMove();
    const row = await db.reviewPlatform.findUniqueOrThrow({ where: { platform: "trustpilot" } });
    expect(row.isEnabled).toBe(true);
    expect(row.customUrl).toBe("https://www.trustpilot.com/review/mbfx.co");
    expect(await db.setting.findUnique({ where: { key: "site.reviewsUrl" } })).toBeNull();
    expect(await reviews.loadActiveReviewLinks()).toEqual([
      { platform: "trustpilot", url: "https://www.trustpilot.com/review/mbfx.co" },
    ]);
  });

  it("leaves every platform off for an empty value, and still deletes the setting", async () => {
    await seedSetting("");
    await runMigrationDataMove();
    expect(await db.reviewPlatform.count()).toBe(0);
    expect(await db.setting.findUnique({ where: { key: "site.reviewsUrl" } })).toBeNull();
  });
});
