"use client";

// A minimal, real media picker (PR 3.3) — browse already-uploaded assets or
// upload a new one, reusing the exact actions the full Media Library (PR
// 3.2) already exposes. Not the full `MediaLibrary` component in "select"
// mode ADR-034 describes (folder tree, tag filter, replace) — that's a
// larger lift than one settings-panel control justifies right now, named
// here the same way PR 3.2 named the Media Library's own scope cuts.
import * as React from "react";
import Image from "next/image";
import { FileText, Music, Upload, Video } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { cn } from "@repo/ui/lib/utils";
import { listMediaAssetsAction, uploadImageAction } from "../../../../../_actions/media-actions.ts";
import type { MediaAssetRow } from "@repo/core";

export interface MediaPickerLabels {
  choose: string;
  clear: string;
  title: string;
  search: string;
  upload: string;
  uploading: string;
  empty: string;
}

export function MediaPickerControl({
  value,
  onChange,
  labels,
}: {
  value: string;
  onChange: (assetId: string) => void;
  labels: MediaPickerLabels;
}) {
  const [open, setOpen] = React.useState(false);
  const [assets, setAssets] = React.useState<MediaAssetRow[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void listMediaAssetsAction({ q: query || undefined }).then((rows) => {
      if (!cancelled) setAssets(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("purpose", "content");
      const stored = await uploadImageAction(formData);
      onChange(stored.id);
      setOpen(false);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          {labels.choose}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            {labels.clear}
          </Button>
        )}
        {value && <code className="truncate text-xs text-muted-foreground">{value}</code>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={labels.search}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Spinner aria-label={labels.uploading} />
                ) : (
                  <Upload data-icon="inline-start" aria-hidden />
                )}
                {labels.upload}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </div>
            <div className="grid max-h-96 grid-cols-4 gap-2 overflow-y-auto">
              {assets === null ? (
                <Spinner aria-hidden />
              ) : assets.length === 0 ? (
                <p className="col-span-4 py-8 text-center text-sm text-muted-foreground">
                  {labels.empty}
                </p>
              ) : (
                assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      onChange(asset.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted/30 hover:ring-2 hover:ring-ring",
                      value === asset.id && "ring-2 ring-primary",
                    )}
                    title={asset.title ?? asset.fileName}
                  >
                    {asset.kind === "IMAGE" ? (
                      <Image src={asset.url} alt="" fill className="object-cover" unoptimized />
                    ) : asset.kind === "VIDEO" ? (
                      <Video aria-hidden className="size-6 text-muted-foreground" />
                    ) : asset.kind === "AUDIO" ? (
                      <Music aria-hidden className="size-6 text-muted-foreground" />
                    ) : (
                      <FileText aria-hidden className="size-6 text-muted-foreground" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
