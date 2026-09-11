"use client";

// The publishing panel for every entity on the seven-state machine — courses,
// lessons, quizzes, glossary terms and video topics (changes-11 Phase 3).
//
// Still deliberately not `publish-panel.tsx` with a flag. That panel runs the
// article machine's four states; this one runs the full seven
// (`CONTENT_TRANSITIONS` in @repo/core), so merging them would leave each
// caller with half a panel it cannot use.
//
// What IS shared with it, and now literally so: the `datetime-local` field and
// its presets. ADR-071 gave all five entities the `scheduledFor` column that
// only articles had, which is what retired this file's original note that they
// "carry no scheduling column at all" — SCHEDULED had been a legal transition
// with nowhere to record a time, so the state parked content instead of
// scheduling it.
//
// Also shared: colour carries consequence (ADR-046), archiving confirms
// because it takes a live URL down, and the transition is sequenced after the
// editor's save so publishing ships what is on screen rather than what was
// last written.
import { useState } from "react";
import { Archive, CheckCheck, Rocket, Search, Send, Undo2 } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { CONTENT_STATUS_TONE, StatusBadge, statusTone } from "../status-badge.tsx";
import { useServerAction } from "../../_hooks/use-server-action.ts";
import { EditorSection } from "./editor-section.tsx";
import { ScheduleField, type ScheduleFieldLabels } from "./schedule-field.tsx";

export interface ContentStatusLabels extends ScheduleFieldLabels {
  section: string;
  description: string;
  hint: string;
  exhausted: string;
  statusLabel: string;
  statusLabels: Record<string, string>;
  transitions: Record<string, string>;
  publishedLabel: string;
  scheduledLabel: string;
  updatedLabel: string;
  confirmArchiveTitle: string;
  confirmArchiveBody: string;
  confirm: string;
  cancel: string;
}

const TRANSITION_VARIANT: Record<string, "success" | "info" | "warning" | "destructive"> = {
  PUBLISHED: "success",
  SCHEDULED: "info",
  IN_REVIEW: "info",
  SEO_REVIEW: "info",
  APPROVED: "info",
  DRAFT: "warning",
  ARCHIVED: "destructive",
};

const TRANSITION_ICON: Record<string, typeof Rocket> = {
  PUBLISHED: Rocket,
  SCHEDULED: Rocket,
  IN_REVIEW: Send,
  SEO_REVIEW: Search,
  APPROVED: CheckCheck,
  DRAFT: Undo2,
  ARCHIVED: Archive,
};

/** The two states that put content in front of readers. */
const PUBLISHING = ["PUBLISHED", "SCHEDULED"];

export function ContentStatusPanel({
  status,
  legalTransitions,
  publishedAt,
  scheduledFor,
  updatedAt,
  canPublish,
  canSave,
  save,
  transitionTo,
  labels,
}: {
  status: string;
  legalTransitions: string[];
  publishedAt: string | null;
  /** Already formatted for display; null unless the row is SCHEDULED. */
  scheduledFor: string | null;
  updatedAt: string;
  /** Holds the entity's `*.publish` key. The service re-checks it — this only
   * decides whether to render a button the actor cannot use. */
  canPublish: boolean;
  /** The editor's own save validity: a transition that saves first cannot run
   * while the form is incomplete, exactly as the header button cannot. */
  canSave: boolean;
  /** Save the open form. The panel calls this ITSELF before a publishing
   * transition, so the editor cannot publish what is on disk while showing
   * something else — and cannot forget to. */
  save: () => Promise<void>;
  /** Move the entity. Called alone for the transitions that take content DOWN
   * or move it through review, where an implicit save would be a surprise.
   * `scheduledForIso` is sent for SCHEDULED and only for SCHEDULED. */
  transitionTo: (to: string, scheduledForIso?: string) => Promise<void>;
  labels: ContentStatusLabels;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [scheduleFor, setScheduleFor] = useState("");
  const { run, pending } = useServerAction();

  const transitions = legalTransitions.filter((to) => canPublish || !PUBLISHING.includes(to));

  // Sequenced HERE, not by the caller. This was `submitForm(to)` — one
  // callback each editor had to honour — and two of the five (glossary,
  // videos) declared `async ()`, silently dropped the argument, and turned
  // Publish into a plain save that reported success. TypeScript cannot catch
  // that: a zero-parameter function is assignable to a one-parameter type, so
  // the prop type could never have flagged it. Splitting the prop in two makes
  // the bug unrepresentable instead of guarded.
  const move = (to: string) =>
    run(async () => {
      if (PUBLISHING.includes(to)) await save();
      // The date rides along for SCHEDULED only. The service refuses a
      // SCHEDULED move with no future date (`ScheduleInPastError`) rather than
      // quietly substituting "now", so an empty field surfaces as an error
      // instead of publishing immediately.
      await transitionTo(
        to,
        to === "SCHEDULED" && scheduleFor ? new Date(scheduleFor).toISOString() : undefined,
      );
    });

  return (
    <EditorSection
      title={labels.section}
      description={labels.description}
      icon={Send}
      accent="success"
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{labels.statusLabel}</span>
        <StatusBadge tone={statusTone(CONTENT_STATUS_TONE, status)}>
          {labels.statusLabels[status] ?? status}
        </StatusBadge>
      </div>

      {publishedAt && (
        <p className="text-xs text-muted-foreground">
          {labels.publishedLabel}: {publishedAt}
        </p>
      )}
      {scheduledFor && (
        <p className="text-xs text-muted-foreground">
          {labels.scheduledLabel}: {scheduledFor}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {labels.updatedLabel}: {updatedAt}
      </p>

      {transitions.includes("SCHEDULED") && (
        <ScheduleField
          id="content-schedule"
          value={scheduleFor}
          onChange={setScheduleFor}
          labels={labels}
        />
      )}

      <div className="flex flex-wrap gap-1.5 border-t pt-3">
        {transitions.length === 0 ? (
          // PUBLISHED with no publish permission lands here: the only legal
          // move is ARCHIVED, which the filter above removed. Saying so beats
          // an empty row that reads as a rendering bug.
          <p className="text-xs text-muted-foreground">{labels.exhausted}</p>
        ) : (
          transitions.map((to) => {
            const Icon = TRANSITION_ICON[to];
            return (
              <Button
                key={to}
                variant={TRANSITION_VARIANT[to] ?? "outline"}
                size="sm"
                disabled={pending || (PUBLISHING.includes(to) && !canSave)}
                onClick={() => (to === "ARCHIVED" ? setArchiveOpen(true) : move(to))}
              >
                {Icon && <Icon data-icon="inline-start" aria-hidden />}
                {labels.transitions[to] ?? to}
              </Button>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground">{labels.hint}</p>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={labels.confirmArchiveTitle}
        description={labels.confirmArchiveBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => move("ARCHIVED")}
      />
    </EditorSection>
  );
}
