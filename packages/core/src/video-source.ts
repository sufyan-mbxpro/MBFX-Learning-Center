// The translatable SOURCE of a video topic and a video category, and its hash
// (ADR-161, Phase 5) — `article-source.ts` for videos.
//
// A topic's hash was title + summary + body, concatenated with no separator.
// It now covers everything the job translates — the SEO text and the link
// labels too — so existing rows mismatch once, as every other module's did.
// `VideoTopicVideo.title` is deliberately NOT here: ADR-068 §4 leaves a
// video's own title untranslated.
import { computeSourceHash } from "@repo/i18n";
import type { Prisma } from "@repo/db";

export interface VideoTopicSource {
  slug: string;
  title: string;
  summary: string | null;
  content: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /** Distinct English link labels, in order (ADR-161 #8). */
  linkLabels: string[];
}

export function hashVideoTopicSource(s: VideoTopicSource): string {
  return computeSourceHash(
    JSON.stringify([
      s.title,
      s.summary ?? "",
      s.content ?? "",
      s.seoTitle ?? "",
      s.seoDescription ?? "",
      s.linkLabels,
    ]),
  );
}

export async function loadVideoTopicSource(
  client: Pick<Prisma.TransactionClient, "videoTopicTranslation" | "videoTopicLink">,
  topicId: string,
  defaultLocale: string,
): Promise<VideoTopicSource | null> {
  const [row, links] = await Promise.all([
    client.videoTopicTranslation.findUnique({
      where: { topicId_locale: { topicId, locale: defaultLocale } },
      select: {
        slug: true,
        title: true,
        summary: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
        topic: { select: { deletedAt: true } },
      },
    }),
    client.videoTopicLink.findMany({
      where: { topicId },
      orderBy: { sortOrder: "asc" },
      select: { label: true },
    }),
  ]);
  if (!row || row.topic.deletedAt) return null;
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    linkLabels: [...new Set(links.map((l) => l.label.trim()).filter((label) => label !== ""))],
  };
}

export interface VideoCategorySource {
  slug: string;
  name: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function hashVideoCategorySource(s: VideoCategorySource): string {
  return computeSourceHash(
    JSON.stringify([s.name, s.description ?? "", s.seoTitle ?? "", s.seoDescription ?? ""]),
  );
}

export async function loadVideoCategorySource(
  client: Pick<Prisma.TransactionClient, "videoCategoryTranslation">,
  categoryId: string,
  defaultLocale: string,
): Promise<VideoCategorySource | null> {
  return client.videoCategoryTranslation.findUnique({
    where: { categoryId_locale: { categoryId, locale: defaultLocale } },
    select: { slug: true, name: true, description: true, seoTitle: true, seoDescription: true },
  });
}
