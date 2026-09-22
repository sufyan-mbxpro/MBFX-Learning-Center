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
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { createCourseSchema, isLearnTrack, type LearnTrackKey } from "@repo/contracts";
import { AdminCombobox } from "../../_components/combobox.tsx";
import { createCourseAction } from "../../_actions/learn-actions.ts";
import { FilterBarRow } from "@repo/ui/components/filter-bar";
import { useFieldErrors } from "../../_hooks/use-field-errors.ts";
import { useDeletedFilterOption } from "../../_components/trash.tsx";
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
  const deletedOption = useDeletedFilterOption();

  return (
    <FilterBarRow>
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
          // The trash (changes-49): deleted courses are listed only here.
          deletedOption,
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
    </FilterBarRow>
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

  // The action's own schema; an unchosen track ("") reads as required.
  const form = useFieldErrors(createCourseSchema, { track, title: title.trim() });

  const close = () => {
    setOpen(false);
    form.reset();
  };

  // Title AND track up front, unlike the article dialog: `createCourse`
  // creates the base row and its default-locale translation together, and a
  // course with no title is unfindable in a list keyed by title.
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger render={<Button size="sm">{labels.newCourse}</Button>} />
      <DialogContent className="max-w-sm" closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.newCourse}</DialogTitle>
          <DialogDescription>{labels.newCourseDescription}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field invalid={form.invalid("title")} required>
            <FieldLabel>{labels.titleLabel}</FieldLabel>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
            <FieldError>{form.error("title")}</FieldError>
          </Field>
          <Field invalid={form.invalid("track")} required>
            <FieldLabel>{labels.trackLabel}</FieldLabel>
            <AdminCombobox
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
            <FieldError>{form.error("track")}</FieldError>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={close} disabled={pending}>
            {labels.cancel}
          </Button>
          {/* Enabled while fields are wrong: pressing it names them (audit F-07). */}
          <Button
            size="sm"
            loading={pending}
            onClick={() => {
              if (!form.validate()) return;
              run(
                async () => {
                  if (!isLearnTrack(track)) return;
                  const id = await createCourseAction({ track, title: title.trim() });
                  router.push(`/admin/learn/courses/${id}`);
                },
                { skipRefresh: true },
              );
            }}
          >
            {labels.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
