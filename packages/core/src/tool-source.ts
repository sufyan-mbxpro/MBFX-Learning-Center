// The translatable SOURCE of a tool page, and its hash (ADR-161, Phase 5).
//
// The words only: `Tool.config` is per-tool configuration (ids, numbers,
// currency codes) with no per-locale copy, and its one free-text field —
// market-hours session names — has no translation home yet (Phase 5 config
// audit; see ADR-164). A highlight's `icon` is a value from a closed list and
// is never sent.
//
// The hash keeps `toolSourceMaterial`'s NUL-joined shape and adds the SEO text,
// which the job translates too. That changes every stored hash once, as it
// did for every other module.
import { computeSourceHash } from "@repo/i18n";
import type { Prisma } from "@repo/db";

export interface ToolFaqPair {
  question: string;
  answer: string;
}

export interface ToolHighlightSource {
  icon: string;
  title: string;
  text: string;
}

export interface ToolSource {
  title: string;
  tagline: string | null;
  intro: string | null;
  body: string | null;
  faq: ToolFaqPair[];
  highlights: ToolHighlightSource[];
  seoTitle: string | null;
  seoDescription: string | null;
}

function faqOf(value: Prisma.JsonValue | null | undefined): ToolFaqPair[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const entry = item as Record<string, unknown> | null;
    return entry && typeof entry.question === "string" && typeof entry.answer === "string"
      ? [{ question: entry.question, answer: entry.answer }]
      : [];
  });
}

function highlightsOf(value: Prisma.JsonValue | null | undefined): ToolHighlightSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const entry = item as Record<string, unknown> | null;
    return entry &&
      typeof entry.icon === "string" &&
      typeof entry.title === "string" &&
      typeof entry.text === "string"
      ? [{ icon: entry.icon, title: entry.title, text: entry.text }]
      : [];
  });
}

export function hashToolSource(s: ToolSource): string {
  return computeSourceHash(
    [
      s.title,
      s.tagline ?? "",
      s.intro ?? "",
      s.body ?? "",
      ...s.faq.flatMap((entry) => [entry.question, entry.answer]),
      ...s.highlights.flatMap((entry) => [entry.title, entry.text]),
      s.seoTitle ?? "",
      s.seoDescription ?? "",
    ].join("\u0000"),
  );
}

export async function loadToolSource(
  client: Pick<Prisma.TransactionClient, "toolTranslation">,
  toolId: string,
  defaultLocale: string,
): Promise<ToolSource | null> {
  const row = await client.toolTranslation.findUnique({
    where: { toolId_locale: { toolId, locale: defaultLocale } },
    select: {
      title: true,
      tagline: true,
      intro: true,
      body: true,
      faq: true,
      highlights: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
  if (!row) return null;
  return {
    title: row.title,
    tagline: row.tagline,
    intro: row.intro,
    body: row.body,
    faq: faqOf(row.faq),
    highlights: highlightsOf(row.highlights),
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
  };
}
