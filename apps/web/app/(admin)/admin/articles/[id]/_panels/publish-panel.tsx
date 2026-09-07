"use client";

// Publishing Schedule (changes-07 §1.2 item 7), including the reference's
// quick presets.
//
// Lifecycle transitions are deliberately NOT part of the header's single save:
// publishing is a state machine with its own permission gate
// (`articleKindPermission(kind, "publish")`), and folding it into a content
// save would mean every autosave-shaped action could publish. The reference
// separates them the same way.
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
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { transitionArticleAction } from "../../../_actions/article-actions.ts";
import {
  ARTICLE_STATUS_TONE,
  StatusBadge,
  statusTone,
} from "../../../_components/status-badge.tsx";
import { useServerAction } from "../../../_hooks/use-server-action.ts";
import { EditorSection } from "./editor-section.tsx";

export interface PublishLabels {
  section: string;
  description: string;
  hint: string;
  statusLabel: string;
  statusLabels: Record<string, string>;
  publishedLabel: string;
  updatedLabel: string;
  scheduleFor: string;
  transitions: Record<string, string>;
  presetPlusHour: string;
  presetTomorrow9: string;
  presetNextWeek: string;
  presetClear: string;
  confirmArchiveTitle: string;
  confirmArchiveBody: string;
  confirm: string;
  cancel: string;
}

/**
 * Colour carries consequence (ADR-046): going live is positive, coming back
 * off is a caution, archiving destroys the public URL. `default` is
 * deliberately absent — the header's "Update & Publish" is this screen's one
 * primary action, and a second solid button beside it would compete.
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

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in LOCAL time, not an ISO string. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Module scope, not the component body: these read the clock, and doing that
// during render is exactly what react-hooks/purity forbids. They are only ever
// CALLED from a click handler.
function plusHour(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

function atNineAmIn(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function PublishPanel({
  articleId,
  status,
  legalTransitions,
  publishedAt,
  updatedAt,
  canPublish,
  labels,
}: {
  articleId: string;
  status: string;
  legalTransitions: string[];
  publishedAt: string | null;
  updatedAt: string;
  canPublish: boolean;
  labels: PublishLabels;
}) {
  const [scheduleFor, setScheduleFor] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { run, pending } = useServerAction();

  const transitions = legalTransitions.filter(
    (to) => canPublish || (to !== "PUBLISHED" && to !== "SCHEDULED"),
  );

  const preset = (fn: () => Date) => () => setScheduleFor(toLocalInput(fn()));

  const transition = (to: string) =>
    run(() =>
      transitionArticleAction(
        articleId,
        to,
        to === "SCHEDULED" ? new Date(scheduleFor).toISOString() : undefined,
      ),
    );

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
        <div className="flex flex-col gap-1.5 border-t pt-3">
          <Label htmlFor="article-schedule">{labels.scheduleFor}</Label>
          <Input
            id="article-schedule"
            type="datetime-local"
            value={scheduleFor}
            onChange={(e) => setScheduleFor(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="xs" onClick={preset(plusHour)}>
              {labels.presetPlusHour}
            </Button>
            <Button variant="outline" size="xs" onClick={preset(() => atNineAmIn(1))}>
              {labels.presetTomorrow9}
            </Button>
            <Button variant="outline" size="xs" onClick={preset(() => atNineAmIn(7))}>
              {labels.presetNextWeek}
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setScheduleFor("")}>
              {labels.presetClear}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 border-t pt-3">
        {transitions.map((to) => {
          const Icon = TRANSITION_ICON[to];
          return (
            <Button
              key={to}
              variant={TRANSITION_VARIANT[to] ?? "outline"}
              size="sm"
              disabled={pending || (to === "SCHEDULED" && scheduleFor === "")}
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
