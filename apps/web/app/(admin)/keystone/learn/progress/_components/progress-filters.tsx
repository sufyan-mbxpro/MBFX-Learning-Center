"use client";

// The progress screen's filters (changes-48 #4): school → course → module.
//
// URL state, not client state, because the summary tiles are counted in the
// database for the chosen courses — the rows alone cannot say how many
// DISTINCT learners they cover. Each choice clears the ones below it: a course
// from the other school, or a module from the other course, is a filter that
// matches nothing and says nothing about why.
import { useSearchParams } from "next/navigation";
import { FilterBarRow } from "@repo/ui/components/filter-bar";
import { cn } from "@repo/ui/lib/utils";
import { AdminCombobox } from "../../../_components/combobox.tsx";
import { useUrlFilters, useUrlFiltersPending } from "../../../_hooks/use-url-filters.ts";

export interface ProgressFilterLabels {
  track: string;
  allTracks: string;
  course: string;
  allCourses: string;
  section: string;
  allSections: string;
}

export function ProgressFilters({
  tracks,
  courses,
  sections,
  labels,
}: {
  tracks: { value: string; label: string }[];
  /** Already narrowed to the chosen school. */
  courses: { value: string; label: string }[];
  /** The chosen course's modules; empty until a course is chosen. */
  sections: { value: string; label: string }[];
  labels: ProgressFilterLabels;
}) {
  const searchParams = useSearchParams();
  const setParams = useUrlFilters();
  const course = searchParams.get("course") ?? "";

  return (
    <FilterBarRow>
      <AdminCombobox
        aria-label={labels.track}
        className="w-40"
        value={searchParams.get("track") ?? ""}
        onValueChange={(track) => setParams({ track, course: null, section: null })}
        options={[{ value: "", label: labels.allTracks }, ...tracks]}
      />
      <AdminCombobox
        aria-label={labels.course}
        className="w-64"
        value={course}
        onValueChange={(next) => setParams({ course: next, section: null })}
        options={[{ value: "", label: labels.allCourses }, ...courses]}
      />
      {/* Absent until a course is chosen: a module list across every course
          would repeat "Introduction" once per course. */}
      {course && sections.length > 0 && (
        <AdminCombobox
          aria-label={labels.section}
          className="w-56"
          value={searchParams.get("section") ?? ""}
          onValueChange={(section) => setParams({ section })}
          options={[{ value: "", label: labels.allSections }, ...sections]}
        />
      )}
    </FilterBarRow>
  );
}

/** Dims the figures while a filter change is on its way — the table changing, not the screen reloading. */
export function ProgressBody({ children }: { children: React.ReactNode }) {
  const pending = useUrlFiltersPending();
  return (
    <div
      aria-busy={pending || undefined}
      className={cn("flex flex-col gap-6 transition-opacity", pending && "opacity-60")}
    >
      {children}
    </div>
  );
}
