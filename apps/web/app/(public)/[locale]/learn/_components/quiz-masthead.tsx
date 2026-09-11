// The quiz index's masthead (design pass 2026-09-09) — `LearnMasthead`'s
// sibling, and built on the same `PageHero` for the same reason: the tone and
// contrast decisions are made once in the primitive.
//
// It is a separate component rather than a `LearnMasthead` prop because its
// figures are different figures. That one counts courses, lessons and hours;
// this counts quizzes, questions and topics. Threading a stat array through a
// shared component would make both call sites responsible for a layout neither
// of them owns.
//
// The figures are COUNTED from the quizzes the page already loaded — never a
// claim typed into a catalog. A school with nothing published shows no strip
// at all rather than three zeroes, exactly as the learn masthead does.
import { ArrowDown, ListChecks, Tag, Target } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { QuizCardView } from "@repo/contracts";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { PageHero } from "@repo/ui/components/page-hero";
import { Section } from "@repo/ui/components/section";
import { StatCard } from "@repo/ui/components/stat-card";

import { LearnBackdrop } from "./learn-art.tsx";

export interface QuizStats {
  quizzes: number;
  questions: number;
  topics: number;
}

/** Counted from the index's own rows, so the strip cannot disagree with the
 * grid under it. Exported for the loading skeleton's sake as much as the
 * page's: both need to know a strip appears only when something is published. */
export function quizStats(quizzes: QuizCardView[]): QuizStats {
  return {
    quizzes: quizzes.length,
    questions: quizzes.reduce((sum, quiz) => sum + quiz.questionCount, 0),
    topics: new Set(quizzes.flatMap((quiz) => (quiz.category ? [quiz.category] : []))).size,
  };
}

export async function QuizMasthead({
  stats,
  heading,
}: {
  stats: QuizStats;
  /** The school's own name, so "Learn Crypto → Quizzes" lands on a banner that
   * says which school it is (ADR-065 §1). Passed already translated. */
  heading: { eyebrow: string; title: string; lead: string };
}) {
  const t = await getTranslations("learn");

  return (
    <>
      <PageHero
        // `priority` on this one piece: it is the LCP candidate on the route.
        // Every quiz panel below it stays lazy.
        backdrop={<LearnBackdrop slot="quizBanner" priority />}
        // Composed WITH the artwork rather than instead of it: the generated
        // banner is a soft wash and the glyph field is line art, so the two
        // occupy different frequencies. Dialled down because this band already
        // carries a backdrop.
        motif={<AmbientMotif variant="learn" intensity={0.7} />}
        eyebrow={heading.eyebrow}
        title={heading.title}
        lead={heading.lead}
        actions={
          // An in-page anchor, not a navigation: on a phone the grid is a
          // screen down, and a masthead that only repeats the page's name has
          // not earned its height. `secondary` rides on --primary-foreground,
          // the one ink ADR-003 derives to be legible on the `brand` tone.
          <Button size="xl" shape="pill" variant="secondary" render={<a href="#quizzes" />}>
            {t("quizzes.heroBrowse")}
            {/* Down, not inline-end: this scrolls the page rather than
                navigating, so it needs no RTL flip either. */}
            <ArrowDown aria-hidden />
          </Button>
        }
      />

      {stats.quizzes > 0 && (
        <Section spacing="sm" tone="muted">
          <Container>
            {/* StatCard's ink is --foreground/--muted-foreground, both derived
                against --background — which is why this strip is its own muted
                band under the hero rather than a row inside the brand fill,
                where neither would be contrast-checked (ADR-018 #5). */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
              <StatItem
                icon={<Target aria-hidden className="size-5" />}
                value={stats.quizzes}
                label={t("quizzes.statQuizzes")}
              />
              <StatItem
                icon={<ListChecks aria-hidden className="size-5" />}
                value={stats.questions}
                label={t("quizzes.statQuestions")}
              />
              {stats.topics > 0 && (
                <StatItem
                  icon={<Tag aria-hidden className="size-5" />}
                  value={stats.topics}
                  label={t("quizzes.statTopics")}
                />
              )}
            </div>
          </Container>
        </Section>
      )}
    </>
  );
}

/** StatCard plus the glyph above it — the count-up itself is StatCard's. */
function StatItem({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary-interactive">
        {icon}
      </span>
      <StatCard value={value} label={label} />
    </div>
  );
}
