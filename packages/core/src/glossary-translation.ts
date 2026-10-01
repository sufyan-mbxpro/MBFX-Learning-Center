// Machine translation of glossary terms and topics (Phase 5, ADR-161/162).
//
// A term's four explanations are rich text; its FAQ answers are plain (the
// contract's, like a course's). A machine-written term is never used for
// glossary substitution in other translations — `loadGlossaryPairs` takes
// only a person's `TRANSLATED` term — so machine output does not propagate
// into articles and lessons as though it were the site's agreed wording.
import { DbNull, type Prisma } from "@repo/db";

import {
  hashGlossaryTermSource,
  hashGlossaryTopicSource,
  loadGlossaryTermSource,
  loadGlossaryTopicSource,
  type GlossaryTermSource,
  type GlossaryTopicSource,
} from "./glossary-source.ts";
import { defineTranslatable, pickTranslationSlug, type Segment } from "./translation-engine.ts";
import { TRANSLATION_TABLES } from "./translation-queue.ts";

const MAX = {
  term: 150,
  topicName: 100,
  seoTitle: 70,
  seoDescription: 180,
  seoKeywords: 255,
  question: 300,
  answer: 5000,
} as const;

const orNull = (original: string | null, value: string | undefined) =>
  original === null || original.trim() === "" ? null : (value ?? null);

function termSegments(s: GlossaryTermSource): Segment[] {
  return [
    { key: "term", kind: "text", text: s.term, max: MAX.term },
    { key: "simple", kind: "html", text: s.simpleExplanation },
    { key: "detailed", kind: "html", text: s.detailedExplanation ?? "" },
    { key: "advanced", kind: "html", text: s.advancedExplanation ?? "" },
    { key: "example", kind: "html", text: s.exampleScenario ?? "" },
    { key: "seoTitle", kind: "text", text: s.seoTitle ?? "", max: MAX.seoTitle },
    { key: "seoDescription", kind: "text", text: s.seoDescription ?? "", max: MAX.seoDescription },
    ...s.faq.flatMap((f, i): Segment[] => [
      { key: `faq.${i}.q`, kind: "text", text: f.question, max: MAX.question },
      { key: `faq.${i}.a`, kind: "text", text: f.answer, max: MAX.answer },
    ]),
  ];
}

export const glossaryTermTranslatable = defineTranslatable<GlossaryTermSource>({
  entityType: "glossary_term",
  ...TRANSLATION_TABLES.glossary_term,
  parentTable: "glossary_terms",
  parentWhere: "p.deletedAt IS NULL",
  titleColumn: "term",
  updatedAtColumn: "updatedAt",
  loadSource: loadGlossaryTermSource,
  hash: hashGlossaryTermSource,
  segments: termSegments,
  async write(tx, { entityId, locale, source, translated: t, status, hash, exists }) {
    const data = {
      term: t.term ?? source.term,
      simpleExplanation: t.simple ?? source.simpleExplanation,
      detailedExplanation: orNull(source.detailedExplanation, t.detailed),
      advancedExplanation: orNull(source.advancedExplanation, t.advanced),
      exampleScenario: orNull(source.exampleScenario, t.example),
      seoTitle: orNull(source.seoTitle, t.seoTitle),
      seoDescription: orNull(source.seoDescription, t.seoDescription),
      faq:
        source.faq.length > 0
          ? (source.faq.map((_, i) => ({
              question: t[`faq.${i}.q`] ?? "",
              answer: t[`faq.${i}.a`] ?? "",
            })) as Prisma.InputJsonValue)
          : DbNull,
      translationStatus: status,
      sourceHash: hash,
    };
    if (exists) {
      await tx.glossaryTermTranslation.update({
        where: { termId_locale: { termId: entityId, locale } },
        data,
      });
    } else {
      await tx.glossaryTermTranslation.create({
        data: {
          termId: entityId,
          locale,
          slug: await pickTranslationSlug(
            tx,
            TRANSLATION_TABLES.glossary_term,
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

export const glossaryTopicTranslatable = defineTranslatable<GlossaryTopicSource>({
  entityType: "glossary_topic",
  ...TRANSLATION_TABLES.glossary_topic,
  parentTable: "glossary_topics",
  titleColumn: "name",
  updatedAtColumn: "updatedAt",
  loadSource: loadGlossaryTopicSource,
  hash: hashGlossaryTopicSource,
  segments: (s) => [
    { key: "name", kind: "text", text: s.name, max: MAX.topicName },
    { key: "description", kind: "html", text: s.description ?? "" },
    { key: "seoTitle", kind: "text", text: s.seoTitle ?? "", max: MAX.seoTitle },
    { key: "seoDescription", kind: "text", text: s.seoDescription ?? "", max: MAX.seoDescription },
    { key: "seoKeywords", kind: "text", text: s.seoKeywords ?? "", max: MAX.seoKeywords },
  ],
  async write(tx, { entityId, locale, source, translated: t, status, hash, exists }) {
    const data = {
      name: t.name ?? source.name,
      description: orNull(source.description, t.description),
      seoTitle: orNull(source.seoTitle, t.seoTitle),
      seoDescription: orNull(source.seoDescription, t.seoDescription),
      seoKeywords: orNull(source.seoKeywords, t.seoKeywords),
      translationStatus: status,
      sourceHash: hash,
    };
    if (exists) {
      await tx.glossaryTopicTranslation.update({
        where: { topicId_locale: { topicId: entityId, locale } },
        data,
      });
    } else {
      await tx.glossaryTopicTranslation.create({
        data: {
          topicId: entityId,
          locale,
          slug: await pickTranslationSlug(
            tx,
            TRANSLATION_TABLES.glossary_topic,
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
