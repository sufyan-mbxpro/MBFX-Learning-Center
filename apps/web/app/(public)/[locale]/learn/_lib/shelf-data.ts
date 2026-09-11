// The shelf payload, built once (ADR-065 §1).
//
// Two pages render the same course shelf: `/learn`, which shows every track,
// and `/learn/<track>`, which shows one. Before ADR-065 there was only the
// first, and the mapping lived inline in its page. Two copies of a mapping
// that decides cover fallbacks, video counts and URL shapes is two places for
// a course card to start disagreeing with itself, so it lives here.
//
// URLs are built from `learnTrackPath` rather than by concatenation: the track
// is a segment now, and a card whose href skipped it would 404.
import { learnTrackPath, type LearnTrackKey } from "@repo/contracts";
import type { TrackGroup } from "@repo/core";
import { LEARN_TRACKS } from "@repo/contracts";
import type { ShelfLabels, ShelfTrack } from "../_components/course-shelf.tsx";
import type { LearnStats } from "../_components/learn-masthead.tsx";
import { courseCoverUrl, isGeneratedCover } from "../_content/learn-media.ts";
import { curriculumLabels, difficultyLabels, difficultyTone } from "./learn-labels.ts";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** `/learn/<track>/<course>` — the one place a course card's href is decided. */
export function courseHref(track: string, slug: string): string {
  return `${learnTrackPath(track as LearnTrackKey)}/${slug}`;
}

export function toShelfTracks(groups: TrackGroup[], t: Translate): ShelfTrack[] {
  const difficulties = difficultyLabels(t);

  return groups.map((group) => ({
    track: group.track,
    // LEARN_TRACKS holds message keys RELATIVE to this namespace (ADR-055 #2),
    // so a track's name is translatable and no raw registry key ever renders.
    title: t(LEARN_TRACKS[group.track].titleKey),
    description: t(LEARN_TRACKS[group.track].descriptionKey),
    courses: group.courses.map((course) => {
      // A course with no cover of its own falls back to its TRACK's generated
      // panel rather than to an empty box (`_content/learn-media.ts`). The
      // card's own no-artwork state is still the floor under that, for a track
      // whose panel is null.
      const cover = courseCoverUrl(course.coverUrl, course.track);
      const videoCount = course.sections.reduce(
        (sum, section) => sum + section.lessons.filter((lesson) => lesson.hasVideo).length,
        0,
      );
      const base = courseHref(course.track, course.slug);

      return {
        id: course.id,
        href: base,
        title: course.title,
        summary: course.summary,
        difficulty: course.difficulty,
        difficultyLabel: difficulties[course.difficulty] ?? course.difficulty,
        difficultyTone: difficultyTone(course.difficulty),
        lessonsLabel: t("card.lessons", { count: course.lessonCount }),
        durationLabel:
          course.estimatedHours === null ? null : t("card.hours", { count: course.estimatedHours }),
        // Counted from the curriculum this payload already carries, never
        // claimed: a course with no video lesson shows no video chip.
        videoLabel: videoCount === 0 ? null : t("card.videos", { count: videoCount }),
        coverUrl: cover,
        coverIsGenerated: cover !== null && isGeneratedCover(cover),
        isExternal: course.externalUrl !== null,
        sections: course.sections.map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description,
          countLabel: t("course.sectionLessons", { count: section.lessons.length }),
          lessons: section.lessons.map((lesson) => ({
            id: lesson.id,
            href: `${base}/${lesson.slug}`,
            title: lesson.title,
            summary: lesson.summary,
            durationLabel:
              lesson.estimatedMinutes === null
                ? null
                : t("card.minuteRead", { count: lesson.estimatedMinutes }),
            isExternal: lesson.hasExternal,
            isOptional: !lesson.isRequired,
          })),
        })),
      };
    }),
  }));
}

/**
 * Counted from the shelf, not stored and not typed into a catalog: the figures
 * cannot drift from what the page is showing, because they are what the page
 * is showing.
 */
export function learnStats(groups: TrackGroup[]): LearnStats {
  return {
    courses: groups.reduce((sum, group) => sum + group.courses.length, 0),
    lessons: groups.reduce(
      (sum, group) => sum + group.courses.reduce((n, course) => n + course.lessonCount, 0),
      0,
    ),
    hours: Math.round(
      groups.reduce(
        (sum, group) =>
          sum + group.courses.reduce((n, course) => n + (course.estimatedHours ?? 0), 0),
        0,
      ),
    ),
  };
}

export function shelfLabels(t: Translate): ShelfLabels {
  return {
    ...curriculumLabels(t),
    start: t("card.start"),
    openExternal: t("card.openCourse"),
    showLessons: t("card.showLessons"),
    hideLessons: t("card.hideLessons"),
    noArtwork: t("card.noArtwork"),
    filterLabel: t("filters.label"),
    filterAll: t("filters.all"),
    difficulties: difficultyLabels(t),
    noneTitle: t("filters.noneTitle"),
    noneBody: t("filters.noneBody"),
    clearFilter: t("filters.clear"),
  };
}
