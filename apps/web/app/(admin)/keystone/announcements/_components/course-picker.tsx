"use client";

// Course search for announcements (ADR-171, changes-54 §10.3).
//
// Two jobs, one control: step 1 picks THE course being announced (single), and
// the "Learners of a course" card picks the courses whose learners hear about
// it (multiple). Search runs through a server action gated on
// `announcements.create`, debounced, and offers only courses a reader can open
// or that are SCHEDULED to be — never a draft (owner, D5).
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import type { AnnounceableCourse } from "@repo/core";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { searchAnnounceableCoursesAction } from "../../_actions/announcement-actions.ts";

const SEARCH_DELAY_MS = 250;

export interface CourseChip {
  id: string;
  title: string;
}

function useCourseSearch(open: boolean, query: string) {
  const [results, setResults] = useState<AnnounceableCourse[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchAnnounceableCoursesAction(query)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  return { results, searching };
}

function ResultList({
  results,
  searching,
  exclude,
  onPick,
}: {
  results: AnnounceableCourse[] | null;
  searching: boolean;
  exclude: readonly string[];
  onPick: (course: AnnounceableCourse) => void;
}) {
  const t = useTranslations("admin.announcements");
  const shown = (results ?? []).filter((course) => !exclude.includes(course.id));
  if (searching && results === null) {
    return <p className="text-sm text-muted-foreground">{t("courseSearching")}</p>;
  }
  if (results !== null && shown.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("courseNoResults")}</p>;
  }
  return (
    <ul className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-md border">
      {shown.map((course) => (
        <li key={course.id}>
          <button
            type="button"
            onClick={() => onPick(course)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{course.title}</span>
              <span className="text-xs text-muted-foreground">
                {t(`tracks.${course.track}`)} · {t(`levels.${course.difficulty}`)}
              </span>
            </span>
            {course.availability === "scheduled" && (
              <Badge variant="info">{t("courseScheduledBadge")}</Badge>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Step 1: exactly one course. */
export function CourseSearch({
  onPick,
  disabled,
}: {
  onPick: (course: AnnounceableCourse) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.announcements");
  const [query, setQuery] = useState("");
  const { results, searching } = useCourseSearch(!disabled, query);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("courseSearchPlaceholder")}
          aria-label={t("courseSearchPlaceholder")}
          className="ps-8"
          disabled={disabled}
        />
      </div>
      <ResultList results={results} searching={searching} exclude={[]} onPick={onPick} />
    </div>
  );
}

/** The Learners of a course card: several courses, as removable chips. */
export function CourseMultiPicker({
  value,
  onChange,
  max,
}: {
  value: CourseChip[];
  onChange: (next: CourseChip[]) => void;
  max: number;
}) {
  const t = useTranslations("admin.announcements");
  const [query, setQuery] = useState("");
  const full = value.length >= max;
  const { results, searching } = useCourseSearch(!full, query);

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("pickedCourses")}>
          {value.map((course) => (
            <li key={course.id}>
              <Badge variant="outline" className="gap-1 pe-1">
                {course.title}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-2xs"
                  aria-label={t("removeChip", { name: course.title })}
                  onClick={() => onChange(value.filter((item) => item.id !== course.id))}
                >
                  <X aria-hidden />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("courseSearchPlaceholder")}
            aria-label={t("courseSearchPlaceholder")}
          />
          <ResultList
            results={results}
            searching={searching}
            exclude={value.map((course) => course.id)}
            onPick={(course) => onChange([...value, { id: course.id, title: course.title }])}
          />
        </>
      )}
    </div>
  );
}
