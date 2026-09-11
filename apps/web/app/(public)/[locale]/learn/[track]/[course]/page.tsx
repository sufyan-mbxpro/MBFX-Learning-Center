import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpen, Clock, ExternalLink, GraduationCap, Layers } from "lucide-react";
import {
  getCourseBySlug,
  getLearnIndex,
  getRedirect,
  coursePath,
  resolveRecommendations,
} from "@repo/core";
import { isLearnTrack, learnTrackPath, LEARN_TRACKS, type LearnTrackKey } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { routing } from "@repo/i18n/routing";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { ExternalBadge } from "@repo/ui/components/external-badge";
import { Reveal } from "@repo/ui/components/reveal";
import { RichText } from "@repo/ui/components/rich-text";
import { Section } from "@repo/ui/components/section";
import { courseCoverUrl, isGeneratedCover } from "../../_content/learn-media.ts";
import { difficultyLabels, difficultyTone } from "../../_lib/learn-labels.ts";
import { CourseSidebar, type SidebarCourse } from "../../_components/course-sidebar.tsx";
import { LearnBackdrop } from "../../_components/learn-art.tsx";
import { LearnBreadcrumb } from "../../_components/learn-breadcrumb.tsx";
import { CurriculumWithProgress } from "../../_components/curriculum-with-progress.tsx";
import { CourseCompletionBanner } from "../../_components/course-completion.tsx";
import {
  CourseProgressBar,
  CourseStartCta,
  ProgressSignInCard,
} from "../../_components/course-progress.tsx";
import { ProgressProvider } from "../../_components/progress-provider.tsx";
import { CourseJsonLd } from "../../_components/course-json-ld.tsx";

// Course detail (changes-11 PR 4.2 + its share of 4.4).
//
// The header follows the FOREX.com pattern the plan adopts: the decision the
// reader is making — level, length, how far in they are — sits ABOVE the
// curriculum, not beside it.
//
// Progress renders 0-of-N ON THE SERVER and the island swaps real state in on
// hydrate (ADR-056 #1 — a session read here would uncache the whole learning
// area). The bar, the CTA and every lesson marker already occupy their space,
// so the swap shifts nothing. `ProgressProvider` passes its children through,
// so everything below it is still server-rendered; only the four leaves that
// call `useProgress()` are client components.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn/[track]/[course]">): Promise<Metadata> {
  const { locale, course: courseSlug } = await params;
  setRequestLocale(locale);
  const [view, template] = await Promise.all([
    getCourseBySlug(locale, courseSlug),
    getSetting("seo.titleTemplate"),
  ]);
  if (!view) return {};

  const languages = Object.fromEntries(
    view.alternates.map((alt) => [
      alt.locale,
      coursePath(alt.locale, routing.defaultLocale, view.track, alt.slug),
    ]),
  );

  return {
    title: (template ?? "%s").replace("%s", view.seoTitle ?? view.title),
    description: view.seoDescription ?? view.summary ?? undefined,
    alternates: {
      canonical: coursePath(locale, routing.defaultLocale, view.track, view.slug),
      languages,
    },
    openGraph: {
      type: "website",
      title: view.seoTitle ?? view.title,
      description: view.seoDescription ?? view.summary ?? undefined,
      images: view.coverUrl ? [{ url: view.coverUrl }] : undefined,
    },
  };
}

export default async function CoursePage({
  params,
}: PageProps<"/[locale]/learn/[track]/[course]">) {
  const { locale, track, course: courseSlug } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) notFound();

  if (!(await isFeatureVisible("courses", null))) notFound();

  const view = await getCourseBySlug(locale, courseSlug);
  if (!view) {
    // Old address? `saveCourse` wrote a 301 row when the slug OR the track
    // changed (ADR-065 §1), keyed on the full path — so the lookup uses the
    // track from the URL, not the one the course has now.
    const target = await getRedirect(coursePath(locale, routing.defaultLocale, track, courseSlug));
    if (target) permanentRedirect(target);
    notFound();
  }

  // The course exists, but under a DIFFERENT school. Not a redirect and not a
  // second URL for it: `/learn/crypto/price-action` is a wrong address, and
  // answering 200 there would put the same course in the index twice
  // (ADR-065 §1). A course that genuinely moved has a redirect row, which the
  // branch above already handled.
  if (view.track !== track) notFound();

  // `getLearnIndex` is the same cached, `content`-tagged loader the shelf
  // uses, so the right rail costs this page nothing beyond a cache hit that
  // `/learn` has usually already warmed — and the rail can never disagree with
  // the shelf about what is published, because it IS the shelf's data.
  const [t, recommendations, groups] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    resolveRecommendations(locale, view.id, view.track, 3),
    getLearnIndex(locale),
  ]);

  const difficulties = difficultyLabels(t);

  // The header's picture: the course's own cover, else its track's generated
  // panel (`_content/learn-media.ts`). Null only when a track has no panel, in
  // which case the header simply runs full width.
  const coverUrl = courseCoverUrl(view.coverUrl, view.track);

  const sidebarTracks = groups.map((group) => ({
    track: group.track,
    title: t(LEARN_TRACKS[group.track as LearnTrackKey].titleKey),
  }));

  const sidebarCourses: SidebarCourse[] = groups.flatMap((group) =>
    group.courses
      // The course being read is never on its own rail.
      .filter((course) => course.id !== view.id)
      .map((course) => {
        const cover = courseCoverUrl(course.coverUrl, course.track);
        return {
          id: course.id,
          track: course.track,
          href: `${learnTrackPath(course.track as LearnTrackKey)}/${course.slug}`,
          title: course.title,
          difficultyLabel: difficulties[course.difficulty] ?? course.difficulty,
          difficultyTone: difficultyTone(course.difficulty),
          lessonsLabel: t("card.lessons", { count: course.lessonCount }),
          durationLabel:
            course.estimatedHours === null
              ? null
              : t("card.hours", { count: course.estimatedHours }),
          coverUrl: cover,
          coverIsGenerated: cover !== null && isGeneratedCover(cover),
        };
      }),
  );
  const lessons = view.sections.flatMap((section) => section.lessons);
  const firstLesson = lessons[0];
  const isExternal = view.externalUrl !== null;

  const sections = view.sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    countLabel: t("course.sectionLessons", { count: section.lessons.length }),
    lessons: section.lessons.map((lesson) => ({
      id: lesson.id,
      href: `${learnTrackPath(track)}/${view.slug}/${lesson.slug}`,
      title: lesson.title,
      summary: lesson.summary,
      durationLabel:
        lesson.estimatedMinutes === null
          ? null
          : t("card.minuteRead", { count: lesson.estimatedMinutes }),
      isExternal: lesson.hasExternal,
      isOptional: !lesson.isRequired,
    })),
  }));

  // The id → href map the CTA needs to turn `lastLessonId` into a link. Built
  // here because the API deliberately returns no slugs.
  const lessonHrefs = Object.fromEntries(
    sections.flatMap((section) => section.lessons.map((lesson) => [lesson.id, lesson.href])),
  );

  // Below md the accordion opens only the section holding the next lesson
  // (§9.3). With no progress on the server that is always the FIRST section —
  // the island reopens the right one once it knows better.
  const defaultOpenSectionIds = sections[0] ? [sections[0].id] : [];

  return (
    <ProgressProvider courseId={view.id}>
      <CourseJsonLd
        name={view.title}
        description={view.seoDescription ?? view.summary}
        url={coursePath(locale, routing.defaultLocale, view.track, view.slug)}
        sections={view.sections.map((section) => ({
          name: section.title,
          lessonCount: section.lessons.length,
        }))}
      />

      {/* `relative isolate overflow-hidden` is what the backdrop and the motif
          anchor to and are clipped by; Section provides none of the three.
          This band stays `tone="muted"` — every token below it
          (`--muted-foreground`, the tonal badges) is derived against
          `--background`, so filling it with the brand would put unchecked ink
          on an unchecked surface (ADR-018 #5). Artwork under a scrim is how
          the band gets depth without moving the contrast. */}
      <Section spacing="sm" tone="muted" className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14] select-none"
        >
          <LearnBackdrop slot="courseBanner" />
        </div>
        <AmbientMotif variant="learn" intensity={0.5} />

        <Container className="flex flex-col gap-5">
          <LearnBreadcrumb
            learnLabel={t(LEARN_TRACKS[track].titleKey)}
            current={view.title}
            learnHref={learnTrackPath(track)}
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <div className="flex min-w-0 flex-col gap-4">
              {coverUrl && (
                <Reveal variant="up" className="group">
                  {/* 16:6 — a header band, not a card cover. Wide enough to
                      carry the track's artwork, short enough that the title
                      below it is still above the fold on a phone. */}
                  <div className="relative aspect-[16/6] w-full overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/10">
                    <Image
                      src={coverUrl}
                      alt=""
                      fill
                      priority
                      unoptimized={isGeneratedCover(coverUrl)}
                      sizes="(min-width: 1024px) 64vw, 100vw"
                      className="media-zoom object-cover"
                    />
                  </div>
                </Reveal>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={difficultyTone(view.difficulty)} className="uppercase">
                  {difficulties[view.difficulty] ?? view.difficulty}
                </Badge>
                <Badge variant="outline">
                  <Layers aria-hidden />
                  {t("card.lessons", { count: view.lessonCount })}
                </Badge>
                {view.estimatedHours !== null && (
                  <Badge variant="outline">
                    <Clock aria-hidden />
                    {t("card.hours", { count: view.estimatedHours })}
                  </Badge>
                )}
                {isExternal && (
                  <ExternalBadge
                    label={t("external.badge")}
                    newTabLabel={t("external.opensInNewTab")}
                  />
                )}
              </div>
              <h1 className="text-display-sm font-semibold tracking-tight text-balance">
                {view.title}
              </h1>
              {view.summary && (
                <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
                  {view.summary}
                </p>
              )}
            </div>

            {/* Sticky from lg: the reader scrolling a long curriculum keeps the
                progress bar and the resume button in reach. */}
            <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-24">
              <CourseProgressBar lessonsTotal={view.lessonCount} />

              {isExternal && view.externalUrl ? (
                // D16: linked, never framed; stored, never fetched. The course
                // is still a real indexable page of ours — this is the outbound
                // CTA on it, not a redirect (plan §11).
                <Button
                  size="lg"
                  className="w-full"
                  render={<a href={view.externalUrl} target="_blank" rel="noopener noreferrer" />}
                >
                  <ExternalLink data-icon="inline-start" aria-hidden />
                  {t("course.openExternal")}
                  <span className="sr-only"> — {t("external.opensInNewTab")}</span>
                </Button>
              ) : (
                <CourseStartCta
                  firstLessonHref={
                    firstLesson ? `${learnTrackPath(track)}/${view.slug}/${firstLesson.slug}` : null
                  }
                  lessonHrefs={lessonHrefs}
                />
              )}

              <ProgressSignInCard />

              <dl className="flex flex-col gap-1.5 border-t pt-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <GraduationCap aria-hidden className="size-4" />
                    {t("course.difficultyLabel")}
                  </dt>
                  <dd>{difficulties[view.difficulty] ?? view.difficulty}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Layers aria-hidden className="size-4" />
                    {t("course.lessonsLabel")}
                  </dt>
                  <dd className="tabular-nums">{view.lessonCount}</dd>
                </div>
                {view.estimatedHours !== null && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock aria-hidden className="size-4" />
                      {t("course.durationLabel")}
                    </dt>
                    <dd>{t("card.hours", { count: view.estimatedHours })}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </Container>
      </Section>

      <Section spacing="md">
        <Container className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Phase 7: the completion state. Above the curriculum, because a
                learner who has finished is looking for what is next, not for
                the list they already worked through. */}
            <CourseCompletionBanner
              recommendations={recommendations.map((rec) => ({
                id: rec.id,
                href: `${learnTrackPath(rec.track as LearnTrackKey)}/${rec.slug}`,
                title: rec.title,
                meta: `${difficulties[rec.difficulty] ?? rec.difficulty} · ${t("card.lessons", { count: rec.lessonCount })}`,
              }))}
            />

            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">{t("course.curriculum")}</h2>
              <p className="text-sm text-muted-foreground">{t("course.curriculumIntro")}</p>
            </div>

            {sections.length === 0 ? (
              <Empty>
                <EmptyTitle>{t("course.emptyCurriculumTitle")}</EmptyTitle>
                <EmptyDescription>{t("course.emptyCurriculumBody")}</EmptyDescription>
              </Empty>
            ) : (
              <CurriculumWithProgress
                sections={sections}
                defaultOpenSectionIds={defaultOpenSectionIds}
              />
            )}
          </div>

          <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
            {view.description && (
              <div className="card-hover flex flex-col gap-2 rounded-2xl border bg-card p-5">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <BookOpen aria-hidden className="size-4 text-primary-interactive" />
                  {t("course.whatYouLearn")}
                </h2>
                <RichText html={view.description} className="text-sm" />
              </div>
            )}

            {recommendations.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-base font-semibold">{t("course.recommendations")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("course.recommendationsIntro")}
                  </p>
                </div>
                <ul className="flex flex-col gap-2">
                  {recommendations.map((rec) => (
                    <li key={rec.id}>
                      <Link
                        href={`${learnTrackPath(rec.track as LearnTrackKey)}/${rec.slug}`}
                        className="group card-hover flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors duration-(--duration-base) hover:border-primary/25 hover:bg-muted/40"
                      >
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {(() => {
                            // Same cover rule as everywhere else: the course's
                            // own artwork, else its track's panel.
                            const cover = courseCoverUrl(rec.coverUrl, rec.track);
                            return (
                              cover && (
                                <Image
                                  src={cover}
                                  alt=""
                                  fill
                                  unoptimized={isGeneratedCover(cover)}
                                  sizes="48px"
                                  className="media-zoom object-cover"
                                />
                              )
                            );
                          })()}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">{rec.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {difficulties[rec.difficulty] ?? rec.difficulty} ·{" "}
                            {t("card.lessons", { count: rec.lessonCount })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Everything else published, filterable by track (design pass
                2026-09-09). Distinct from the block above it: those three are
                the editor's answer to "what next", these are the catalogue.
                Renders nothing when this is the only published course. */}
            <CourseSidebar
              tracks={sidebarTracks}
              courses={sidebarCourses}
              currentTrack={view.track}
            />
          </aside>
        </Container>
      </Section>
    </ProgressProvider>
  );
}
