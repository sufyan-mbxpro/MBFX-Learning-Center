// Machine translation of tool pages (Phase 5, ADR-161/162). The intro, body
// and FAQ answers are rich text; the tagline, FAQ questions and highlight
// titles and texts are plain. A highlight keeps its English `icon` — it is a
// name from a closed list, not words (ADR-114).
import type { Prisma } from "@repo/db";

import { hashToolSource, loadToolSource, type ToolSource } from "./tool-source.ts";
import { defineTranslatable, type Segment } from "./translation-engine.ts";
import { TRANSLATION_TABLES } from "./translation-queue.ts";

const MAX = {
  title: 160,
  tagline: 220,
  seoTitle: 70,
  seoDescription: 180,
  question: 300,
  highlightTitle: 80,
  highlightText: 300,
} as const;

const orNull = (original: string | null, value: string | undefined) =>
  original === null || original.trim() === "" ? null : (value ?? null);

function toolSegments(s: ToolSource): Segment[] {
  return [
    { key: "title", kind: "text", text: s.title, max: MAX.title },
    { key: "tagline", kind: "text", text: s.tagline ?? "", max: MAX.tagline },
    { key: "intro", kind: "html", text: s.intro ?? "" },
    { key: "body", kind: "html", text: s.body ?? "" },
    { key: "seoTitle", kind: "text", text: s.seoTitle ?? "", max: MAX.seoTitle },
    { key: "seoDescription", kind: "text", text: s.seoDescription ?? "", max: MAX.seoDescription },
    ...s.faq.flatMap((f, i): Segment[] => [
      { key: `faq.${i}.q`, kind: "text", text: f.question, max: MAX.question },
      { key: `faq.${i}.a`, kind: "html", text: f.answer },
    ]),
    ...s.highlights.flatMap((h, i): Segment[] => [
      { key: `hl.${i}.title`, kind: "text", text: h.title, max: MAX.highlightTitle },
      { key: `hl.${i}.text`, kind: "text", text: h.text, max: MAX.highlightText },
    ]),
  ];
}

export const toolTranslatable = defineTranslatable<ToolSource>({
  entityType: "tool",
  ...TRANSLATION_TABLES.tool,
  parentTable: "tools",
  titleColumn: "title",
  updatedAtColumn: "updatedAt",
  loadSource: loadToolSource,
  hash: hashToolSource,
  segments: toolSegments,
  async write(tx, { entityId, locale, source, translated: t, status, hash }) {
    const data = {
      title: t.title ?? source.title,
      tagline: orNull(source.tagline, t.tagline),
      intro: orNull(source.intro, t.intro),
      body: orNull(source.body, t.body),
      faq: source.faq.map((_, i) => ({
        question: t[`faq.${i}.q`] ?? "",
        answer: t[`faq.${i}.a`] ?? "",
      })) as Prisma.InputJsonValue,
      highlights: source.highlights.map((h, i) => ({
        icon: h.icon,
        title: t[`hl.${i}.title`] ?? "",
        text: t[`hl.${i}.text`] ?? "",
      })) as Prisma.InputJsonValue,
      seoTitle: orNull(source.seoTitle, t.seoTitle),
      seoDescription: orNull(source.seoDescription, t.seoDescription),
      translationStatus: status,
      sourceHash: hash,
    };
    await tx.toolTranslation.upsert({
      where: { toolId_locale: { toolId: entityId, locale } },
      update: data,
      create: { toolId: entityId, locale, ...data },
    });
  },
});
