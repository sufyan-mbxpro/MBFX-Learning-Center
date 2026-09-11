"use client";

// The attached-videos panel (changes-16 PR 6, ADR-068 §4).
//
// **A row carries exactly one source.** The contract refuses both and refuses
// neither, so this panel does not offer a state the save would reject: picking
// an upload CLEARS the external URL, and typing an external URL clears the
// picked asset. A row is one radio choice with two bodies, not two optional
// fields the editor is trusted to keep exclusive.
//
// The poster only exists on the upload branch, and that is not a cosmetic
// choice: an external video's thumbnail is derived by `parseVideoUrl` at
// render, so a poster field beside a URL would be a control with no effect.
//
// Reordering is keyboard-only (plan §8.2) — this repo has no DnD dependency,
// and drag without a keyboard equivalent does not ship.
import { useState } from "react";
import { ChevronDown, ChevronUp, Film, Link2, Plus, Trash2, Upload } from "lucide-react";
import type { VideoTopicVideoInput } from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { EditorSection, Field } from "../../../../_components/editor/editor-section.tsx";
import { MediaPickerDialog } from "../../../../_components/media-picker-dialog.tsx";

/** One row in the editor: the contract's shape plus the URLs needed to preview it. */
export interface VideoDraft extends VideoTopicVideoInput {
  assetUrl: string | null;
  posterUrl: string | null;
}

export interface VideosPanelLabels {
  section: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
  add: string;
  addFirst: string;
  remove: string;
  moveUp: string;
  moveDown: string;
  sourceUpload: string;
  sourceExternal: string;
  chooseVideo: string;
  changeVideo: string;
  choosePoster: string;
  changePoster: string;
  removePoster: string;
  externalUrlLabel: string;
  externalUrlHint: string;
  titleLabel: string;
  titleHint: string;
  noSource: string;
  pickVideoTitle: string;
  pickPosterTitle: string;
  confirmRemoveTitle: string;
  confirmRemoveBody: string;
  confirm: string;
  cancel: string;
}

type Picking = { index: number; slot: "video" | "poster" } | null;

export function VideosPanel({
  items,
  onChange,
  disabled,
  labels,
}: {
  items: VideoDraft[];
  onChange: (next: VideoDraft[]) => void;
  disabled: boolean;
  labels: VideosPanelLabels;
}) {
  const [picking, setPicking] = useState<Picking>(null);
  const [removing, setRemoving] = useState<number | null>(null);

  const patch = (index: number, next: Partial<VideoDraft>) =>
    onChange(items.map((item, i) => (i === index ? ({ ...item, ...next } as VideoDraft) : item)));

  /** Re-numbers `sortOrder` from the array position — the array IS the order. */
  const renumber = (next: VideoDraft[]) =>
    onChange(next.map((item, index) => ({ ...item, sortOrder: index })));

  function add() {
    renumber([
      ...items,
      {
        externalUrl: "",
        assetId: null,
        posterAssetId: null,
        title: null,
        sortOrder: items.length,
        assetUrl: null,
        posterUrl: null,
      },
    ]);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    renumber(next);
  }

  return (
    <EditorSection
      title={labels.section}
      description={labels.description}
      icon={Film}
      accent="primary"
      actions={
        items.length > 0 && !disabled ? (
          <Button variant="outline" size="sm" onClick={add}>
            <Plus data-icon="inline-start" aria-hidden />
            {labels.add}
          </Button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <Film aria-hidden className="size-6 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          <EmptyDescription>{labels.emptyBody}</EmptyDescription>
          {!disabled && (
            <Button size="sm" onClick={add}>
              <Plus data-icon="inline-start" aria-hidden />
              {labels.addFirst}
            </Button>
          )}
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => {
            const isUpload = Boolean(item.assetId);
            return (
              <li key={index} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline">
                    {isUpload ? (
                      <>
                        <Upload data-icon="inline-start" aria-hidden />
                        {labels.sourceUpload}
                      </>
                    ) : (
                      <>
                        <Link2 data-icon="inline-start" aria-hidden />
                        {labels.sourceExternal}
                      </>
                    )}
                  </Badge>
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

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setPicking({ index, slot: "video" })}
                  >
                    <Upload data-icon="inline-start" aria-hidden />
                    {isUpload ? labels.changeVideo : labels.chooseVideo}
                  </Button>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.assetUrl ?? labels.noSource}
                  </span>
                </div>

                {/* Typing here clears the picked asset — a row has ONE source
                    (ADR-068 §4), so offering both filled is offering a save
                    the contract will refuse. */}
                <Field
                  id={`video-${index}-url`}
                  label={labels.externalUrlLabel}
                  hint={labels.externalUrlHint}
                >
                  <Input
                    id={`video-${index}-url`}
                    value={item.externalUrl ?? ""}
                    disabled={disabled}
                    maxLength={500}
                    onChange={(e) =>
                      patch(index, {
                        externalUrl: e.target.value,
                        ...(e.target.value.trim() === ""
                          ? {}
                          : {
                              assetId: null,
                              assetUrl: null,
                              posterAssetId: null,
                              posterUrl: null,
                            }),
                      })
                    }
                  />
                </Field>

                {/* Only on the upload branch: an external video's thumbnail is
                    derived by the parser, so this control would do nothing. */}
                {isUpload && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => setPicking({ index, slot: "poster" })}
                    >
                      {item.posterAssetId ? labels.changePoster : labels.choosePoster}
                    </Button>
                    {item.posterAssetId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => patch(index, { posterAssetId: null, posterUrl: null })}
                      >
                        {labels.removePoster}
                      </Button>
                    )}
                    <span className="truncate text-xs text-muted-foreground">
                      {item.posterUrl ?? ""}
                    </span>
                  </div>
                )}

                {/* Display-only and NOT translatable (ADR-068 §4) — it names
                    the recording, which does not change with the reader's
                    language the way the page's own title does. */}
                <Field
                  id={`video-${index}-title`}
                  label={labels.titleLabel}
                  hint={labels.titleHint}
                >
                  <Input
                    id={`video-${index}-title`}
                    value={item.title ?? ""}
                    disabled={disabled}
                    maxLength={200}
                    onChange={(e) =>
                      patch(index, { title: e.target.value === "" ? null : e.target.value })
                    }
                  />
                </Field>
              </li>
            );
          })}
        </ul>
      )}

      <MediaPickerDialog
        open={picking !== null}
        onOpenChange={(open) => setPicking(open ? picking : null)}
        kinds={picking?.slot === "poster" ? ["IMAGE"] : ["VIDEO"]}
        purpose="content"
        category="learn"
        title={picking?.slot === "poster" ? labels.pickPosterTitle : labels.pickVideoTitle}
        onSelect={(picked) => {
          const target = picking;
          setPicking(null);
          if (!target) return;
          if (target.slot === "poster") {
            patch(target.index, { posterAssetId: picked.id, posterUrl: picked.url });
          } else {
            // Picking an upload clears the URL, the mirror of the rule above.
            patch(target.index, {
              assetId: picked.id,
              assetUrl: picked.url,
              externalUrl: null,
            });
          }
        }}
      />

      {/* ADR-044 #7: removing asks first, even though it only stages a change
          the section's Save persists. */}
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
          if (index !== null) renumber(items.filter((_, i) => i !== index));
        }}
      />
    </EditorSection>
  );
}
