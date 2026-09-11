import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getStandaloneQuizzes } from "@repo/core";
import { isLearnTrack, learnTrackQuizzesPath, LEARN_TRACKS } from "@repo/contracts";
import { getSetting, isFeatureVisible } from "@repo/settings";
import { Container } from "@repo/ui/components/container";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import { Section } from "@repo/ui/components/section";
import { QuizMasthead, quizStats } from "../../_components/quiz-masthead.tsx";
import { QuizShelf } from "../../_components/quiz-shelf.tsx";
import { QuizSignInPrompt } from "../../_components/quiz-sign-in-prompt.tsx";

// The quiz index (changes-11 Phase 6, ADR-058).
//
// Cached and session-free like every other public learn page: the shelf and
// its category chips are content, and the only per-learner thing on the page
// is the sign-in prompt, which is a client island that asks the API who it is
// talking to (ADR-056 #1).
//
// **Standalone quizzes only.** A lesson quiz stays reachable by its slug and is
// deliberately not listed here (ADR-058 #1) — someone browsing this page wants
// something they can take on its own, not the checkpoint from lesson 4.
//
// **And this school's only** (ADR-065 §1). The header offers "Learn Crypto →
// Quizzes"; landing that on an index of forex quizzes would be the nav telling
// a lie on every page. The filter is a query argument, not client state,
// because `/learn/crypto/quizzes` is a page someone bookmarks — D26's rule.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn/[track]/quizzes">): Promise<Metadata> {
  const { locale, track } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) return {};

  const [t, template] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    getSetting("seo.titleTemplate"),
  ]);
  const title = `${t(LEARN_TRACKS[track].titleKey)} — ${t("quizzes.metaTitle")}`;
  return {
    title: (template ?? "%s").replace("%s", title),
    description: t("quizzes.metaDescription"),
    alternates: { canonical: learnTrackQuizzesPath(track) },
  };
}

export default async function QuizIndexPage({
  params,
}: PageProps<"/[locale]/learn/[track]/quizzes">) {
  const { locale, track } = await params;
  setRequestLocale(locale);
  if (!isLearnTrack(track)) notFound();

  // Both flags, because a quiz index inside a learning area that is switched
  // off is a page with no way back to anything.
  const [coursesOn, quizzesOn] = await Promise.all([
    isFeatureVisible("courses", null),
    isFeatureVisible("quizzes", null),
  ]);
  if (!coursesOn || !quizzesOn) notFound();

  const [t, quizzes] = await Promise.all([
    getTranslations({ locale, namespace: "learn" }),
    getStandaloneQuizzes(locale, track),
  ]);

  return (
    <>
      {/* The masthead names the SCHOOL and the page under it, in that order:
          the header offers "Learn Crypto → Quizzes", and a banner that only
          said "Quizzes" would drop the half the reader navigated by. */}
      <QuizMasthead
        stats={quizStats(quizzes)}
        heading={{
          eyebrow: t(LEARN_TRACKS[track].titleKey),
          title: t("quizzes.title"),
          lead: t("quizzes.intro"),
        }}
      />

      {/* ADR-058 #7: a guest reads every question and saves no score. The
          prompt is the offer, not a wall. It sits under the stat strip rather
          than inside the hero because it is a client island that renders
          nothing until it knows, and a hero that reflows once the answer
          arrives is worse than a band that appears below the fold. It brings
          its own Section, so a signed-in reader gets no band at all rather
          than an empty one. */}
      <QuizSignInPrompt />

      {quizzes.length === 0 ? (
        <Section spacing="md">
          <Container>
            <Empty>
              <EmptyTitle>{t("quizzes.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("quizzes.emptyBody")}</EmptyDescription>
            </Empty>
          </Container>
        </Section>
      ) : (
        <QuizShelf quizzes={quizzes} basePath={learnTrackQuizzesPath(track)} />
      )}
    </>
  );
}
