"use client";

// Publishing Schedule (changes-07 §1.2 item 7), including the reference's
// quick presets.
//
// Publishing and saving are ONE operation from here on. They used to be two
// buttons that each did half of it — this panel's "Publish now" flipped the
// status without saving the open form (so it shipped the last-saved body to
// readers), while the header's "Update & Publish" saved without ever
// publishing. Both now run the editor's `submitForm`: save, then transition.
//
// The gate that the earlier split existed to protect is untouched. The two
// calls are SEQUENCED, not merged: the transition still goes through
// `transitionArticle` and its own `articleKindPermission(kind, "publish")`
// check, so no save can publish on behalf of an actor who may not. The fear
// recorded here — "every autosave-shaped action could publish" — was about a
// save that publishes implicitly; there is no autosave on this screen, and
// both paths are an explicit click on a button that names what it does.
//
// SCHEDULED saves first for the same reason PUBLISHED does: scheduling the
// post the author is looking at should queue what is on screen.
//
// changes-10 item 1: the four transitions used to render as four identical
// outline buttons, so "Publish now" and "Archive" were distinguishable only
// by reading them. Each now carries the intent variant matching its
// consequence (ADR-046). Archiving additionally confirms — it is the one
// transition that takes a live post off the site, and colour alone is not a
// speed bump.

import { useState } from "react";
import { Archive, CalendarClock, Rocket, Send, Undo2 } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
// ADR-071 — the schedule field is shared with ContentStatusPanel now that
// every content entity has a scheduledFor column, so the input, the three
// clock helpers and the presets live in one place.
import {
  ScheduleField,
  type ScheduleFieldLabels,
} from "../../../_components/editor/schedule-field.tsx";
import { transitionArticleAction } from "../../../_actions/article-actions.ts";
import {
  ARTICLE_STATUS_TONE,
  StatusBadge,
  statusTone,
} from "../../../_components/status-badge.tsx";
import { useServerAction } from "../../../_hooks/use-server-action.ts";
import { EditorSection } from "../../../_components/editor/editor-section.tsx";

export interface PublishLabels extends ScheduleFieldLabels {
  section: string;
  description: string;
  hint: string;
  statusLabel: string;
  statusLabels: Record<string, string>;
  publishedLabel: string;
  updatedLabel: string;
  transitions: Record<string, string>;
  confirmArchiveTitle: string;
  confirmArchiveBody: string;
  confirm: string;
  cancel: string;
}

/**
 * Colour carries consequence (ADR-046): going live is positive, coming back
 * off is a caution, archiving destroys the public URL. `default` is
 * deliberately absent — the header's Publish/Update is this screen's one
 * primary action, and a second solid button beside it would compete, even
 * though "Publish now" and the header button now run the same operation.
 */
const TRANSITION_VARIANT: Record<string, "success" | "info" | "warning" | "destructive"> = {
  PUBLISHED: "success",
  SCHEDULED: "info",
  DRAFT: "warning",
  ARCHIVED: "destructive",
};

const TRANSITION_ICON: Record<string, typeof Rocket> = {
  PUBLISHED: Rocket,
  SCHEDULED: CalendarClock,
  DRAFT: Undo2,
  ARCHIVED: Archive,
};

export function PublishPanel({
  articleId,
  status,
  legalTransitions,
  publishedAt,
  updatedAt,
  canPublish,
  canSave,
  submitForm,
  labels,
}: {
  articleId: string;
  status: string;
  legalTransitions: string[];
  publishedAt: string | null;
  updatedAt: string;
  canPublish: boolean;
  /** The editor's own save validity. A transition that saves first cannot run
   * while the form is incomplete, exactly as the header button cannot. */
  canSave: boolean;
  /** The editor's save, optionally followed by a lifecycle move — the single
   * operation this panel and the header button share. */
  submitForm: (
    thenTransitionTo?: "PUBLISHED" | "SCHEDULED",
    scheduledForIso?: string,
  ) => Promise<void>;
  labels: PublishLabels;
}) {
  const [scheduleFor, setScheduleFor] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { run, pending } = useServerAction();

  const transitions = legalTransitions.filter(
    (to) => canPublish || (to !== "PUBLISHED" && to !== "SCHEDULED"),
  );

  /** The two transitions that put content in front of readers save the open
   * form first; DRAFT and ARCHIVED take content DOWN, so saving into them
   * would only be a surprise. */
  const savesFirst = (to: string) => to === "PUBLISHED" || to === "SCHEDULED";

  const transition = (to: string) => {
    const scheduledForIso = to === "SCHEDULED" ? new Date(scheduleFor).toISOString() : undefined;
    return run(() =>
      savesFirst(to)
        ? submitForm(to as "PUBLISHED" | "SCHEDULED", scheduledForIso)
        : transitionArticleAction(articleId, to, scheduledForIso),
    );
  };

  return (
    <EditorSection
      title={labels.section}
      description={labels.description}
      icon={Send}
      accent="success"
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{labels.statusLabel}</span>
        <StatusBadge tone={statusTone(ARTICLE_STATUS_TONE, status)}>
          {labels.statusLabels[status] ?? status}
        </StatusBadge>
      </div>

      {publishedAt && (
        <p className="text-xs text-muted-foreground">
          {labels.publishedLabel}: {publishedAt}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {labels.updatedLabel}: {updatedAt}
      </p>

      {transitions.includes("SCHEDULED") && (
        <ScheduleField
          id="article-schedule"
          value={scheduleFor}
          onChange={setScheduleFor}
          labels={labels}
        />
      )}

      <div className="flex flex-wrap gap-1.5 border-t pt-3">
        {transitions.map((to) => {
          const Icon = TRANSITION_ICON[to];
          return (
            <Button
              key={to}
              variant={TRANSITION_VARIANT[to] ?? "outline"}
              size="sm"
              disabled={
                pending ||
                (to === "SCHEDULED" && scheduleFor === "") ||
                (savesFirst(to) && !canSave)
              }
              onClick={() => (to === "ARCHIVED" ? setArchiveOpen(true) : transition(to))}
            >
              {Icon && <Icon data-icon="inline-start" aria-hidden />}
              {labels.transitions[to] ?? to}
            </Button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{labels.hint}</p>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={labels.confirmArchiveTitle}
        description={labels.confirmArchiveBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => transition("ARCHIVED")}
      />
    </EditorSection>
  );
}
