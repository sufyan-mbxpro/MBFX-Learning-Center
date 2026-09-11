"use client";

// "More courses" — the course page's right rail (design pass 2026-09-09).
//
// The news listing's sidebar (`news/_components/article-sidebar.tsx`) is the
// reference: a stack of panels beside the main column, sticky from lg, each
// one a way further into the section. The difference is what a panel filters
// BY and how.
//
// **Why the filter is client state and not a link.** A track IS a route now
// (`/learn/forex`, ADR-065 §1) — but this rail is not a way of reaching it.
// It is the catalogue beside a course you are already reading, and every
// course on it is already in the payload (the page loads the cached learn
// index for exactly this), so narrowing it is a `useState`: no request, no
// dynamic render, architecture.md #6 satisfied. The way to the school itself
// is the pinned section bar above and the "browse all" row below, both of
// which are links. Same vocabulary as /news, different mechanism per surface.
//
// The current course is never in the list. A rail whose top entry is the page
// you are on is a dead row, and dropping it here rather than at the call site
// means every future caller gets that for free.
import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowRight, Layers } from "lucide-react";
import { useTranslations } from "next-intl";

import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import type { CourseLevelTone } from "@repo/ui/components/course-card";
import { cn } from "@repo/ui/lib/utils";

export interface SidebarCourse {
  id: string;
  track: string;
  href: string;
  title: string;
  difficultyLabel: string;
  difficultyTone: CourseLevelTone;
  lessonsLabel: string;
  durationLabel: string | null;
  coverUrl: string | null;
  coverIsGenerated: boolean;
}

export interface SidebarTrack {
  track: string;
  title: string;
}

export function CourseSidebar({
  tracks,
  courses,
  /** The track the reader is currently in — its chip is selected on arrival,
   * because "more like this one" is the question the rail is answering. */
  currentTrack,
}: {
  tracks: SidebarTrack[];
  courses: SidebarCourse[];
  currentTrack: string;
}) {
  const t = useTranslations("learn");
  const [track, setTrack] = useState<string | null>(currentTrack);

  const visible = useMemo(
    () => (track === null ? courses : courses.filter((course) => course.track === track)),
    [courses, track],
  );

  // Nothing else published anywhere: no rail at all. An empty panel with a
  // filter above it advertises a section that does not exist yet.
  if (courses.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-2">
        <h2 className="text-base leading-snug font-semibold">{t("course.moreCourses")}</h2>
        <p className="text-sm text-muted-foreground">{t("course.moreCoursesIntro")}</p>

        {tracks.length > 1 && (
          <div
            role="group"
            aria-label={t("filters.trackLabel")}
            className="flex flex-wrap gap-1.5 pt-1"
          >
            <TrackChip
              active={track === null}
              onClick={() => setTrack(null)}
              label={t("filters.allTracks")}
            />
            {tracks.map((entry) => (
              <TrackChip
                key={entry.track}
                active={track === entry.track}
                onClick={() => setTrack(entry.track)}
                label={entry.title}
              />
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        {visible.length === 0 ? (
          // Reachable: a track chip can be selected whose only course is the
          // one being read. The way out is offered rather than described.
          <p className="py-2 text-sm text-muted-foreground">{t("course.moreCoursesEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((course) => (
              <li key={course.id}>
                <SidebarRow course={course} />
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="ghost"
          size="sm"
          // Bare `group`: `.hover-arrow` selects `.group:hover`, which a named
          // group never matches (globals.css).
          className="group self-start"
          render={<Link href={ROUTE_PATHS.learn} />}
        >
          {t("course.browseAll")}
          <ArrowRight data-icon="inline-end" aria-hidden className="hover-arrow rtl:rotate-180" />
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * One row. The whole row is the link — a stretched anchor over a positioned
 * host, the same construction `CourseCard` documents, so the thumbnail is part
 * of the click target and there is still one link in the accessibility tree.
 */
function SidebarRow({ course }: { course: SidebarCourse }) {
  return (
    <div className="group card-hover relative flex items-start gap-3 rounded-xl border bg-card p-2.5 transition-colors duration-(--duration-base) hover:border-primary/30 hover:bg-muted/40">
      <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {course.coverUrl && (
          <Image
            src={course.coverUrl}
            alt=""
            fill
            unoptimized={course.coverIsGenerated}
            sizes="56px"
            className="media-zoom object-cover"
          />
        )}
      </span>

      <span className="flex min-w-0 flex-col gap-1.5">
        <Link
          href={course.href}
          className="line-clamp-2 text-sm leading-snug font-medium transition-colors duration-(--duration-base) after:absolute after:inset-0 after:content-[''] group-hover:text-primary-interactive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {course.title}
        </Link>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge variant={course.difficultyTone} className="uppercase">
            {course.difficultyLabel}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Layers aria-hidden className="size-3" />
            {course.lessonsLabel}
          </span>
        </span>
      </span>
    </div>
  );
}

function TrackChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-[background-color,color,box-shadow] duration-(--duration-base) ease-(--ease-out-quint) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-background text-muted-foreground ring-border hover:text-foreground hover:ring-primary/25",
      )}
    >
      {label}
    </button>
  );
}
