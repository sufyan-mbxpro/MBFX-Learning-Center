"use client";

// Filter toolbar + create dialog for the courses list (changes-11 PR 3.1).
//
// The filters are CLIENT-side (D26's rule: a filter that narrows a set already
// on the page is client state; a filter that creates a collection is a route).
// `listCoursesAdmin` returns every course in one read — a learning platform
// has tens of courses, not thousands — so there is no server round trip to
// spend on a track dropdown.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { isLearnTrack, type LearnTrackKey } from "@repo/contracts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { createCourseAction } from "../../_actions/learn-actions.ts";
import { FilterBar } from "../../_components/filter-bar.tsx";
import { useServerAction } from "../../_hooks/use-server-action.ts";

export interface CoursesFilterLabels {
  allTracks: string;
  allStatuses: string;
  allDifficulties: string;
  trackLabel: string;
  statusLabel: string;
  difficultyLabel: string;
  tracks: Record<string, string>;
  statuses: Record<string, string>;
  difficulties: Record<string, string>;
}

export interface CoursesFilterState {
  track: string;
  status: string;
  difficulty: string;
}

export function CoursesToolbar({
  trackKeys,
  statusKeys,
  difficultyKeys,
  value,
  onChange,
  labels,
}: {
  trackKeys: string[];
  statusKeys: string[];
  difficultyKeys: string[];
  value: CoursesFilterState;
  onChange: (next: CoursesFilterState) => void;
  labels: CoursesFilterLabels;
}) {
  const set = (patch: Partial<CoursesFilterState>) => onChange({ ...value, ...patch });

  return (
    <FilterBar>
      {/* Toolbar filters declare their own width (ADR-057 §3) — full width
          is the form-field default and would give one filter the whole row. */}
      <AdminCombobox
        aria-label={labels.trackLabel}
        className="w-40"
        value={value.track}
        onValueChange={(track) => set({ track })}
        options={[
          { value: "", label: labels.allTracks },
          ...trackKeys.map((key) => ({ value: key, label: labels.tracks[key] ?? key })),
        ]}
      />

      <AdminCombobox
        aria-label={labels.statusLabel}
        className="w-40"
        value={value.status}
        onValueChange={(status) => set({ status })}
        options={[
          { value: "", label: labels.allStatuses },
          ...statusKeys.map((key) => ({ value: key, label: labels.statuses[key] ?? key })),
        ]}
      />

      <AdminCombobox
        aria-label={labels.difficultyLabel}
        className="w-40"
        value={value.difficulty}
        onValueChange={(difficulty) => set({ difficulty })}
        options={[
          { value: "", label: labels.allDifficulties },
          ...difficultyKeys.map((key) => ({
            value: key,
            label: labels.difficulties[key] ?? key,
          })),
        ]}
      />
    </FilterBar>
  );
}

export function NewCourseDialog({
  trackKeys,
  labels,
}: {
  trackKeys: LearnTrackKey[];
  labels: {
    newCourse: string;
    newCourseDescription: string;
    create: string;
    cancel: string;
    close: string;
    trackLabel: string;
    titleLabel: string;
    tracks: Record<string, string>;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState<LearnTrackKey | "">(trackKeys[0] ?? "");
  const [title, setTitle] = useState("");
  const { run, pending } = useServerAction();

  // Title AND track up front, unlike the article dialog: `createCourse`
  // creates the base row and its default-locale translation together, and a
  // course with no title is unfindable in a list keyed by title.
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">{labels.newCourse}</Button>} />
      <DialogContent className="max-w-sm" closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.newCourse}</DialogTitle>
          <DialogDescription>{labels.newCourseDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-course-title">{labels.titleLabel}</Label>
            <Input
              id="new-course-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-course-track">{labels.trackLabel}</Label>
            <AdminCombobox
              id="new-course-track"
              value={track}
              // The guard, not a cast: the dropdown hands back a plain
              // string, and createCourseAction only accepts a registered
              // track key.
              onValueChange={(v) => setTrack(v && isLearnTrack(v) ? v : track)}
              options={trackKeys.map((key) => ({
                value: key,
                label: labels.tracks[key] ?? key,
              }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button
            size="sm"
            disabled={pending || track === "" || title.trim() === ""}
            onClick={() =>
              run(
                async () => {
                  if (!isLearnTrack(track)) return;
                  const id = await createCourseAction({ track, title: title.trim() });
                  router.push(`/admin/learn/courses/${id}`);
                },
                { skipRefresh: true },
              )
            }
          >
            {labels.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
