"use client";

// THE media picker (ADR-049) — the "select" half ADR-034 §5 specified and
// media-library.tsx recorded as deferred while the only consumer (the
// composer) was paused. ADR-042 cancelled that consumer for good; the
// requirement it was waiting behind ("a media asset should never need to be
// uploaded again because it is used on another page") outlived it, and now
// has four shipped consumers: ImageUploadField, the rich-text editor's
// in-body image button, and through the field, every settings/branding
// image slot.
//
// Deliberately NOT MediaLibrary with a `mode` flag: that component is the
// management UI (metadata form, replace, delete, confirms) and every branch
// of it would need guarding. This is a picker — grid in, asset out.
// Editing an asset stays on /admin/media, one implementation each.
//
// Strings resolve here via useTranslations rather than a `labels` prop,
// following upload-progress.tsx and breadcrumbs.tsx — the alternative is
// threading a dozen more props through four screens to say six words.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { FileText, Music, Upload, Video } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { Empty, EmptyTitle } from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { cn } from "@repo/ui/lib/utils";
import { listMediaAssetsAction } from "../_actions/media-actions.ts";
import { useUploadProgress } from "../_hooks/use-upload-progress.ts";
import { UploadProgress } from "./upload-progress.tsx";
import { describeOversizeFile, fileAcceptAttribute } from "./media-constraints.ts";
import type { MediaAssetRow, StoredMediaAsset } from "@repo/core";
import type { UploadPurpose } from "@repo/contracts";

export type PickableKind = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";

/** What a picked asset hands back. A superset of ImageUploadField's
 * `{ id, url }` so the field's own contract (ADR-035's reference wiring)
 * is unchanged, with the extras the rich-text editor needs for alt text. */
export interface PickedMedia {
  id: string;
  url: string;
  fileName: string;
  altText: string | null;
  kind: PickableKind;
}

function AssetTile({ asset }: { asset: MediaAssetRow }) {
  if (asset.kind === "IMAGE") {
    return (
      <Image
        src={asset.url}
        alt={asset.altText ?? ""}
        fill
        sizes="160px"
        className="object-cover"
      />
    );
  }
  const Icon = asset.kind === "VIDEO" ? Video : asset.kind === "AUDIO" ? Music : FileText;
  return (
    <div className="flex size-full items-center justify-center bg-muted">
      <Icon aria-hidden className="size-7 text-muted-foreground" />
    </div>
  );
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  kinds = ["IMAGE"],
  purpose,
  canUpload = true,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (picked: PickedMedia) => void;
  /** Which kinds the dialog offers. The server still decides by magic
   * bytes (ADR-034 §1) — this narrows the UI, it does not grant anything. */
  kinds?: PickableKind[];
  purpose: UploadPurpose;
  canUpload?: boolean;
  /** Overrides the dialog heading where the calling surface has a better
   * word for what is being chosen. */
  title?: string;
}) {
  const t = useTranslations("admin");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{title ?? t("mediaPickerTitle")}</DialogTitle>
        </DialogHeader>
        {/* The body mounts with the dialog and unmounts with it. That IS
            the reset: tab, query, the fetched list and the upload hook's
            state all go with it, so reopening starts clean and the list is
            re-fetched — without a single setState in an effect body, which
            react-hooks/set-state-in-effect rightly refuses. A field whose
            picker is never opened also costs no fetch. */}
        {open && (
          <MediaPickerBody
            onSelect={onSelect}
            onOpenChange={onOpenChange}
            kinds={kinds}
            purpose={purpose}
            canUpload={canUpload}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MediaPickerBody({
  onSelect,
  onOpenChange,
  kinds,
  purpose,
  canUpload,
}: {
  onSelect: (picked: PickedMedia) => void;
  onOpenChange: (open: boolean) => void;
  kinds: PickableKind[];
  purpose: UploadPurpose;
  canUpload: boolean;
}) {
  const t = useTranslations("admin");
  const [assets, setAssets] = useState<MediaAssetRow[] | null>(null);
  // Distinct from an empty result set: a role holding theme.update but not
  // media.view reaches this dialog through the branding fields and must be
  // told why the library is unavailable, not shown a misleading nothing-here.
  // (Prose here avoids double quotes on purpose: check:phantom-deps reads a
  // quoted phrase after the word imports as a module specifier.)
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [sizeError, setSizeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadUrl =
    kinds.length === 1 && kinds[0] === "IMAGE"
      ? "/admin/api/uploads/image"
      : "/admin/api/uploads/media";
  const upload = useUploadProgress<StoredMediaAsset>(uploadUrl);

  const singleKind = kinds.length === 1 ? kinds[0] : undefined;

  // Reading the library IS synchronising with an external system, so it
  // belongs in an effect — the setState happens in the promise callback,
  // not synchronously in the body.
  useEffect(() => {
    let cancelled = false;
    listMediaAssetsAction({ kind: singleKind })
      .then((rows) => {
        if (!cancelled) setAssets(rows);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAssets([]);
        setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [singleKind]);

  const filtered = useMemo(() => {
    if (!assets) return [];
    const q = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (!kinds.includes(asset.kind as PickableKind)) return false;
      if (!q) return true;
      return (
        asset.fileName.toLowerCase().includes(q) ||
        (asset.title ?? "").toLowerCase().includes(q) ||
        (asset.altText ?? "").toLowerCase().includes(q) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [assets, kinds, query]);

  const pick = (picked: PickedMedia) => {
    onSelect(picked);
    onOpenChange(false);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    // Fail fast on size with the real numbers, before spending the upload.
    // The server cap (@repo/core, per-kind setting) still decides — this is
    // additive courtesy, never the check that matters (security.md #9).
    const oversize = describeOversizeFile(file, t);
    if (oversize) {
      setSizeError(oversize);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSizeError(null);
    const stored = await upload.upload(file, { purpose });
    if (inputRef.current) inputRef.current.value = "";
    if (stored) {
      pick({
        id: stored.id,
        url: stored.url,
        fileName: stored.fileName,
        altText: null,
        kind: (stored.kind ?? "IMAGE") as PickableKind,
      });
    }
  };

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as "library" | "upload")}>
      <TabsList>
        <TabsTrigger value="library">{t("mediaPickerLibraryTab")}</TabsTrigger>
        {canUpload && <TabsTrigger value="upload">{t("mediaPickerUploadTab")}</TabsTrigger>}
      </TabsList>

      <TabsContent value="library" className="flex flex-col gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("mediaSearchPlaceholder")}
          aria-label={t("mediaSearchPlaceholder")}
        />
        {assets === null ? (
          <div className="flex justify-center py-10">
            <Spinner aria-label={t("loading")} />
          </div>
        ) : loadError ? (
          <p className="py-8 text-center text-sm text-destructive">{loadError}</p>
        ) : filtered.length === 0 ? (
          <Empty className="py-8">
            <EmptyTitle>{t("mediaPickerEmpty")}</EmptyTitle>
          </Empty>
        ) : (
          <ul className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
            {filtered.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() =>
                    pick({
                      id: asset.id,
                      url: asset.url,
                      fileName: asset.fileName,
                      altText: asset.altText,
                      kind: asset.kind as PickableKind,
                    })
                  }
                  className={cn(
                    "group flex w-full flex-col gap-1 rounded-md border p-1 text-start",
                    "hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2",
                    "focus-visible:outline-ring",
                  )}
                >
                  <span className="relative block aspect-square overflow-hidden rounded-sm bg-muted/30">
                    <AssetTile asset={asset} />
                  </span>
                  <span className="truncate px-0.5 text-xs text-muted-foreground">
                    {asset.title || asset.fileName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      {canUpload && (
        <TabsContent value="upload" className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={upload.status === "uploading"}
            className="self-start"
          >
            <Upload data-icon="inline-start" aria-hidden />
            {t("mediaUpload")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("uploadHint")}</p>
          {sizeError && <p className="text-xs text-destructive">{sizeError}</p>}
          {upload.status !== "idle" && (
            <UploadProgress
              status={upload.status}
              progress={upload.progress}
              error={upload.error}
              fileName={upload.fileName}
              onRetry={() => void upload.retry()}
            />
          )}
          <input
            ref={inputRef}
            type="file"
            accept={fileAcceptAttribute(kinds)}
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
