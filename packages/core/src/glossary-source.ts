// The translatable SOURCE of a glossary term and a glossary topic, and its
// hash (ADR-161, Phase 5) — `article-source.ts` for the glossary.
//
// Shared by a person's save (English and other locales) and the translation
// job, so all three agree on what "current" means.
//
// The term's hash is WIDER than ADR-069 §2's four prose bodies: it covers the
// term itself, the FAQ and the SEO text too, because the job translates all
// of them — a renamed term or an edited FAQ answer that did not mark a
// translation stale would leave the machine copy wrong until some other edit.
// Existing rows mismatch once, as Phase 3's articles did. A topic had no hash
// at all.
import { computeSourceHash } from "@repo/i18n";
import type { Prisma } from "@repo/db";

import { faqPairsOf, type FaqPair } from "./learn-source.ts";

export interface GlossaryTermSource {
  slug: string;
  term: string;
  simpleExplanation: string;
  detailedExplanation: string | null;
  advancedExplanation: string | null;
  exampleScenario: string | null;
  faq: FaqPair[];
  seoTitle: string | null;
  seoDescription: string | null;
}

export function hashGlossaryTermSource(s: GlossaryTermSource): string {
  return computeSourceHash(
    JSON.stringify([
      s.term,
      s.simpleExplanation,
      s.detailedExplanation ?? "",
      s.advancedExplanation ?? "",
      s.exampleScenario ?? "",
      s.faq.map((f) => [f.question, f.answer]),
      s.seoTitle ?? "",
      s.seoDescription ?? "",
    ]),
  );
}

export async function loadGlossaryTermSource(
  client: Pick<Prisma.TransactionClient, "glossaryTermTranslation">,
  termId: string,
  defaultLocale: string,
): Promise<GlossaryTermSource | null> {
  const row = await client.glossaryTermTranslation.findUnique({
    where: { termId_locale: { termId, locale: defaultLocale } },
    select: {
      slug: true,
      term: true,
      simpleExplanation: true,
      detailedExplanation: true,
      advancedExplanation: true,
      exampleScenario: true,
      faq: true,
      seoTitle: true,
      seoDescription: true,
      glossaryTerm: { select: { deletedAt: true } },
    },
  });
  if (!row || row.glossaryTerm.deletedAt) return null;
  return {
    slug: row.slug,
    term: row.term,
    simpleExplanation: row.simpleExplanation,
    detailedExplanation: row.detailedExplanation,
    advancedExplanation: row.advancedExplanation,
    exampleScenario: row.exampleScenario,
    faq: faqPairsOf(row.faq),
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
  };
}

export interface GlossaryTopicSource {
  slug: string;
  name: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
}

export function hashGlossaryTopicSource(s: GlossaryTopicSource): string {
  return computeSourceHash(
    JSON.stringify([
      s.name,
      s.description ?? "",
      s.seoTitle ?? "",
      s.seoDescription ?? "",
      s.seoKeywords ?? "",
    ]),
  );
}

export async function loadGlossaryTopicSource(
  client: Pick<Prisma.TransactionClient, "glossaryTopicTranslation">,
  topicId: string,
  defaultLocale: string,
): Promise<GlossaryTopicSource | null> {
  const row = await client.glossaryTopicTranslation.findUnique({
    where: { topicId_locale: { topicId, locale: defaultLocale } },
    select: {
      slug: true,
      name: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      seoKeywords: true,
    },
  });
  return row;
}
