// changes-52 P2 (ADR-167) against a real MariaDB.
//
// What earns the container: every rule here is a cross-table fact. That a
// promotion disappears when its COURSE is unpublished is a property of the
// course table's own public rule, composed; that Arabic words flagged for
// review hide the popup is a fact about the translation table; that one save
// wrote the promotion, its words and its media reference is a transaction.
// A mocked Prisma would be asserting about itself.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { db as DbClient } from "@repo/db";
import type { PromotionSaveInput } from "@repo/contracts";
import type { Subject } from "@repo/rbac";
import type * as PromotionsModule from "./promotions.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let promotions: typeof PromotionsModule;

const ALL_KEYS = [
  "promotions.view",
  "promotions.create",
  "promotions.update",
  "promotions.delete",
  "promotions.publish",
];

let publisher: Subject;
/** Everything except publish — ADR-167 #7's author. */
let author: Subject;

const NOW = new Date("2026-10-03T12:00:00.000Z");
const START = new Date("2026-10-01T00:00:00.000Z");
const END = new Date("2026-10-08T00:00:00.000Z");

let courseId: string;
let draftArticleId: string;
let videoTopicId: string;
let imageId: string;

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_promotions")
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
  promotions = await import("./promotions.ts");

  const staff = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "promo-publisher@x.com",
      name: "Publisher",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  publisher = {
    id: staff.id,
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 60,
    allowed: new Set(ALL_KEYS),
    denied: new Set(),
  };
  author = { ...publisher, allowed: new Set(ALL_KEYS.filter((k) => k !== "promotions.publish")) };

  await db.locale.createMany({
    data: [
      {
        code: "en",
        name: "English",
        nativeName: "English",
        direction: "LTR",
        isDefault: true,
        isActive: true,
        sortOrder: 1,
      },
      {
        code: "ar",
        name: "Arabic",
        nativeName: "العربية",
        direction: "RTL",
        isDefault: false,
        isActive: true,
        sortOrder: 2,
      },
    ],
  });

  const course = await db.course.create({
    data: {
      track: "forex",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      publishedAt: new Date("2026-09-01T00:00:00Z"),
      translations: {
        create: [
          {
            locale: "en",
            title: "Forex basics",
            slug: "forex-basics",
            summary: "<p>Start <strong>here</strong>.</p>",
          },
          { locale: "ar", title: "أساسيات الفوركس", slug: "asasiyat", summary: "ابدأ هنا." },
        ],
      },
    },
  });
  courseId = course.id;

  const article = await db.article.create({
    data: {
      kind: "NEWS",
      status: "DRAFT",
      isActive: true,
      category: {
        create: { translations: { create: { locale: "en", name: "Markets", slug: "markets" } } },
      },
      translations: {
        create: {
          locale: "en",
          title: "Unpublished scoop",
          slug: "scoop",
          translationStatus: "TRANSLATED",
        },
      },
    },
  });
  draftArticleId = article.id;

  const topic = await db.videoTopic.create({
    data: {
      track: "forex",
      status: "PUBLISHED",
      publishedAt: new Date("2026-09-01T00:00:00Z"),
      translations: { create: { locale: "en", title: "Webinar recording", slug: "webinar-rec" } },
    },
  });
  videoTopicId = topic.id;

  const asset = await db.mediaAsset.create({
    data: {
      key: "promo/aaaaaaaaaaaaaaaaaaaaaaaa.webp",
      url: "/uploads/promo/aaaaaaaaaaaaaaaaaaaaaaaa.webp",
      fileName: "offer.webp",
      mimeType: "image/webp",
      size: 1000,
      purpose: "content",
      folder: "/promo",
    },
  });
  imageId = asset.id;
}, 180_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

beforeEach(async () => {
  await db.promotion.deleteMany();
  await db.contentReference.deleteMany({ where: { sourceType: "PROMOTION" } });
});

function input(overrides: Partial<PromotionSaveInput> = {}): PromotionSaveInput {
  return {
    kind: "OFFER",
    placements: ["home"],
    showAsPopup: true,
    showInBand: false,
    showAsBar: false,
    barPosition: "BOTTOM",
    priority: 0,
    startsAt: START,
    endsAt: END,
    frequency: "PER_SESSION",
    delaySeconds: 5,
    audience: "ALL",
    untranslated: "HIDE",
    link: { kind: "PATH", path: "/support" },
    translation: { locale: "en", title: "Autumn offer", ctaLabel: "Find out more" },
    ...overrides,
  };
}

async function createLive(overrides: Partial<PromotionSaveInput> = {}): Promise<string> {
  const id = await promotions.savePromotion(publisher, input(overrides), NOW);
  await promotions.setPromotionStatus(publisher, { id, status: "ACTIVE" }, NOW);
  return id;
}

const liveIds = async (locale = "en", at = NOW) =>
  (await promotions.loadLivePromotions(locale, at)).map((p) => p.id);

// ─── The window and the status ───────────────────────────────

describe("what is live", () => {
  it("shows an active promotion inside its window, start inclusive and end exclusive", async () => {
    const id = await createLive();
    expect(await liveIds("en", START)).toEqual([id]);
    expect(await liveIds("en", new Date(END.getTime() - 1))).toEqual([id]);
    expect(await liveIds("en", END)).toEqual([]);
    expect(await liveIds("en", new Date(START.getTime() - 1))).toEqual([]);
  });

  it("never shows a draft, an archived row or the trash", async () => {
    const draft = await promotions.savePromotion(publisher, input(), NOW);
    const archived = await createLive();
    await promotions.setPromotionStatus(publisher, { id: archived, status: "ARCHIVED" }, NOW);
    const trashed = await createLive();
    await promotions.softDeletePromotion(publisher, trashed);

    const live = await liveIds();
    expect(live).not.toContain(draft);
    expect(live).not.toContain(archived);
    expect(live).not.toContain(trashed);
  });

  it("orders by priority, highest first", async () => {
    const low = await createLive({ priority: 1 });
    const high = await createLive({ priority: 50 });
    expect(await liveIds()).toEqual([high, low]);
  });

  it("derives the phase in the admin list instead of storing it", async () => {
    const id = await createLive();
    const [before] = await promotions.listPromotions({}, new Date("2026-09-20T00:00:00Z"));
    const [during] = await promotions.listPromotions({}, NOW);
    const [after] = await promotions.listPromotions({}, new Date("2026-10-20T00:00:00Z"));
    expect([before?.phase, during?.phase, after?.phase]).toEqual(["SCHEDULED", "LIVE", "ENDED"]);
    expect((await db.promotion.findUniqueOrThrow({ where: { id } })).status).toBe("ACTIVE");
  });
});

// ─── What the public read carries ────────────────────────────

describe("the public shape", () => {
  it("resolves a path link, sanitizes the body, and carries no target id", async () => {
    await createLive({
      translation: {
        locale: "en",
        title: "Autumn offer",
        ctaLabel: "Find out more",
        body: '<p>Save <strong>now</strong><script>alert(1)</script><img src=x onerror="x()"></p>',
      },
    });
    const [promo] = await promotions.loadLivePromotions("en", NOW);
    expect(promo?.href).toBe("/support");
    expect(promo?.external).toBe(false);
    expect(promo?.bodyHtml).toContain("<strong>now</strong>");
    expect(promo?.bodyHtml).not.toContain("script");
    expect(promo?.bodyHtml).not.toContain("onerror");
    expect(Object.keys(promo ?? {})).not.toContain("targetId");
    expect(Object.keys(promo ?? {})).not.toContain("status");
  });

  it("carries the banner and its position, and the admin detail reads them back (ADR-173)", async () => {
    const id = await createLive({ showAsPopup: false, showAsBar: true, barPosition: "LEFT" });
    const [promo] = await promotions.loadLivePromotions("en", NOW);
    expect(promo).toMatchObject({
      id,
      showAsPopup: false,
      showAsBar: true,
      barPosition: "LEFT",
    });
    expect(await promotions.getPromotion(id, NOW)).toMatchObject({
      showAsBar: true,
      barPosition: "LEFT",
    });
    const copy = await promotions.duplicatePromotion(publisher, id);
    expect(await promotions.getPromotion(copy, NOW)).toMatchObject({
      showAsBar: true,
      barPosition: "LEFT",
    });
  });

  it("marks an external link as external", async () => {
    await createLive({ link: { kind: "EXTERNAL", url: "https://zoom.us/j/123" } });
    const [promo] = await promotions.loadLivePromotions("en", NOW);
    expect(promo).toMatchObject({ href: "https://zoom.us/j/123", external: true });
  });

  it("drops a button label when there is nowhere to go", async () => {
    // The contract refuses this on save; a row written around it still must
    // not render a button that does nothing.
    const id = await createLive({
      link: { kind: "NONE" },
      translation: { locale: "en", title: "Notice" },
    });
    await db.promotionTranslation.updateMany({
      where: { promotionId: id },
      data: { ctaLabel: "Go" },
    });
    const [promo] = await promotions.loadLivePromotions("en", NOW);
    expect(promo).toMatchObject({ href: null, ctaLabel: null });
  });

  it("resolves the image through the media library and records the reference", async () => {
    const id = await createLive({
      imageAssetId: imageId,
      translation: { locale: "en", title: "Offer", imageAlt: "A chart" },
    });
    const [promo] = await promotions.loadLivePromotions("en", NOW);
    expect(promo?.imageUrl).toBe("/uploads/promo/aaaaaaaaaaaaaaaaaaaaaaaa.webp");
    expect(promo?.imageAlt).toBe("A chart");
    const refs = await db.contentReference.findMany({
      where: { sourceType: "PROMOTION", sourceId: id },
    });
    expect(refs).toMatchObject([{ refType: "MEDIA", refId: imageId, field: "imageAssetId" }]);
  });
});

// ─── Linked content (ADR-167 #4) ─────────────────────────────

describe("a promotion linked to site content", () => {
  const toCourse = { kind: "CONTENT" as const, targetType: "COURSE" as const, targetId: "" };

  it("borrows the course's title and summary as plain text, and links to it", async () => {
    await createLive({
      link: { ...toCourse, targetId: courseId },
      translation: { locale: "en", ctaLabel: "Start" },
    });
    const [promo] = await promotions.loadLivePromotions("en", NOW);
    expect(promo).toMatchObject({
      title: "Forex basics",
      summary: "Start here.",
      bodyHtml: null,
      href: "/learn/forex/forex-basics",
    });
  });

  it("links through the reader's own slug", async () => {
    await createLive({ link: { ...toCourse, targetId: courseId } });
    await db.promotionTranslation.create({
      data: {
        promotionId: (await db.promotion.findFirstOrThrow()).id,
        locale: "ar",
        title: "عرض الخريف",
        translationStatus: "TRANSLATED",
      },
    });
    const [promo] = await promotions.loadLivePromotions("ar", NOW);
    expect(promo).toMatchObject({ lang: "ar", title: "عرض الخريف", href: "/learn/forex/asasiyat" });
  });

  it("disappears when the course stops being public, and returns with it", async () => {
    const id = await createLive({ link: { ...toCourse, targetId: courseId } });
    await db.course.update({ where: { id: courseId }, data: { isActive: false } });
    try {
      expect(await liveIds()).toEqual([]);
      const [row] = await promotions.listPromotions({}, NOW);
      expect(row?.targetPublic).toBe(false);
    } finally {
      await db.course.update({ where: { id: courseId }, data: { isActive: true } });
    }
    expect(await liveIds()).toEqual([id]);
  });

  it("may link to a draft on save, and stays hidden until it is published", async () => {
    await createLive({
      link: { kind: "CONTENT", targetType: "ARTICLE", targetId: draftArticleId },
      translation: { locale: "en" },
    });
    expect(await liveIds()).toEqual([]);
  });

  it("hides a promotion whose section a feature flag has switched off", async () => {
    await createLive({ link: { ...toCourse, targetId: courseId } });
    const hidden = await promotions.loadLivePromotions("en", NOW, {
      unavailableTargetTypes: ["COURSE"],
    });
    expect(hidden).toEqual([]);
  });

  it("refuses to save a link to content that does not exist", async () => {
    await expect(
      promotions.savePromotion(
        publisher,
        input({ link: { ...toCourse, targetId: "missing" } }),
        NOW,
      ),
    ).rejects.toMatchObject({ reason: "targetMissing" });
  });

  it("resolves a webinar's recording to a public video path", async () => {
    await createLive({
      kind: "WEBINAR",
      eventStartsAt: new Date("2026-10-02T15:00:00Z"),
      eventEndsAt: new Date("2026-10-02T16:00:00Z"),
      recordingTopicId: videoTopicId,
    });
    const [promo] = await promotions.loadLivePromotions("en", NOW);
    expect(promo?.recordingHref).toBe("/learn/forex/videos/webinar-rec");
    expect(promo?.eventStartsAt).toBe("2026-10-02T15:00:00.000Z");
  });
});

// ─── Languages (ADR-167 #6) ──────────────────────────────────

describe("which language a reader sees", () => {
  async function withArabic(
    status: "TRANSLATED" | "MACHINE_TRANSLATED" | "NEEDS_REVIEW" | "OUTDATED",
  ) {
    const id = await createLive();
    await db.promotionTranslation.create({
      data: { promotionId: id, locale: "ar", title: "عرض", translationStatus: status },
    });
    return id;
  }

  it("shows a human or machine translation in the reader's language", async () => {
    await withArabic("TRANSLATED");
    expect((await promotions.loadLivePromotions("ar", NOW))[0]).toMatchObject({
      lang: "ar",
      title: "عرض",
    });
    await db.promotion.deleteMany();
    await withArabic("MACHINE_TRANSLATED");
    expect((await promotions.loadLivePromotions("ar", NOW))[0]?.lang).toBe("ar");
  });

  it("hides a promotion whose translation is flagged or out of date", async () => {
    await withArabic("NEEDS_REVIEW");
    expect(await liveIds("ar")).toEqual([]);
    await db.promotion.deleteMany();
    await withArabic("OUTDATED");
    expect(await liveIds("ar")).toEqual([]);
  });

  it("hides an untranslated promotion by default, and shows the English when told to", async () => {
    const hidden = await createLive();
    const english = await createLive({ untranslated: "SHOW_DEFAULT" });
    const live = await promotions.loadLivePromotions("ar", NOW);
    expect(live.map((p) => p.id)).toEqual([english]);
    expect(live[0]?.lang).toBe("en");
    expect(live.map((p) => p.id)).not.toContain(hidden);
  });

  it("falls back to the English for a flagged translation when told to", async () => {
    const id = await withArabic("NEEDS_REVIEW");
    await db.promotion.update({ where: { id }, data: { untranslated: "SHOW_DEFAULT" } });
    expect((await promotions.loadLivePromotions("ar", NOW))[0]).toMatchObject({
      lang: "en",
      title: "Autumn offer",
    });
  });

  it("lists every active language's state for the admin", async () => {
    await withArabic("MACHINE_TRANSLATED");
    const [row] = await promotions.listPromotions({}, NOW);
    expect(row?.locales).toEqual([
      { locale: "en", state: "TRANSLATED" },
      { locale: "ar", state: "MACHINE_TRANSLATED" },
    ]);
  });

  it("saves a person's translation as TRANSLATED, and refuses the default language there", async () => {
    const id = await promotions.savePromotion(publisher, input(), NOW);
    await promotions.savePromotionTranslation(author, {
      promotionId: id,
      locale: "ar",
      title: " عرض ",
    });
    const row = await db.promotionTranslation.findUniqueOrThrow({
      where: { promotionId_locale: { promotionId: id, locale: "ar" } },
    });
    expect(row).toMatchObject({
      title: "عرض",
      translationStatus: "TRANSLATED",
      translatedBy: author.id,
    });
    await expect(
      promotions.savePromotionTranslation(author, { promotionId: id, locale: "en", title: "x" }),
    ).rejects.toMatchObject({ reason: "notDefaultLocale" });
    await expect(
      promotions.savePromotionTranslation(author, { promotionId: id, locale: "es", title: "x" }),
    ).rejects.toMatchObject({ reason: "localeNotActive" });
  });
});

// ─── Writes and who may make them ────────────────────────────

describe("writes", () => {
  it("bumps the version on every save, so an edited popup is shown again", async () => {
    const id = await promotions.savePromotion(publisher, input(), NOW);
    await promotions.savePromotion(publisher, input({ id, priority: 3 }), NOW);
    expect((await db.promotion.findUniqueOrThrow({ where: { id } })).version).toBe(2);
  });

  it("writes an audit row for every change", async () => {
    const id = await createLive();
    await promotions.softDeletePromotion(publisher, id);
    const actions = (
      await db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } })
    ).map((a) => a.action);
    expect(actions).toEqual(["promotions.create", "promotions.publish", "promotions.delete"]);
  });

  it("lets an author draft, but not activate or edit a live promotion", async () => {
    const id = await promotions.savePromotion(author, input(), NOW);
    await promotions.savePromotion(author, input({ id, priority: 2 }), NOW);
    await expect(
      promotions.setPromotionStatus(author, { id, status: "ACTIVE" }, NOW),
    ).rejects.toMatchObject({ permission: "promotions.publish" });

    await promotions.setPromotionStatus(publisher, { id, status: "ACTIVE" }, NOW);
    await expect(promotions.savePromotion(author, input({ id }), NOW)).rejects.toMatchObject({
      permission: "promotions.publish",
    });
    await expect(
      promotions.savePromotionTranslation(author, { promotionId: id, locale: "ar", title: "x" }),
    ).rejects.toMatchObject({ permission: "promotions.publish" });
  });

  it("refuses a subject with no promotion keys at all", async () => {
    const nobody = { ...publisher, allowed: new Set<string>() };
    await expect(promotions.savePromotion(nobody, input(), NOW)).rejects.toMatchObject({
      permission: "promotions.create",
    });
  });

  it("refuses to activate a promotion whose window has already closed", async () => {
    const id = await promotions.savePromotion(publisher, input(), NOW);
    await expect(
      promotions.setPromotionStatus(
        publisher,
        { id, status: "ACTIVE" },
        new Date("2026-10-09T00:00:00Z"),
      ),
    ).rejects.toMatchObject({ reason: "windowEnded" });
  });

  it("restores from the trash as a draft, never straight back onto the site", async () => {
    const id = await createLive();
    await promotions.softDeletePromotion(publisher, id);
    expect(await promotions.listPromotions({}, NOW)).toEqual([]);
    expect((await promotions.listPromotions({ deleted: true }, NOW)).map((r) => r.id)).toEqual([
      id,
    ]);
    await promotions.restorePromotion(publisher, id);
    expect((await db.promotion.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");
    expect(await liveIds()).toEqual([]);
  });

  it("duplicates as a draft with every language and the image reference", async () => {
    const id = await createLive({ imageAssetId: imageId });
    await promotions.savePromotionTranslation(publisher, {
      promotionId: id,
      locale: "ar",
      title: "عرض",
    });
    const copy = await promotions.duplicatePromotion(publisher, id);
    const row = await db.promotion.findUniqueOrThrow({
      where: { id: copy },
      include: { translations: true },
    });
    expect(row.status).toBe("DRAFT");
    expect(row.version).toBe(1);
    expect(row.translations.map((t) => t.locale).sort()).toEqual(["ar", "en"]);
    expect(
      await db.contentReference.count({
        where: { sourceType: "PROMOTION", sourceId: copy, refId: imageId },
      }),
    ).toBe(1);
  });
});

// ─── Link picker ─────────────────────────────────────────────

describe("searchLinkableContent", () => {
  it("offers drafts, labelled, and says which are public", async () => {
    const found = await promotions.searchLinkableContent("", ["COURSE", "ARTICLE"], NOW);
    expect(found).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "COURSE",
          id: courseId,
          status: "PUBLISHED",
          isPublic: true,
        }),
        expect.objectContaining({
          type: "ARTICLE",
          id: draftArticleId,
          status: "DRAFT",
          isPublic: false,
        }),
      ]),
    );
  });

  it("matches the title, and treats a wildcard as a character", async () => {
    expect(
      (await promotions.searchLinkableContent("basics", ["COURSE"], NOW)).map((r) => r.id),
    ).toEqual([courseId]);
    expect(await promotions.searchLinkableContent("%%", ["COURSE", "ARTICLE"], NOW)).toHaveLength(
      2,
    );
    expect(await promotions.searchLinkableContent("nothing-like-it", undefined, NOW)).toEqual([]);
  });
});
