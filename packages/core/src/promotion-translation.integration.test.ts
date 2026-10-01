// changes-52 P6 (ADR-164, ADR-167 #6): promotions on the one translation
// engine, on a real MariaDB with Google faked (MSW).
//
//   - An English save queues a job per active language; the job writes a
//     MACHINE_TRANSLATED row, and the popup then shows in that language.
//   - A figure that changed in translation is NEEDS_REVIEW, which the public
//     read treats as missing — a wrong price never goes out.
//   - A person's save is TRANSLATED with the hash of the English it was made
//     from; an English edit flags it OUTDATED, which hides it (ADR-167 #6).
//   - A linked promotion with no words of its own still gets a (blank) row,
//     so it shows in the language with the TARGET's words, and costs nothing.
//   - Coverage, the review queue and the backfill all list promotions.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PromotionSaveInput } from "@repo/contracts";

import {
  startTranslationTestDb,
  useFakeGoogle,
  type TranslationTestContext,
} from "./test-utils/translation-container.ts";
import type * as PromotionsModule from "./promotions.ts";
import type * as RunnerModule from "./translation-runner.ts";
import type * as AdminModule from "./translation-admin.ts";
import type * as TranslateModule from "@repo/translate";

let ctx: TranslationTestContext;
let promotions: typeof PromotionsModule;
let runner: typeof RunnerModule;
let admin: typeof AdminModule;
let translate: typeof TranslateModule;

const NOW = new Date("2026-10-02T12:00:00.000Z");
const START = new Date("2026-10-01T00:00:00.000Z");
const END = new Date("2026-10-08T00:00:00.000Z");

beforeAll(async () => {
  ctx = await startTranslationTestDb("mbfx_promotion_translation", [
    "promotions.create",
    "promotions.update",
    "promotions.publish",
  ]);
  promotions = await import("./promotions.ts");
  runner = await import("./translation-runner.ts");
  admin = await import("./translation-admin.ts");
  translate = await import("@repo/translate");
}, 180_000);

afterAll(async () => {
  await ctx?.stop();
});

beforeEach(async () => {
  useFakeGoogle(ctx.server);
  await ctx.db.translationJob.deleteMany();
  await ctx.db.promotion.deleteMany();
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
    translation: {
      locale: "en",
      title: "Save 20% this week",
      body: "<p>Every course, <strong>20%</strong> off until Friday.</p>",
      badge: "Ends Friday",
      ctaLabel: "See the offer",
      imageAlt: "A calendar",
    },
    ...overrides,
  };
}

async function createLive(overrides: Partial<PromotionSaveInput> = {}): Promise<string> {
  const id = await promotions.savePromotion(ctx.editor, input(overrides), NOW);
  await promotions.setPromotionStatus(ctx.editor, { id, status: "ACTIVE" }, NOW);
  return id;
}

const esRow = (promotionId: string) =>
  ctx.db.promotionTranslation.findFirst({ where: { promotionId, locale: "es" } });

describe("machine translation of a promotion", () => {
  it("translates every word on save, and the popup then shows in that language", async () => {
    const id = await createLive();
    await runner.drainTranslationQueue();

    expect(await esRow(id)).toMatchObject({
      title: "[es] Save 20% this week",
      badge: "[es] Ends Friday",
      ctaLabel: "[es] See the offer",
      imageAlt: "[es] A calendar",
      translationStatus: "MACHINE_TRANSLATED",
    });
    expect((await esRow(id))?.body).toContain("[es]");
    expect((await esRow(id))?.sourceHash).toMatch(/^[0-9a-f]{64}$/);

    const live = await promotions.loadLivePromotions("es", NOW);
    expect(live[0]).toMatchObject({ id, lang: "es", title: "[es] Save 20% this week" });
  });

  it("writes NEEDS_REVIEW when a figure changed, and the popup stays hidden in that language", async () => {
    useFakeGoogle(ctx.server, {
      translate: (segment, target) => `[${target}] ${segment.replace("20%", "2%")}`,
    });
    const id = await createLive();
    await runner.drainTranslationQueue();

    expect((await esRow(id))?.translationStatus).toBe("NEEDS_REVIEW");
    expect(await promotions.loadLivePromotions("es", NOW)).toEqual([]);
    const queue = await admin.loadTranslationReviewQueue({ locale: "es" });
    expect(queue).toContainEqual(
      expect.objectContaining({ entityType: "promotion", entityId: id, status: "NEEDS_REVIEW" }),
    );
  });

  it("gives a promotion with no words of its own a blank row, sending nothing", async () => {
    // A LINKED promotion may leave every word empty and borrow its target's.
    // This database has no content to link to, so the English row is blanked
    // out-of-band: the rule under test is about the words, not the link.
    const id = await promotions.savePromotion(ctx.editor, input(), NOW);
    await ctx.db.promotionTranslation.updateMany({
      where: { promotionId: id, locale: "en" },
      data: { title: null, body: null, badge: null, ctaLabel: null, imageAlt: null },
    });
    await ctx.db.translationJob.deleteMany();
    await translate.enqueueTranslationJobs([
      { entityType: "promotion", entityId: id, locale: "es" },
    ]);
    const google = useFakeGoogle(ctx.server);
    await runner.drainTranslationQueue();

    expect(await esRow(id)).toMatchObject({
      title: null,
      body: null,
      translationStatus: "MACHINE_TRANSLATED",
    });
    expect(google.calls).toHaveLength(0);
  });
});

describe("a person's translation", () => {
  it("is TRANSLATED with the English hash, and an English edit makes it OUTDATED and hidden", async () => {
    const id = await createLive();
    await promotions.savePromotionTranslation(ctx.editor, {
      promotionId: id,
      locale: "es",
      title: "Ahorra un 20% esta semana",
    });
    const english = await ctx.db.promotionTranslation.findFirstOrThrow({
      where: { promotionId: id, locale: "en" },
    });
    let es = await esRow(id);
    expect(es?.translationStatus).toBe("TRANSLATED");
    expect(es?.sourceHash).toBe(english.sourceHash);

    // The job never overwrites it…
    await runner.drainTranslationQueue();
    expect((await esRow(id))?.title).toBe("Ahorra un 20% esta semana");

    // …and a changed English marks it OUTDATED, words untouched, popup hidden.
    await promotions.savePromotion(
      ctx.editor,
      input({ id, translation: { ...input().translation, title: "Save 30% this week" } }),
      NOW,
    );
    await runner.drainTranslationQueue();
    es = await esRow(id);
    expect(es).toMatchObject({ title: "Ahorra un 20% esta semana", translationStatus: "OUTDATED" });
    expect(await promotions.loadLivePromotions("es", NOW)).toEqual([]);
  });

  it("keeps an untouched Google prefill MACHINE_TRANSLATED", async () => {
    const id = await createLive();
    await ctx.db.translationJob.deleteMany();
    await promotions.savePromotionTranslation(ctx.editor, {
      promotionId: id,
      locale: "es",
      title: "[es] Save 20% this week",
      machineTranslated: true,
    });
    expect((await esRow(id))?.translationStatus).toBe("MACHINE_TRANSLATED");
  });

  it("an unchanged English save leaves a person's row current", async () => {
    const id = await createLive();
    await promotions.savePromotionTranslation(ctx.editor, {
      promotionId: id,
      locale: "es",
      title: "Ahorra",
    });
    await promotions.savePromotion(ctx.editor, input({ id }), NOW);
    await runner.drainTranslationQueue();
    expect((await esRow(id))?.translationStatus).toBe("TRANSLATED");
  });
});

describe("the dashboard", () => {
  it("backfills promotions and counts their coverage, skipping the trash", async () => {
    const kept = await createLive();
    const trashed = await createLive();
    await ctx.db.promotion.update({ where: { id: trashed }, data: { deletedAt: new Date() } });
    await ctx.db.promotionTranslation.deleteMany({ where: { locale: "es" } });
    await ctx.db.translationJob.deleteMany();

    await translate.enqueueLocaleBackfill("es");
    await runner.drainTranslationQueue();

    expect((await esRow(kept))?.translationStatus).toBe("MACHINE_TRANSLATED");
    expect(await esRow(trashed)).toBeNull();

    const overview = await admin.loadTranslationOverview();
    const es = overview.locales.find((l) => l.code === "es")!;
    expect(es.types.find((t) => t.entityType === "promotion")?.coverage).toMatchObject({
      total: 1,
      machine: 1,
      missing: 0,
    });
  });
});
