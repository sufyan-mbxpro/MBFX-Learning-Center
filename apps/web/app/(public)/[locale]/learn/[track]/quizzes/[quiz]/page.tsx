import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getQuizBySlug, getRedirect } from "@repo/core";
import {
  isLearnTrack,
  learnTrackPath,
  learnTrackQuizzesPath,
  LEARN_TRACKS,
  type LearnTrackKey,
} from "@repo/contracts";
import { routing } from "@repo/i18n/routing";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { LearnBreadcrumb } from "../../../_components/learn-breadcrumb.tsx";
import { QuizRunner } from "../../../_components/quiz-runner.tsx";

// The quiz runner's page (Phase 6, ADR-058).
//
// **Cached, and reads no session** — which is worth stating because the page
// is interactive from the first click. The QUIZ is content and is cached like
// any other; the ATTEMPT is client-driven against `/api/learn/quiz/*`, exactly
// as progress is (ADR-056 #1). Nothing per-learner enters this render.
//
// `getQuizBySlug` returns `QuizView`, which has no `correctAnswer` field at
// all (ADR-058 #2). The answers are not omitted here — they never reach this
// process.
function quizPath(locale: string, track: LearnTrackKey, slug: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${prefix}${learnTrackQuizzesPath(track)}/${slug}`;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn/[track]/quizzes/[quiz]">): Promise<Metadata> {
  const { locale, track, quiz: slug } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) return {};

  const [view, template] = await Promise.all([
    getQuizBySlug(locale, slug),
    getSetting("seo.titleTemplate"),
  ]);
  if (!view) return {};

  return {
    title: (template ?? "%s").replace("%s", view.title),
    description: view.description ?? undefined,
    alternates: { canonical: quizPath(locale, view.track, view.slug) },
    // A quiz page is interactive, not reference material, and an indexed quiz
    // whose questions change is a search result that lies. The index page is
    // the indexable surface; this one is `noindex, follow` so the links out of
    // it still count.
    robots: { index: false, follow: true },
  };
}

export default async function QuizPage({
  params,
}: PageProps<"/[locale]/learn/[track]/quizzes/[quiz]">) {
  const { locale, track, quiz: slug } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) notFound();

  const [coursesOn, quizzesOn] = await Promise.all([
    isFeatureVisible("courses", null),
    isFeatureVisible("quizzes", null),
  ]);
  if (!coursesOn || !quizzesOn) notFound();

  const view = await getQuizBySlug(locale, slug);
  if (!view) {
    // `saveQuiz` wrote a 301 row when the slug OR the track changed.
    const target = await getRedirect(quizPath(locale, track, slug));
    if (target) permanentRedirect(target);
    notFound();
  }

  // The quiz exists, in the other school. One canonical address per quiz
  // (ADR-065 §1) — a moved one left a redirect row above.
  if (view.track !== track) notFound();

  const t = await getTranslations({ locale, namespace: "learn" });

  return (
    <Section spacing="md">
      <Container className="flex max-w-3xl flex-col gap-6">
        <LearnBreadcrumb
          learnLabel={t(LEARN_TRACKS[track].titleKey)}
          learnHref={learnTrackPath(track)}
          trail={[{ href: learnTrackQuizzesPath(track), label: t("nav.quizzes") }]}
          current={view.title}
        />

        <header className="flex flex-col gap-2">
          <h1 className="text-display-sm font-semibold tracking-tight text-balance">
            {view.title}
          </h1>
          {view.description && (
            <p className="text-lg text-pretty text-muted-foreground">{view.description}</p>
          )}
        </header>

        <QuizRunner quiz={view} locale={locale} />
      </Container>
    </Section>
  );
}
