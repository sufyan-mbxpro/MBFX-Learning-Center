"use client";

// `CurriculumList` with the learner's real state painted on (PR 5.3).
//
// The list itself is unchanged: it renders every lesson with a marker from
// first paint, defaulting to "not started" (ADR-056 #1). This component only
// decides WHICH marker, and because the marker already occupies its space,
// swapping "not started" for "completed" after hydrate moves nothing.
//
// Precedence, and each rung matters:
//   1. the learner's stored state, when there is a row for the lesson
//   2. the state the SERVER already asserted — the lesson page marks the
//      lesson being read as in-progress, which is true before any fetch
//      resolves and stays true for a guest
//   3. not started
import { useTranslations } from "next-intl";
import { CurriculumList, type CurriculumSection } from "@repo/ui/components/curriculum-list";
import type { LessonState } from "@repo/ui/components/lesson-state-icon";
import { curriculumLabels } from "../_lib/learn-labels.ts";
import { useProgress } from "./progress-provider.tsx";

export function CurriculumWithProgress({
  sections,
  variant = "full",
  defaultOpenSectionIds,
  className,
}: {
  sections: CurriculumSection[];
  variant?: "full" | "compact";
  defaultOpenSectionIds?: string[];
  className?: string;
}) {
  const t = useTranslations("learn");
  const { stateFor } = useProgress();

  const resolved = sections.map((section) => ({
    ...section,
    lessons: section.lessons.map((lesson) => {
      const stored = stateFor(lesson.id);
      const state: LessonState | undefined = stored ?? lesson.state;
      return { ...lesson, state };
    }),
  }));

  return (
    <CurriculumList
      sections={resolved}
      labels={curriculumLabels(t)}
      variant={variant}
      defaultOpenSectionIds={defaultOpenSectionIds}
      className={className}
    />
  );
}
