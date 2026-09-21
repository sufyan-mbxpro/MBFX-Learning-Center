// Site-wide public search (changes-32, ADR-108).
//
// The public header had a magnifying glass that linked to `/news` and a
// comment saying, honestly, that no site-wide search backend existed. This is
// that backend.
//
// **It searches the same rows the pages serve, through the same rules.** Every
// query composes the module's own published-visibility helper —
// `publicArticleWhere`, `publicGlossaryTermWhere`, `publicCourseWhere`,
// `publicQuizWhere` and `publicVideoWhere` — rather than
// a `status: PUBLISHED` written fresh here. A search that used its own
// definition of "public" would be a way to discover drafts by typing, and it
// would drift the next time a schedule rule changed (ADR-071 changed five of
// them at once).
//
// **Rich-text fields are shown, never matched.** A `LIKE` over stored HTML
// misses any phrase that markup splits and matches every tag name someone
// types, so the query hits plain columns (`term`, `title`, `excerpt`,
// `summary`, `description`) and the rich ones only ever supply an excerpt,
// stripped on the way out.
//
// **It matches WORDS, not the typed phrase (changes-36).** The query is split
// into terms (`searchTerms`), a row qualifies if a field contains any of them,
// and rows are ranked in memory (`scoreMatch`) — whole phrase, then title,
// then summary. Matching the phrase as one substring made "forex trading"
// return nothing on a site full of both words.
//
// **It is a LIKE search, and that is a deliberate ceiling.** MariaDB full-text
// indexing over six translation tables is a schema change, a relevance model
// and a tokenisation decision per locale; what the owner asked for is a
// keyboard-reachable way to find a page. A prefix/substring match over titles
// and short summaries answers that at a size where the whole corpus is
// thousands of rows. When it stops being enough the seam is this function:
// every caller takes `SearchHit[]` and knows nothing about how it was found.
//
// **Feature flags are NOT read here.** They gate at the page level everywhere
// else in the repo (`Explore`'s cards, `LatestAnalysis`, the header's menu
// rows), and this module has no subject to evaluate an AUTHENTICATED flag
// against. The route handler that calls it does the gating.
import { db } from "@repo/db";

import { publicArticleWhere } from "./public-articles.ts";
import { publicCourseWhere, publicLessonWhere } from "./public-courses.ts";
import { publicGlossaryTermWhere } from "./public-content.ts";
import { publicQuizWhere } from "./quiz-links.ts";
import { publicVideoWhere } from "./videos.ts";

/**
 * Which part of the site a hit belongs to. The CLIENT turns this into a group
 * heading through its own catalog, so no user-facing string crosses this
 * boundary (code-style.md #2) — the same split `SearchHit.href` makes by
 * returning a locale-less path and letting `@repo/i18n`'s router prefix it.
 */
export type SearchHitKind =
  "article" | "glossary" | "course" | "lesson" | "quiz" | "video" | "tool";

export interface SearchHit {
  kind: SearchHitKind;
  /** Unique within a response — `kind:id`, so React keys cannot collide. */
  id: string;
  title: string;
  /** One short line of context, already plain text. Null when there is none. */
  excerpt: string | null;
  /** Locale-less path. The caller prefixes it; see the note above. */
  href: string;
}

export interface PublicSearchResult {
  hits: SearchHit[];
  /** True when a section was cut off by `limit`, so the UI can say so. */
  truncated: boolean;
}

/** Per SECTION, not per response: eight sections × 5 is a readable palette. */
const PER_SECTION = 5;

/** Below this a query matches almost everything and costs a full scan. */
export const MIN_QUERY_LENGTH = 2;

/** Above this the input is not a search, it is a paste. */
export const MAX_QUERY_LENGTH = 100;

/**
 * Strip the LIKE wildcards so a query of `%` does not match every row, and
 * the escape character so `\` cannot smuggle one back in. Prisma parameterises
 * the value — this is not an injection defence — but `%` inside a `contains`
 * IS a wildcard to MariaDB, and one typed character should not turn a search
 * into a table dump.
 */
function sanitizeQuery(raw: string): string {
  return raw
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .replaceAll(/[%_\\]/g, " ")
    .trim();
}

/** Words shorter than this are dropped from a multi-word query. */
const MIN_TERM_LENGTH = 3;

/** A query is a phrase, not a program: past this many words the rest are noise. */
const MAX_TERMS = 6;

/**
 * Rows fetched per section before ranking. Ranking happens in memory, so this
 * is the ceiling on how far down the database's own order a best match can
 * sit and still be found — generous against a corpus of thousands of rows,
 * and bounded so a one-word query cannot pull a whole table.
 */
const CANDIDATES_PER_SECTION = 40;

/**
 * The words a query is matched by (changes-36).
 *
 * The query used to be matched as ONE substring, so "forex trading" found
 * nothing although "forex" and "trading" each found several pages, and "what
 * is a pip" found nothing although "pip" is a glossary term. A reader types a
 * phrase; the rows hold the words in some other order, or only some of them.
 *
 * Split on whitespace only — "EUR/USD" is one thing to look for, not two.
 * Short words ("is", "a", "to") are dropped once the query has a longer one,
 * because they match nearly every row and would rank a page for containing
 * "is". This is a length rule rather than a stopword list on purpose: a list
 * is per-language, and a length rule is wrong in the same harmless way in
 * every language. A query made ONLY of short words ("FX") keeps them.
 */
export function searchTerms(query: string): string[] {
  const words = [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
  const long = words.filter((word) => word.length >= MIN_TERM_LENGTH);
  const kept = long.length > 0 ? long : words.filter((word) => word.length >= MIN_QUERY_LENGTH);
  return kept.slice(0, MAX_TERMS);
}

/**
 * How well a row answers the query. Higher is better; ties keep the
 * database's own order (the sort is stable). The whole phrase outranks any
 * word; a word in the title outranks one in the summary; a title that IS the
 * word ("Pip" for "what is a pip") outranks a title that merely contains it.
 */
export function scoreMatch(
  query: string,
  terms: readonly string[],
  title: string,
  secondary: string | null | undefined,
): number {
  const phrase = query.toLowerCase();
  const head = title.toLowerCase();
  const rest = (secondary ?? "").toLowerCase();
  let score = 0;
  if (head === phrase) score += 200;
  else if (head.includes(phrase)) score += 100;
  else if (rest.includes(phrase)) score += 40;
  for (const term of terms) {
    if (head === term) score += 30;
    else if (head.startsWith(term)) score += 15;
    else if (head.includes(term)) score += 10;
    else if (rest.includes(term)) score += 3;
  }
  return score;
}

/** Any field containing any term — ranking, not the filter, decides the order. */
function anyTerm(terms: readonly string[], fields: readonly string[]) {
  return terms.flatMap((term) => fields.map((field) => ({ [field]: { contains: term } })));
}

/** Rank, then drop the rows that matched nothing a reader would recognise. */
function rank<T>(
  rows: T[],
  query: string,
  terms: readonly string[],
  fields: (row: T) => [string, string | null | undefined],
): T[] {
  return rows
    .map((row) => ({ row, score: scoreMatch(query, terms, ...fields(row)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.row);
}

/** HTML out, one line in. Summaries are rich text on several of these tables. */
function toPlainExcerpt(value: string | null | undefined, max = 140): string | null {
  if (!value) return null;
  const text = value
    .replaceAll(/<[^>]*>/g, " ")
    .replaceAll(/&(?:nbsp|amp|lt|gt|quot|#39);/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
  if (text === "") return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Every query filters on ONE locale, deliberately NOT the fallback chain
// (ADR-007): a hit whose title is in a language the reader did not ask for is
// a worse answer than no hit, and every one of these pages resolves its own
// fallback when it renders. Search finds what this locale can show.

export interface PublicSearchOptions {
  /** Default `PER_SECTION`. Clamped so a caller cannot ask for the corpus. */
  perSection?: number;
  /** Kinds to search. Default: all. The route narrows this by feature flag. */
  kinds?: readonly SearchHitKind[];
  /** Static pages the caller wants matched by title — tools, mostly. */
  staticPages?: readonly { id: string; title: string; excerpt: string | null; href: string }[];
}

export async function searchPublicContent(
  locale: string,
  rawQuery: string,
  options: PublicSearchOptions = {},
): Promise<PublicSearchResult> {
  const query = sanitizeQuery(rawQuery);
  if (query.length < MIN_QUERY_LENGTH) return { hits: [], truncated: false };
  const terms = searchTerms(query);
  if (terms.length === 0) return { hits: [], truncated: false };

  const take = Math.min(Math.max(options.perSection ?? PER_SECTION, 1), 20);
  const wanted = new Set<SearchHitKind>(
    options.kinds ?? ["article", "glossary", "course", "lesson", "quiz", "video", "tool"],
  );
  const now = new Date();
  // More rows than are shown, because the order is decided after the fetch;
  // `cut` still observes "there is more" rather than guessing it.
  const probe = Math.max(CANDIDATES_PER_SECTION, take + 1);

  const [articles, glossaryTerms, courses, lessons, quizzes, videos] = await Promise.all([
    wanted.has("article")
      ? db.articleTranslation.findMany({
          where: {
            locale,
            article: publicArticleWhere(now),
            OR: anyTerm(terms, ["title", "excerpt"]),
          },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            article: { select: { kind: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: probe,
        })
      : [],
    wanted.has("glossary")
      ? db.glossaryTermTranslation.findMany({
          where: {
            locale,
            glossaryTerm: publicGlossaryTermWhere(now),
            // The TERM only. `simpleExplanation` is rich text (ADR-069), and
            // a LIKE over stored markup is wrong in both directions: it misses
            // "bid and ask" when the source is "<em>bid</em> and ask", and it
            // MATCHES a search for "strong" against every term that happens to
            // embolden a word. The field is still what the excerpt is built
            // from — stripped, below — because showing it is safe and
            // searching it is not.
            OR: anyTerm(terms, ["term"]),
          },
          select: { id: true, term: true, slug: true, simpleExplanation: true },
          orderBy: { term: "asc" },
          take: probe,
        })
      : [],
    wanted.has("course")
      ? db.courseTranslation.findMany({
          where: {
            locale,
            course: publicCourseWhere(now),
            OR: anyTerm(terms, ["title", "summary"]),
          },
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
            course: { select: { track: true } },
          },
          orderBy: { title: "asc" },
          take: probe,
        })
      : [],
    wanted.has("lesson")
      ? db.lessonTranslation.findMany({
          where: {
            locale,
            lesson: {
              ...publicLessonWhere(now),
              // A lesson is only reachable through a visible course and a
              // visible section — the rule `Course.lessonCount` counts by
              // (ADR-081 #2), so search cannot offer a link the curriculum
              // does not.
              section: { isPublished: true, course: publicCourseWhere(now) },
            },
            OR: anyTerm(terms, ["title", "summary"]),
          },
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
            lesson: {
              select: {
                section: {
                  select: {
                    course: {
                      select: {
                        track: true,
                        translations: { where: { locale }, select: { slug: true }, take: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { title: "asc" },
          take: probe,
        })
      : [],
    wanted.has("quiz")
      ? db.quizTranslation.findMany({
          where: {
            locale,
            quiz: publicQuizWhere(now),
            OR: anyTerm(terms, ["title", "description"]),
          },
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            quiz: { select: { track: true } },
          },
          orderBy: { title: "asc" },
          take: probe,
        })
      : [],
    wanted.has("video")
      ? db.videoTopicTranslation.findMany({
          where: {
            locale,
            // The module's own rule, not a copy of it (ADR-139 #2 found the copy
            // missing `isActive`, which is how a hidden topic stays searchable).
            topic: publicVideoWhere(now),
            OR: anyTerm(terms, ["title", "summary"]),
          },
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
            topic: { select: { track: true } },
          },
          orderBy: { title: "asc" },
          take: probe,
        })
      : [],
  ]);

  const staticHits = wanted.has("tool")
    ? rank([...(options.staticPages ?? [])], query, terms, (page) => [page.title, page.excerpt])
    : [];

  let truncated = false;
  function cut<T>(rows: T[]): T[] {
    if (rows.length > take) truncated = true;
    return rows.slice(0, take);
  }

  // Built before the list rather than inline: a lesson whose course has no
  // translation in THIS locale has no path in it either, so it is DROPPED
  // rather than linked through a fallback slug that would 404 under the locale
  // the reader is in.
  const lessonHits: SearchHit[] = [];
  for (const row of cut(rank(lessons, query, terms, (r) => [r.title, r.summary]))) {
    const course = row.lesson.section?.course;
    const courseSlug = course?.translations[0]?.slug;
    if (!course || !courseSlug) continue;
    lessonHits.push({
      kind: "lesson",
      id: `lesson:${row.id}`,
      title: row.title,
      excerpt: toPlainExcerpt(row.summary),
      href: `/learn/${course.track}/${courseSlug}/${row.slug}`,
    });
  }

  const hits: SearchHit[] = [
    ...cut(rank(articles, query, terms, (r) => [r.title, r.excerpt])).map((row) => ({
      kind: "article" as const,
      id: `article:${row.id}`,
      title: row.title,
      excerpt: toPlainExcerpt(row.excerpt),
      // ADR-015's two surfaces: NEWS lives at /news, the other two at
      // /analysis. Getting this wrong 404s a hit that exists.
      href: `${row.article.kind === "NEWS" ? "/news" : "/analysis"}/${row.slug}`,
    })),
    ...cut(rank(glossaryTerms, query, terms, (r) => [r.term, null])).map((row) => ({
      kind: "glossary" as const,
      id: `glossary:${row.id}`,
      title: row.term,
      excerpt: toPlainExcerpt(row.simpleExplanation),
      href: `/glossary/${row.slug}`,
    })),
    ...cut(rank(courses, query, terms, (r) => [r.title, r.summary])).map((row) => ({
      kind: "course" as const,
      id: `course:${row.id}`,
      title: row.title,
      excerpt: toPlainExcerpt(row.summary),
      href: `/learn/${row.course.track}/${row.slug}`,
    })),
    ...lessonHits,
    ...cut(rank(quizzes, query, terms, (r) => [r.title, r.description])).map((row) => ({
      kind: "quiz" as const,
      id: `quiz:${row.id}`,
      title: row.title,
      excerpt: toPlainExcerpt(row.description),
      href: `/learn/${row.quiz.track}/quizzes/${row.slug}`,
    })),
    ...cut(rank(videos, query, terms, (r) => [r.title, r.summary])).map((row) => ({
      kind: "video" as const,
      id: `video:${row.id}`,
      title: row.title,
      excerpt: toPlainExcerpt(row.summary),
      href: `/learn/${row.topic.track}/videos/${row.slug}`,
    })),
    ...cut(staticHits).map((page) => ({
      kind: "tool" as const,
      id: `tool:${page.id}`,
      title: page.title,
      excerpt: page.excerpt,
      href: page.href,
    })),
  ];

  return { hits, truncated };
}
