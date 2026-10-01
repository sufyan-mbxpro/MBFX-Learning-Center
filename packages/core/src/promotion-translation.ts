// Machine translation of promotions (ADR-164, ADR-167 #6, changes-52 P6).
// The body is rich text; the title, badge, button label and alt text are
// plain, fitted to their columns.
//
// A machine row is shown to readers (MACHINE_TRANSLATED is a showable status,
// ADR-167 #6), but a figure that changed in translation writes NEEDS_REVIEW,
// which the public read treats as missing — for a promotion that is the price,
// the date or the percentage, exactly what must not go out wrong.
import {
  hashPromotionSource,
  loadPromotionSource,
  type PromotionSource,
} from "./promotion-source.ts";
import { defineTranslatable, type Segment } from "./translation-engine.ts";
import { TRANSLATION_TABLES } from "./translation-queue.ts";

/** The `PromotionTranslation` column widths. */
const MAX = { title: 160, badge: 40, ctaLabel: 60, imageAlt: 250 } as const;

const orNull = (original: string | null, value: string | undefined) =>
  original === null || original.trim() === "" ? null : value || null;

function promotionSegments(s: PromotionSource): Segment[] {
  return [
    { key: "title", kind: "text", text: s.title ?? "", max: MAX.title },
    { key: "body", kind: "html", text: s.body ?? "" },
    { key: "badge", kind: "text", text: s.badge ?? "", max: MAX.badge },
    { key: "ctaLabel", kind: "text", text: s.ctaLabel ?? "", max: MAX.ctaLabel },
    { key: "imageAlt", kind: "text", text: s.imageAlt ?? "", max: MAX.imageAlt },
  ];
}

export const promotionTranslatable = defineTranslatable<PromotionSource>({
  entityType: "promotion",
  ...TRANSLATION_TABLES.promotion,
  parentTable: "promotions",
  // A trashed promotion is never public, so it is not worth a character.
  parentWhere: "p.deletedAt IS NULL",
  titleColumn: "title",
  updatedAtColumn: "updatedAt",
  loadSource: loadPromotionSource,
  hash: hashPromotionSource,
  segments: promotionSegments,
  async write(tx, { entityId, locale, source, translated: t, status, hash }) {
    const data = {
      title: orNull(source.title, t.title),
      body: orNull(source.body, t.body),
      badge: orNull(source.badge, t.badge),
      ctaLabel: orNull(source.ctaLabel, t.ctaLabel),
      imageAlt: orNull(source.imageAlt, t.imageAlt),
      translationStatus: status,
      sourceHash: hash,
    };
    await tx.promotionTranslation.upsert({
      where: { promotionId_locale: { promotionId: entityId, locale } },
      update: data,
      create: { promotionId: entityId, locale, ...data },
    });
  },
});
