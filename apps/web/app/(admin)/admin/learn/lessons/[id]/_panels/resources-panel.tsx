"use client";

// The Resources panel (changes-11 PR 3.4): hero image, video embed, external
// resource, and downloadable attachments.
//
// These four ARE the lesson's capabilities (ADR-055 #4) alongside body
// content, so this panel carries the live "what kind of lesson is this"
// readout the plan asks for: the admin sees the badge a learner will see —
// "External · YouTube" — while they are still typing the URL, instead of after
// a save that may reject the whole form.
//
// Attachments are held as a DRAFT and travel in `saveLessonAction`'s payload:
// `lessonInputSchema` requires the full list because the capability rule has
// to be decidable from the payload alone, and a separate attachment save could
// leave the form claiming a capability the row does not have.
import { useState } from "react";
import { ArrowDown, ArrowUp, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { humanizeKey, parseVideoUrl } from "@repo/utils";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Input } from "@repo/ui/components/input";
import { EditorSection, Field } from "../../../../_components/editor/editor-section.tsx";
import { ImageUploadField } from "../../../../_components/image-upload-field.tsx";
import { MediaPickerDialog } from "../../../../_components/media-picker-dialog.tsx";
import type { ImageUploadLabels } from "../../../../_components/image-upload-field.tsx";

export interface AttachmentDraft {
  assetId: string;
  label: string;
  fileName: string;
  url: string;
}

export interface ResourcesLabels {
  section: string;
  sectionDescription: string;
  heroImageLabel: string;
  videoUrlLabel: string;
  videoInvalid: string;
  externalUrlLabel: string;
  externalUrlHint: string;
  attachmentsLabel: string;
  addAttachment: string;
  noAttachments: string;
  attachmentLabelField: string;
  attachmentLabelHint: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  pickerTitle: string;
  capabilityWarning: string;
  kindBadge: string;
  kindReading: string;
  kindVideo: string;
  kindExternal: string;
  kindDownload: string;
  confirmRemoveTitle: string;
  confirmRemoveBody: string;
  confirm: string;
  cancel: string;
  upload: ImageUploadLabels;
}

const MAX_ATTACHMENTS = 20;

export function ResourcesPanel({
  hero,
  onHeroChange,
  videoUrl,
  onVideoUrlChange,
  externalUrl,
  onExternalUrlChange,
  attachments,
  onAttachmentsChange,
  hasBody,
  disabled,
  labels,
}: {
  hero: { id: string | null; url: string | null };
  onHeroChange: (next: { id: string | null; url: string | null }) => void;
  videoUrl: string;
  onVideoUrlChange: (next: string) => void;
  externalUrl: string;
  onExternalUrlChange: (next: string) => void;
  attachments: AttachmentDraft[];
  onAttachmentsChange: (next: AttachmentDraft[]) => void;
  /** Body content is the fifth capability and lives in another panel; this
   * panel needs it only to decide whether to raise the D15 warning. */
  hasBody: boolean;
  disabled: boolean;
  labels: ResourcesLabels;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

  // Derived, never stored (ADR-055 #4 / #5). `parseVideoUrl` is the same
  // allowlist `saveLesson` enforces, so what shows here is what will save.
  const video = videoUrl.trim() === "" ? null : parseVideoUrl(videoUrl.trim());
  const videoInvalid = videoUrl.trim() !== "" && video === null;

  const kinds = [
    ...(hasBody ? [labels.kindReading] : []),
    // ADR-044 #5: the provider key never renders raw. humanizeKey is the
    // documented fallback for an identifier with no catalog string of its own.
    ...(video ? [`${labels.kindVideo} · ${humanizeKey(video.provider)}`] : []),
    ...(attachments.length > 0 ? [labels.kindDownload] : []),
    ...(externalUrl.trim() !== "" ? [labels.kindExternal] : []),
  ];

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= attachments.length) return;
    const next = [...attachments];
    const a = next[index];
    const b = next[target];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[target] = a;
    onAttachmentsChange(next);
  };

  return (
    <EditorSection
      title={labels.section}
      description={labels.sectionDescription}
      icon={Paperclip}
      accent="warning"
      actions={
        kinds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {kinds.map((kind) => (
              <Badge key={kind} variant="outline">
                {kind}
              </Badge>
            ))}
          </div>
        ) : undefined
      }
    >
      {/* The D15 rule, surfaced BEFORE the save rejects it. `lessonInputSchema`
          and `saveLesson` both enforce this — the notice is UX, not the gate. */}
      {kinds.length === 0 && (
        <p className="rounded-md border border-warning/30 bg-warning/8 p-2 text-xs text-warning-interactive">
          {labels.capabilityWarning}
        </p>
      )}

      <ImageUploadField
        id="lesson-hero"
        label={labels.heroImageLabel}
        value={hero.url}
        purpose="content"
        category="learn"
        sourceType="COURSE"
        disabled={disabled}
        onChange={(next) => onHeroChange({ id: next?.id ?? null, url: next?.url ?? null })}
        labels={labels.upload}
      />

      <Field
        id="lesson-video"
        label={labels.videoUrlLabel}
        adornment={
          videoInvalid ? (
            <span className="text-xs text-destructive">{labels.videoInvalid}</span>
          ) : null
        }
      >
        <Input
          id="lesson-video"
          type="url"
          inputMode="url"
          value={videoUrl}
          disabled={disabled}
          aria-invalid={videoInvalid || undefined}
          onChange={(e) => onVideoUrlChange(e.target.value)}
        />
      </Field>

      <Field id="lesson-external" label={labels.externalUrlLabel} hint={labels.externalUrlHint}>
        <Input
          id="lesson-external"
          type="url"
          inputMode="url"
          value={externalUrl}
          disabled={disabled}
          onChange={(e) => onExternalUrlChange(e.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{labels.attachmentsLabel}</span>
          {!disabled && attachments.length < MAX_ATTACHMENTS && (
            <Button variant="outline" size="xs" onClick={() => setPickerOpen(true)}>
              <Plus data-icon="inline-start" aria-hidden />
              {labels.addAttachment}
            </Button>
          )}
        </div>

        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">{labels.noAttachments}</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {attachments.map((attachment, index) => (
              <li
                key={attachment.assetId}
                className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2"
              >
                <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-xs text-muted-foreground">
                    {attachment.fileName}
                  </span>
                  <Input
                    aria-label={labels.attachmentLabelField}
                    placeholder={labels.attachmentLabelField}
                    value={attachment.label}
                    disabled={disabled}
                    maxLength={200}
                    onChange={(e) =>
                      onAttachmentsChange(
                        attachments.map((entry, i) =>
                          i === index ? { ...entry, label: e.target.value } : entry,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={labels.moveUp}
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={labels.moveDown}
                  disabled={disabled || index === attachments.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={labels.remove}
                  className="text-destructive"
                  disabled={disabled}
                  onClick={() => setRemoveIndex(index)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-muted-foreground">{labels.attachmentLabelHint}</p>
      </div>

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kinds={["DOCUMENT", "IMAGE", "AUDIO", "VIDEO"]}
        purpose="content"
        category="learn"
        sourceType="COURSE"
        title={labels.pickerTitle}
        onSelect={(picked) => {
          setPickerOpen(false);
          // Silently ignore a re-pick: an asset can only sit on a lesson once
          // (`replaceAttachments` writes one row per entry), and a duplicate
          // row would make the reference sync ambiguous.
          if (attachments.some((entry) => entry.assetId === picked.id)) return;
          onAttachmentsChange([
            ...attachments,
            { assetId: picked.id, label: "", fileName: picked.fileName, url: picked.url },
          ]);
        }}
      />

      {/* ADR-044 #7: detaching confirms even though it only stages a change
          the section's Save will persist. */}
      <ConfirmDialog
        open={removeIndex !== null}
        onOpenChange={(open) => (open ? undefined : setRemoveIndex(null))}
        title={labels.confirmRemoveTitle}
        description={labels.confirmRemoveBody}
        confirmLabel={labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => {
          if (removeIndex === null) return;
          onAttachmentsChange(attachments.filter((_, i) => i !== removeIndex));
          setRemoveIndex(null);
        }}
      />
    </EditorSection>
  );
}
