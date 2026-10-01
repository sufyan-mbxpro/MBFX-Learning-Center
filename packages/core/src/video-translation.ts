// Machine translation of video topics and video categories (Phase 5,
// ADR-161/162). A topic's link labels travel on its own translation row as a
// map from the English label (ADR-161 #8), because `saveVideoTopic` recreates
// the link rows on every save.
import { DbNull, type Prisma } from "@repo/db";

import {
  hashVideoCategorySource,
  hashVideoTopicSource,
  loadVideoCategorySource,
  loadVideoTopicSource,
  type VideoCategorySource,
  type VideoTopicSource,
} from "./video-source.ts";
import {
  defineTranslatable,
  pickTranslationSlug,
  type Segment,
  type Translated,
} from "./translation-engine.ts";
import { TRANSLATION_TABLES } from "./translation-queue.ts";

const MAX = {
  title: 255,
  name: 100,
  categoryDescription: 500,
  seoTitle: 70,
  seoDescription: 180,
  label: 200,
} as const;

const orNull = (original: string | null, value: string | undefined) =>
  original === null || original.trim() === "" ? null : (value ?? null);

function labelMap(labels: readonly string[], t: Translated): Prisma.InputJsonValue | typeof DbNull {
  if (labels.length === 0) return DbNull;
  return Object.fromEntries(labels.map((label, i) => [label, t[`link.${i}`] || label]));
}

export const videoTopicTranslatable = defineTranslatable<VideoTopicSource>({
  entityType: "video_topic",
  ...TRANSLATION_TABLES.video_topic,
  parentTable: "video_topics",
  parentWhere: "p.deletedAt IS NULL",
  titleColumn: "title",
  updatedAtColumn: "updatedAt",
  loadSource: loadVideoTopicSource,
  hash: hashVideoTopicSource,
  segments: (s): Segment[] => [
    { key: "title", kind: "text", text: s.title, max: MAX.title },
    { key: "summary", kind: "text", text: s.summary ?? "" },
    { key: "content", kind: "html", text: s.content ?? "" },
    { key: "seoTitle", kind: "text", text: s.seoTitle ?? "", max: MAX.seoTitle },
    { key: "seoDescription", kind: "text", text: s.seoDescription ?? "", max: MAX.seoDescription },
    ...s.linkLabels.map((text, i): Segment => ({
      key: `link.${i}`,
      kind: "text",
      text,
      max: MAX.label,
    })),
  ],
  async write(tx, { entityId, locale, source, translated: t, status, hash, exists }) {
    const data = {
      title: t.title ?? source.title,
      summary: orNull(source.summary, t.summary),
      content: orNull(source.content, t.content),
      seoTitle: orNull(source.seoTitle, t.seoTitle),
      seoDescription: orNull(source.seoDescription, t.seoDescription),
      linkLabels: labelMap(source.linkLabels, t),
      translationStatus: status,
      sourceHash: hash,
      translatedBy: null,
    };
    if (exists) {
      await tx.videoTopicTranslation.update({
        where: { topicId_locale: { topicId: entityId, locale } },
        data,
      });
    } else {
      await tx.videoTopicTranslation.create({
        data: {
          topicId: entityId,
          locale,
          slug: await pickTranslationSlug(
            tx,
            TRANSLATION_TABLES.video_topic,
            entityId,
            locale,
            source.slug,
          ),
          ...data,
        },
      });
    }
  },
});

export const videoCategoryTranslatable = defineTranslatable<VideoCategorySource>({
  entityType: "video_category",
  ...TRANSLATION_TABLES.video_category,
  parentTable: "video_categories",
  titleColumn: "name",
  updatedAtColumn: "updatedAt",
  loadSource: loadVideoCategorySource,
  hash: hashVideoCategorySource,
  segments: (s): Segment[] => [
    { key: "name", kind: "text", text: s.name, max: MAX.name },
    {
      key: "description",
      kind: "text",
      text: s.description ?? "",
      max: MAX.categoryDescription,
    },
    { key: "seoTitle", kind: "text", text: s.seoTitle ?? "", max: MAX.seoTitle },
    { key: "seoDescription", kind: "text", text: s.seoDescription ?? "", max: MAX.seoDescription },
  ],
  async write(tx, { entityId, locale, source, translated: t, status, hash, exists }) {
    const data = {
      name: t.name ?? source.name,
      description: orNull(source.description, t.description),
      seoTitle: orNull(source.seoTitle, t.seoTitle),
      seoDescription: orNull(source.seoDescription, t.seoDescription),
      translationStatus: status,
      sourceHash: hash,
    };
    if (exists) {
      await tx.videoCategoryTranslation.update({
        where: { categoryId_locale: { categoryId: entityId, locale } },
        data,
      });
    } else {
      await tx.videoCategoryTranslation.create({
        data: {
          categoryId: entityId,
          locale,
          slug: await pickTranslationSlug(
            tx,
            TRANSLATION_TABLES.video_category,
            entityId,
            locale,
            source.slug,
          ),
          ...data,
        },
      });
    }
  },
});
