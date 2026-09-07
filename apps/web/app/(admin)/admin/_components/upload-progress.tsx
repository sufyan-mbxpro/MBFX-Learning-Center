"use client";

// Uploading/success/error states for the progress-tracked upload surfaces
// (media library upload + replace, image fields, rich-text image insert).
// Self-contained translation lookup (useTranslations directly, like
// breadcrumbs.tsx) rather than a `labels` prop — the live percentage is
// client-side state, so pre-resolving strings server-side doesn't fit.
import { useTranslations } from "next-intl";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Progress } from "@repo/ui/components/progress";
import { cn } from "@repo/ui/lib/utils";
import type { UploadStatus } from "../_hooks/use-upload-progress.ts";

export function UploadProgress({
  status,
  progress,
  error,
  fileName,
  onRetry,
  className,
}: {
  status: UploadStatus;
  progress: number;
  error?: string | null;
  fileName?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useTranslations("admin");
  if (status === "idle") return null;

  return (
    <div
      className={cn("flex w-full flex-col gap-1.5 rounded-md border p-3 text-sm", className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        {fileName && <span className="min-w-0 truncate font-medium">{fileName}</span>}
        {status === "uploading" && (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {t("uploadPercent", { percent: progress })}
          </span>
        )}
        {status === "success" && (
          <CheckCircle2 aria-hidden className="size-4 shrink-0 text-primary" />
        )}
        {status === "error" && <XCircle aria-hidden className="size-4 shrink-0 text-destructive" />}
      </div>
      {status === "uploading" && <Progress value={progress} aria-label={t("uploading")} />}
      {status === "success" && (
        <p className="text-xs text-muted-foreground">{t("uploadSuccess")}</p>
      )}
      {status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-xs text-destructive">{error}</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw data-icon="inline-start" aria-hidden />
              {t("uploadRetry")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
