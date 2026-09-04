"use client";

// THE image input for the admin surface (changes-02, ADR-017): every place
// that used to take an image URL as text now takes a file through here.
// Uploads go through uploadImageAction (server validates bytes + size);
// the widget hands back the stored URL (and asset id) via onChange, so the
// owning form decides when to persist it — a single Save per section.
import * as React from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { uploadImageAction } from "../_actions/media-actions.ts";

export interface ImageUploadLabels {
  upload: string;
  replace: string;
  remove: string;
  uploading: string;
  hint: string;
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
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
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

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("purpose", purpose);
      const stored = await uploadImageAction(formData);
      setPreview(stored.url);
      onChange({ id: stored.id, url: stored.url });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
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
            {preview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={disabled || uploading}
                onClick={() => {
                  setPreview(null);
                  onChange(null);
                }}
              >
                <Trash2 data-icon="inline-start" aria-hidden />
                {labels.remove}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description ?? labels.hint}</p>
          {preview && <code className="truncate text-xs text-muted-foreground">{preview}</code>}
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
    </div>
  );
}
