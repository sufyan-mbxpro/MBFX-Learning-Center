"use client";

// The labelled-links panel (changes-16 PR 6, ADR-068 §5).
//
// **A link carries exactly one href**, internal or external, and the editor
// chooses which by a two-way toggle rather than by filling one of two boxes.
// Same reason as the videos panel: the contract refuses both and refuses
// neither, so a UI that lets an editor fill both is a UI that offers a save
// the server will reject.
//
// There is deliberately no stored `isExternal` flag — which branch is set
// already says it, and a copy goes stale the first time a link is edited. This
// panel's toggle is state, not a field: it decides which input is shown and
// which column the value lands in.
//
// The internal path is validated by `internalPathSchema` on save, and the
// hint says what it demands: one leading slash, no locale prefix. The regex
// refuses `//evil.example` — a protocol-relative URL that satisfies every
// naive "starts with a slash" check and navigates off-site.
import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import type { VideoTopicLinkInput } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { EditorSection, Field } from "../../../../_components/editor/editor-section.tsx";

export type LinkDraft = VideoTopicLinkInput;

export interface LinksPanelLabels {
  section: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
  add: string;
  addFirst: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  labelLabel: string;
  internal: string;
  external: string;
  pathLabel: string;
  pathHint: string;
  urlLabel: string;
  urlHint: string;
  confirmRemoveTitle: string;
  confirmRemoveBody: string;
  confirm: string;
  cancel: string;
}

export function LinksPanel({
  items,
  onChange,
  disabled,
  labels,
}: {
  items: LinkDraft[];
  onChange: (next: LinkDraft[]) => void;
  disabled: boolean;
  labels: LinksPanelLabels;
}) {
  const [removing, setRemoving] = useState<number | null>(null);

  const patch = (index: number, next: Partial<LinkDraft>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...next } : item)));

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onChange(next);
  }

  return (
    <EditorSection
      title={labels.section}
      description={labels.description}
      icon={Link2}
      accent="neutral"
      actions={
        items.length > 0 && !disabled ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange([...items, { label: "", path: "" }])}
          >
            <Plus data-icon="inline-start" aria-hidden />
            {labels.add}
          </Button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <Link2 aria-hidden className="size-6 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          <EmptyDescription>{labels.emptyBody}</EmptyDescription>
          {!disabled && (
            <Button size="sm" onClick={() => onChange([{ label: "", path: "" }])}>
              <Plus data-icon="inline-start" aria-hidden />
              {labels.addFirst}
            </Button>
          )}
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => {
            const isExternal = item.url != null;
            return (
              <li key={index} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Two buttons rather than a dropdown: it is a binary choice
                      whose options are both visible in less space than a
                      collapsed listbox takes. */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant={isExternal ? "ghost" : "secondary"}
                      size="sm"
                      disabled={disabled}
                      aria-pressed={!isExternal}
                      onClick={() => patch(index, { path: item.path ?? "", url: null })}
                    >
                      <Link2 data-icon="inline-start" aria-hidden />
                      {labels.internal}
                    </Button>
                    <Button
                      variant={isExternal ? "secondary" : "ghost"}
                      size="sm"
                      disabled={disabled}
                      aria-pressed={isExternal}
                      onClick={() => patch(index, { url: item.url ?? "", path: null })}
                    >
                      <ExternalLink data-icon="inline-start" aria-hidden />
                      {labels.external}
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={labels.moveUp}
                      disabled={disabled || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={labels.moveDown}
                      disabled={disabled || index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={labels.remove}
                      disabled={disabled}
                      onClick={() => setRemoving(index)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>

                <Field id={`link-${index}-label`} label={labels.labelLabel}>
                  <Input
                    id={`link-${index}-label`}
                    value={item.label}
                    disabled={disabled}
                    maxLength={200}
                    onChange={(e) => patch(index, { label: e.target.value })}
                  />
                </Field>

                {isExternal ? (
                  <Field id={`link-${index}-url`} label={labels.urlLabel} hint={labels.urlHint}>
                    <Input
                      id={`link-${index}-url`}
                      value={item.url ?? ""}
                      disabled={disabled}
                      maxLength={500}
                      onChange={(e) => patch(index, { url: e.target.value })}
                    />
                  </Field>
                ) : (
                  <Field id={`link-${index}-path`} label={labels.pathLabel} hint={labels.pathHint}>
                    <Input
                      id={`link-${index}-path`}
                      value={item.path ?? ""}
                      disabled={disabled}
                      maxLength={500}
                      onChange={(e) => patch(index, { path: e.target.value })}
                    />
                  </Field>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ADR-044 #7: removing asks first, even though it only stages a change
          the screen's Save persists. */}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => setRemoving(open ? removing : null)}
        title={labels.confirmRemoveTitle}
        description={labels.confirmRemoveBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => {
          const index = removing;
          setRemoving(null);
          if (index !== null) onChange(items.filter((_, i) => i !== index));
        }}
      />
    </EditorSection>
  );
}
