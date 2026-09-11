// Featured lessons (changes-11 PR 5.4).
//
// **"Featured" is a code-owned rule here, not an admin flag.** `Lesson` has no
// `isFeatured` column and this section does not add one: what it shows is the
// OPENING lesson of each published course, which is the honest answer to "give
// me somewhere to start" and needs no editorial upkeep. `Article.isFeatured`
// exists because a news front has to be curated; a course's first lesson is
// determined by the curriculum the editor already ordered.
//
// If a real editorial pick is ever wanted, it is a column plus an admin
// control plus a fallback for when nobody has picked — a feature, not a tweak.
// The rule is stated here so that decision is taken deliberately rather than
// discovered.
import { getTranslations } from "next-intl/server";
import { ArrowRight, PlayCircle } from "lucide-react";
import { getLearnIndex } from "@repo/core";
import { learnTrackPath, ROUTE_PATHS, type LearnTrackKey } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { isFeatureVisible } from "@repo/settings";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { SectionHeading } from "@repo/ui/components/section-heading";
import type { SectionProps } from "./registry.ts";

const DEFAULT_LIMIT = 3;

export async function FeaturedLessons({ locale, limit }: SectionProps) {
  if (!(await isFeatureVisible("courses", null))) return null;

  const [t, learnT, groups] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "learn" }),
    getLearnIndex(locale),
  ]);

  // One lesson per course, taken across tracks in shelf order, so a homepage
  // rail never shows three lessons from the same course while another course
  // is invisible.
  const openers = groups
    .flatMap((group) => group.courses)
    .flatMap((course) => {
      const lesson = course.sections.flatMap((section) => section.lessons)[0];
      return lesson ? [{ course, lesson }] : [];
    })
    .slice(0, limit ?? DEFAULT_LIMIT);

  if (openers.length === 0) return null;

  return (
    <Section tone="muted" spacing="md">
      <Container className="flex flex-col gap-(--section-gap)">
        <SectionHeading
          title={t("featuredLessons.title")}
          lead={t("featuredLessons.description")}
        />
        <Reveal variant="up">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openers.map(({ course, lesson }) => (
              <li key={lesson.id}>
                <Link
                  href={`${learnTrackPath(course.track as LearnTrackKey)}/${course.slug}/${lesson.slug}`}
                  className="card-hover flex h-full flex-col gap-2 rounded-xl border bg-card p-5 transition-colors duration-(--duration-base) hover:border-primary/25"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-primary-interactive uppercase">
                    <PlayCircle aria-hidden className="size-4" />
                    {course.title}
                  </span>
                  <span className="font-semibold">{lesson.title}</span>
                  {lesson.summary && (
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {lesson.summary}
                    </span>
                  )}
                  {lesson.estimatedMinutes !== null && (
                    <span className="mt-auto pt-2 text-xs text-muted-foreground">
                      {learnT("card.minuteRead", { count: lesson.estimatedMinutes })}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
        <div>
          <Button variant="outline" render={<Link href={ROUTE_PATHS.learn} />}>
            {t("featuredLessons.action")}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        </div>
      </Container>
    </Section>
  );
}
