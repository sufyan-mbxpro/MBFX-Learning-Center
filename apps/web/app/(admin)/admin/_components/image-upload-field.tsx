"use client";

// THE image input for the admin surface (changes-02, ADR-017): every place
// that used to take an image URL as text now takes a file through here.
// Uploads go through the admin/api/uploads/image route handler (server
// validates bytes + size, same as the uploadImageAction it mirrors) via
// useUploadProgress for real percentage — the widget hands back the
// stored URL (and asset id) via onChange, so the owning form decides when
// to persist it — a single Save per section.
import * as React from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, LibraryBig, Trash2, Upload } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { useUploadProgress } from "../_hooks/use-upload-progress.ts";
import { UploadProgress } from "./upload-progress.tsx";
import { describeOversizeFile } from "./media-constraints.ts";
import { MediaPickerDialog } from "./media-picker-dialog.tsx";
import type { StoredImage } from "@repo/core";
import type { MediaCategory, MediaSourceType } from "@repo/contracts";

export interface ImageUploadLabels {
  upload: string;
  replace: string;
  remove: string;
  uploading: string;
  hint: string;
  /** changes-08 #6 — removal confirms first. Optional so the many existing
   * call sites keep compiling; where they are absent the widget falls back
   * to its own labels rather than shipping an English default. */
  cancel?: string;
  confirmRemoveTitle?: string;
  confirmRemoveBody?: string;
}

export interface UploadedImage {
  id: string;
  url: string;
}

export function ImageUploadField({
  id,
  label,
  value,
  purpose,
  onChange,
  labels,
  description,
  previewClassName,
  disabled,
  category,
  sourceType,
  allowLibrary = true,
}: {
  id: string;
  label: string;
  /** Current stored URL (null/empty = nothing set). */
  value: string | null;
  purpose: "brand" | "setting" | "article" | "content";
  /** Receives the stored asset after upload, or null on remove. */
  onChange: (next: UploadedImage | null) => void;
  labels: ImageUploadLabels;
  description?: string;
  previewClassName?: string;
  disabled?: boolean;
  /** ADR-049: "Choose from library" beside the upload button. On by
   * default — it exists so a surface that genuinely must upload fresh
   * bytes can opt out, not as a per-screen rollout switch. */
  allowLibrary?: boolean;
  /** Which shelf an upload from this field lands on (ADR-066 §4). Required: an optional default would quietly file half the library in the wrong place. */
  category: MediaCategory;
  /** Scopes the picker's recently-used strip to the surface this field belongs to. */
  sourceType?: MediaSourceType;
}) {
  const t = useTranslations("admin");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const upload = useUploadProgress<StoredImage>("/admin/api/uploads/image", { autoResetMs: 2500 });
  const uploading = upload.status === "uploading";
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [sizeError, setSizeError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(value || null);
  // "Adjust state during render" (react.dev), not an effect: when the
  // caller's `value` changes for a reason other than our own onChange
  // (e.g. switching which resource this field edits), resync the preview
  // synchronously instead of setState-in-effect's cascading extra render.
  const [syncedValue, setSyncedValue] = React.useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setPreview(value || null);
  }

  const pick = () => inputRef.current?.click();

  const applyStored = (stored: StoredImage | undefined) => {
    if (stored) {
      setPreview(stored.url);
      onChange({ id: stored.id, url: stored.url });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    // ADR-049 §6: an oversized file is refused here, with the real numbers,
    // instead of after it finishes uploading. @repo/core still re-checks the
    // per-kind cap server-side — that is the check that decides.
    const oversize = describeOversizeFile(file, t);
    if (oversize) {
      setSizeError(oversize);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSizeError(null);
    applyStored(await upload.upload(file, { purpose, category }));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30",
            previewClassName,
          )}
        >
          {uploading ? (
            <Spinner aria-label={labels.uploading} />
          ) : preview ? (
            // Plain <img>: admin-uploaded assets are served by our own route
            // (ADR-017) — no optimizer allowlist to maintain.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon aria-hidden className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pick}
              disabled={disabled || uploading}
            >
              <Upload data-icon="inline-start" aria-hidden />
              {preview ? labels.replace : labels.upload}
            </Button>
            {allowLibrary && (
              // ADR-049: the reuse half of ADR-034's "never uploaded again"
              // criterion. Every ImageUploadField call site gets it without
              // a call-site change, which is why it lives in the field.
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                disabled={disabled || uploading}
              >
                <LibraryBig data-icon="inline-start" aria-hidden />
                {t("mediaChooseFromLibrary")}
              </Button>
            )}
            {preview && (
              // changes-08 #6: clearing an image is destructive — it asks
              // first, like every other remove in the admin. The write
              // still happens on the section's own Save; this confirms the
              // intent, not the persistence.
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={disabled || uploading}
                  >
                    <Trash2 data-icon="inline-start" aria-hidden />
                    {labels.remove}
                  </Button>
                }
                title={labels.confirmRemoveTitle ?? labels.remove}
                description={labels.confirmRemoveBody ?? labels.hint}
                confirmLabel={labels.remove}
                cancelLabel={labels.cancel ?? labels.upload}
                onConfirm={() => {
                  setPreview(null);
                  onChange(null);
                }}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description ?? labels.hint}</p>
          {preview && <span className="truncate text-xs text-muted-foreground">{preview}</span>}
          {sizeError && <p className="text-xs text-destructive">{sizeError}</p>}
          {upload.status !== "idle" && (
            <UploadProgress
              status={upload.status}
              progress={upload.progress}
              error={upload.error}
              fileName={upload.fileName}
              onRetry={() => void upload.retry().then(applyStored)}
              className="max-w-xs"
            />
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {allowLibrary && (
        <MediaPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          purpose={purpose}
          category={category}
          sourceType={sourceType}
          kinds={["IMAGE"]}
          title={label}
          onSelect={(picked) => {
            setSizeError(null);
            setPreview(picked.url);
            onChange({ id: picked.id, url: picked.url });
          }}
        />
      )}
    </div>
  );
}
