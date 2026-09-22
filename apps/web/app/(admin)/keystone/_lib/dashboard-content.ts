// The dashboard's content-type registries (changes-26, ADR-085).
//
// One file rather than three, because these four maps must be extended
// TOGETHER: a seventh content type added to `@repo/core`'s `CONTENT_MODELS`
// needs an icon, a destination, a label key and a place in the pipeline, and
// `admin-dashboard-registries.test.ts` fails naming whichever half is
// missing. Plain `.ts` with no JSX so that guard can import it directly
// instead of reading the page as source.
import {
  BookOpen,
  CircleHelp,
  FileText,
  GraduationCap,
  SpellCheck,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { DASHBOARD_CONTENT_STATUSES, DashboardContentEntity } from "@repo/core";

/** Matches the admin sidebar's own glyphs, so a card and its nav row read as the same thing. */
export const ENTITY_ICONS: Record<DashboardContentEntity, LucideIcon> = {
  courses: GraduationCap,
  lessons: BookOpen,
  quizzes: CircleHelp,
  glossary: SpellCheck,
  videos: Video,
  articles: FileText,
};

/**
 * Where a content stat card sends you. Quizzes and videos sit under
 * `/keystone/learn` beside the lessons whose permission keys they share
 * (ADR-058 #6, ADR-068).
 */
export const ENTITY_HREFS: Record<DashboardContentEntity, string> = {
  courses: "/keystone/learn/courses",
  lessons: "/keystone/learn/lessons",
  quizzes: "/keystone/learn/quizzes",
  glossary: "/keystone/glossary",
  videos: "/keystone/learn/videos",
  articles: "/keystone/articles",
};

/** ADR-044 #5: the entity key is an identifier and never reaches the screen. */
export const ENTITY_LABEL_KEYS: Record<DashboardContentEntity, string> = {
  courses: "dashboardEntityCourses",
  lessons: "dashboardEntityLessons",
  quizzes: "dashboardEntityQuizzes",
  glossary: "dashboardEntityGlossary",
  videos: "dashboardEntityVideos",
  articles: "dashboardEntityArticles",
};

/**
 * The seven-state machine folded into five readable bars.
 *
 * `CONTENT_STATUS_TONE` (status-badge.tsx) already decided that IN_REVIEW,
 * SEO_REVIEW and APPROVED are one tone — they are all "somebody is looking at
 * it" — so this is that grouping, and a bar here cannot tell an editor a
 * different story from a badge on the courses table. SCHEDULED is pulled out
 * of the badge map's shared `info` because on a bar it has to separate from
 * the review family, and it is the one in-flight state with a date attached.
 *
 * Colour belongs to the BUCKET, never to a segment's position. The cycling
 * `STATUS_COLORS[i % n]` this replaced repainted every status whenever a
 * zero-count one dropped out — colour following rank, not entity.
 */
export const PIPELINE_BUCKETS = [
  { key: "draft", statuses: ["DRAFT"], color: "var(--color-muted-foreground)" },
  {
    key: "review",
    statuses: ["IN_REVIEW", "SEO_REVIEW", "APPROVED"],
    color: "var(--color-info)",
  },
  { key: "scheduled", statuses: ["SCHEDULED"], color: "var(--color-primary)" },
  { key: "published", statuses: ["PUBLISHED"], color: "var(--color-success)" },
  { key: "archived", statuses: ["ARCHIVED"], color: "var(--color-warning)" },
] as const satisfies readonly {
  key: string;
  statuses: readonly (typeof DASHBOARD_CONTENT_STATUSES)[number][];
  color: string;
}[];

export type PipelineBucketKey = (typeof PIPELINE_BUCKETS)[number]["key"];

export const PIPELINE_LABEL_KEYS: Record<PipelineBucketKey, string> = {
  draft: "dashboardPipelineDraft",
  review: "dashboardPipelineReview",
  scheduled: "dashboardPipelineScheduled",
  published: "dashboardPipelinePublished",
  archived: "dashboardPipelineArchived",
};
