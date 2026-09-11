import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Download, ExternalLink, FileText, Target } from "lucide-react";
import { getCourseBySlug, getLessonBySlug, getRedirect, lessonPath } from "@repo/core";
import { isLearnTrack, learnTrackPath, LEARN_TRACKS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { routing } from "@repo/i18n/routing";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { formatBytes, parseVideoUrl } from "@repo/utils";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { ExternalBadge } from "@repo/ui/components/external-badge";
import { LessonNav } from "@repo/ui/components/lesson-nav";
import { RichText } from "@repo/ui/components/rich-text";
import { Section } from "@repo/ui/components/section";
import { LearnBreadcrumb } from "../../../_components/learn-breadcrumb.tsx";
import { LessonContentsSheet } from "../../../_components/lesson-contents-sheet.tsx";
import { CurriculumWithProgress } from "../../../_components/curriculum-with-progress.tsx";
import { ProgressSignInCard } from "../../../_components/course-progress.tsx";
import { LessonFeedback } from "../../../_components/lesson-feedback.tsx";
import { LessonProgressActions } from "../../../_components/lesson-progress-actions.tsx";
import { ProgressProvider } from "../../../_components/progress-provider.tsx";
import { practiceCtaFor } from "../../../_content/practice-cta.ts";
import { VideoFacade } from "../../../../_components/video-facade.tsx";

// Lesson page (changes-11 PR 4.3 + its share of 4.4).
//
// Two loads, deliberately: the LESSON (body, resources, siblings) and the
// COURSE (the curriculum for the sidebar). Plan §13 says "never load the whole
// course tree on a lesson page" — `getLessonBySlug` honours that by carrying
// only prev/next, and the sidebar tree comes from the separately-cached course
// loader, which the reader has usually already warmed by arriving from the
// course page.
//
// Every lesson marker renders "not started" on the server and the island swaps
// real state in on hydrate (ADR-056 #1). No session is read here — the visit
// itself is recorded by the provider's `touchLessonId`, which is one POST that
// also returns the view, so the page costs one progress request in total.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn/[track]/[course]/[lesson]">): Promise<Metadata> {
  const { locale, track, course: courseSlug, lesson: lessonSlug } = await params;
  setRequestLocale(locale);
  const [view, template] = await Promise.all([
    getLessonBySlug(locale, courseSlug, lessonSlug),
    getSetting("seo.titleTemplate"),
  ]);
  if (!view) return {};

  // The COURSE slug varies by locale too, so an hreflang pair needs both
  // halves. Pairing a localised lesson slug with the current course slug would
  // emit URLs that 404 in every non-default locale.
  const course = await getCourseBySlug(locale, courseSlug);
  const courseSlugByLocale = new Map(
    (course?.alternates ?? []).map((alt) => [alt.locale, alt.slug]),
  );

  const languages = Object.fromEntries(
    view.alternates.flatMap((alt) => {
      const localisedCourse = courseSlugByLocale.get(alt.locale);
      if (!localisedCourse) return [];
      return [
        [
          alt.locale,
          lessonPath(alt.locale, routing.defaultLocale, track, localisedCourse, alt.slug),
        ],
      ];
    }),
  );

  return {
    title: (template ?? "%s").replace("%s", view.seoTitle ?? view.title),
    description: view.seoDescription ?? view.summary ?? undefined,
    alternates: {
      canonical: lessonPath(
        locale,
        routing.defaultLocale,
        view.courseTrack,
        view.courseSlug,
        view.slug,
      ),
      languages,
    },
    openGraph: {
      type: "article",
      title: view.seoTitle ?? view.title,
      description: view.seoDescription ?? view.summary ?? undefined,
      modifiedTime: view.updatedAt.toISOString(),
      images: view.heroUrl ? [{ url: view.heroUrl }] : undefined,
    },
  };
}

export default async function LessonPage({
  params,
}: PageProps<"/[locale]/learn/[track]/[course]/[lesson]">) {
  const { locale, track, course: courseSlug, lesson: lessonSlug } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) notFound();

  if (!(await isFeatureVisible("courses", null))) notFound();

  const view = await getLessonBySlug(locale, courseSlug, lessonSlug);
  if (!view) {
    // Old address? `saveLesson` wrote a 301 when the lesson slug changed, and
    // `saveCourse` wrote one PER LESSON when the course slug or its TRACK did
    // (ADR-065 §1) — so the lookup uses the track from the URL.
    const target = await getRedirect(
      lessonPath(locale, routing.defaultLocale, track, courseSlug, lessonSlug),
    );
    if (target) permanentRedirect(target);
    notFound();
  }

  // Right lesson, wrong school: a wrong address, not a second one for it
  // (ADR-065 §1). A course that genuinely moved left a redirect row above.
  if (view.courseTrack !== track) notFound();

  const [t, course] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    getCourseBySlug(locale, view.courseSlug),
  ]);

  const video = view.videoUrl ? parseVideoUrl(view.videoUrl) : null;

  const sections = (course?.sections ?? []).map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    countLabel: t("course.sectionLessons", { count: section.lessons.length }),
    lessons: section.lessons.map((lesson) => ({
      id: lesson.id,
      href: `${learnTrackPath(track)}/${view.courseSlug}/${lesson.slug}`,
      title: lesson.title,
      durationLabel:
        lesson.estimatedMinutes === null
          ? null
          : t("card.minuteRead", { count: lesson.estimatedMinutes }),
      // The lesson being read is marked in-progress from first paint. It is
      // the one piece of "progress" the server can state without a session:
      // this reader is, definitionally, on this page.
      state: lesson.id === view.id ? ("in-progress" as const) : undefined,
      isExternal: lesson.hasExternal,
      isOptional: !lesson.isRequired,
    })),
  }));

  const openSectionIds = sections
    .filter((section) => section.lessons.some((lesson) => lesson.id === view.id))
    .map((section) => section.id);

  const coursePathname = `${learnTrackPath(track)}/${view.courseSlug}`;
  // §9.5: one STATIC, code-owned promo per track (ADR-042 — not an
  // admin-editable block).
  const practice = practiceCtaFor(course?.track ?? "");

  return (
    <ProgressProvider courseId={view.courseId} touchLessonId={view.id}>
      <Section spacing="md">
        {/* `pb-24` below md leaves room for the pinned LessonNav; from md the
          bar is in normal flow and the padding is not needed. */}
        <Container className="grid gap-8 pb-24 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:items-start md:pb-0">
          {/* Sidebar from md; a Sheet below it (§9.3). Both render the SAME
            CurriculumWithProgress — see lesson-contents-sheet.tsx. */}
          <aside className="hidden md:sticky md:top-24 md:flex md:flex-col md:gap-3">
            <p className="text-sm font-semibold">{t("lesson.contents")}</p>
            <div className="max-h-[60vh] overflow-y-auto">
              <CurriculumWithProgress sections={sections} defaultOpenSectionIds={openSectionIds} />
            </div>

            <ProgressSignInCard />

            <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold">{t(practice.titleKey)}</p>
              <p className="text-xs text-muted-foreground">{t(practice.descriptionKey)}</p>
              <div>
                <Button size="sm" variant="outline" render={<Link href={practice.href} />}>
                  {t(practice.actionKey)}
                </Button>
              </div>
            </div>
          </aside>

          <article className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-3">
              <LearnBreadcrumb
                learnLabel={t(LEARN_TRACKS[track].titleKey)}
                learnHref={learnTrackPath(track)}
                trail={[{ href: coursePathname, label: view.courseTitle }]}
                current={view.title}
              />

              <div className="flex flex-wrap items-center gap-2">
                <LessonContentsSheet sections={sections} defaultOpenSectionIds={openSectionIds} />
                <span className="text-sm text-muted-foreground">
                  {t("lesson.inSection", { section: view.sectionTitle })}
                </span>
              </div>

              <h1 className="text-display-sm font-semibold tracking-tight text-balance">
                {view.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {view.estimatedMinutes !== null && (
                  <span>{t("card.minuteRead", { count: view.estimatedMinutes })}</span>
                )}
                {view.externalUrl && (
                  <ExternalBadge
                    label={t("external.badge")}
                    newTabLabel={t("external.opensInNewTab")}
                  />
                )}
              </div>
              {view.summary && (
                <p className="text-lg text-pretty text-muted-foreground">{view.summary}</p>
              )}
            </div>

            {view.heroUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
                <Image
                  src={view.heroUrl}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 46rem, 100vw"
                  priority
                  className="object-cover"
                />
              </div>
            )}

            {view.learningObjectives.length > 0 && (
              <section className="flex flex-col gap-2 rounded-xl border bg-card p-5">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Target aria-hidden className="size-4 text-primary-interactive" />
                  {t("lesson.objectives")}
                </h2>
                <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
                  {view.learningObjectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* D16: the iframe is rebuilt at render from the parsed provider and
              id — the admin's URL is never echoed into markup, and an
              unsupported provider yields `null` here and renders nothing. */}
            {video && (
              <VideoFacade
                embedUrl={video.embedUrl}
                thumbnailUrl={video.thumbnailUrl}
                title={view.title}
                playLabel={t("lesson.playVideo")}
              />
            )}

            {view.content ? (
              <RichText html={view.content} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("lesson.emptyBody")}</p>
            )}

            {view.externalUrl && (
              <section className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5">
                <h2 className="text-base font-semibold">{t("lesson.externalResource")}</h2>
                <p className="text-sm text-muted-foreground">{t("lesson.externalResourceBody")}</p>
                <div>
                  <Button
                    render={<a href={view.externalUrl} target="_blank" rel="noopener noreferrer" />}
                  >
                    <ExternalLink data-icon="inline-start" aria-hidden />
                    {t("external.openResource")}
                    <span className="sr-only"> — {t("external.opensInNewTab")}</span>
                  </Button>
                </div>
              </section>
            )}

            {view.attachments.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-base font-semibold">{t("lesson.attachments")}</h2>
                  <p className="text-sm text-muted-foreground">{t("lesson.attachmentsIntro")}</p>
                </div>
                <ul className="flex flex-col gap-2">
                  {view.attachments.map((attachment) => (
                    <li key={attachment.assetId}>
                      <a
                        href={attachment.url}
                        download
                        className="card-hover flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors duration-(--duration-base) hover:border-primary/25"
                      >
                        <FileText aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">
                            {attachment.label ?? attachment.fileName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(attachment.size)}
                          </span>
                        </span>
                        <Download aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="sr-only">{t("lesson.download")}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* The completion control sits at the END of the lesson, where a
              reader who has finished actually is — not in the header, where it
              would invite a press before anything was read. */}
            <div className="flex flex-col gap-4 border-t pt-6">
              <LessonProgressActions lessonId={view.id} completionRule={view.completionRule} />
              <LessonFeedback lessonId={view.id} />
              <Link
                href={coursePathname}
                className="text-sm text-muted-foreground transition-colors duration-(--duration-base) hover:text-foreground"
              >
                {t("lesson.backToCourse")}
              </Link>
              <LessonNav
                previous={
                  view.previous
                    ? {
                        href: `${coursePathname}/${view.previous.slug}`,
                        title: view.previous.title,
                      }
                    : null
                }
                next={
                  view.next
                    ? {
                        href: `${coursePathname}/${view.next.slug}`,
                        title: view.next.title,
                      }
                    : null
                }
                labels={{
                  previous: t("lesson.previous"),
                  next: t("lesson.next"),
                  navAria: t("lesson.navAria"),
                }}
              />
            </div>
          </article>
        </Container>
      </Section>
    </ProgressProvider>
  );
}
