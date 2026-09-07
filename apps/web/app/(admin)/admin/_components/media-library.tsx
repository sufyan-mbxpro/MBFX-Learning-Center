"use client";

// The MediaLibrary (ADR-034 §5) — full-page mode. Grid + kind filter + text
// search (client-side, over the already-fetched list — the same "filtered
// in memory" posture the ADR accepts for tags) + upload + a detail dialog
// (title/alt/folder/tags, usage, replace, delete).
//
// Shared by the standalone Content → Media screen (`/admin/media`) and the
// paused Website Builder's own media screen (ADR-037) — moved here rather
// than duplicated so both stay in sync with one implementation.
//
// Deferred, named here rather than silently skipped: a folder TREE (this
// pass edits `folder` as a plain path field, no tree nav or drag-to-move),
// tag autocomplete, and the composer's `mode: "select"` picker host —
// nothing consumes it yet (the composer is paused per ADR-037), so
// building it now would be unverifiable. Upload/replace now show real
// percentage progress (`useUploadProgress`, XHR against `admin/api/
// uploads/*` — a Server Action's transport exposes no progress events).
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FileText, Music, Trash2, Upload, Video } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Empty, EmptyTitle } from "@repo/ui/components/empty";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { deleteMediaAction, updateMediaMetaAction } from "../_actions/media-actions.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { useUploadProgress } from "../_hooks/use-upload-progress.ts";
import { UploadProgress } from "./upload-progress.tsx";
import type { StoredMediaAsset } from "@repo/core";

export interface MediaAssetRow {
  id: string;
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  title: string | null;
  altText: string | null;
  folder: string;
  tags: string[];
  usageCount: number;
}

interface MediaLabels {
  title: string;
  upload: string;
  searchPlaceholder: string;
  allKind: string;
  imageKind: string;
  videoKind: string;
  audioKind: string;
  documentKind: string;
  noResults: string;
  detailTitle: string;
  titleLabel: string;
  altTextLabel: string;
  folderLabel: string;
  tagsLabel: string;
  tagsHint: string;
  usageCount: string;
  replace: string;
  save: string;
  delete: string;
  close: string;
  cancel: string;
  confirm: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
}

const KIND_TABS = ["all", "IMAGE", "VIDEO", "AUDIO", "DOCUMENT"] as const;
type KindTab = (typeof KIND_TABS)[number];

function AssetThumbnail({ asset }: { asset: MediaAssetRow }) {
  if (asset.kind === "IMAGE") {
    return (
      <div className="relative size-full">
        <Image
          src={asset.url}
          alt={asset.altText ?? ""}
          fill
          sizes="200px"
          className="object-cover"
        />
      </div>
    );
  }
  const Icon = asset.kind === "VIDEO" ? Video : asset.kind === "AUDIO" ? Music : FileText;
  return (
    <div className="flex size-full items-center justify-center bg-muted">
      <Icon aria-hidden className="size-8 text-muted-foreground" />
    </div>
  );
}

function AssetDetailDialog({
  asset,
  labels,
  open,
  onOpenChange,
  canManage,
}: {
  asset: MediaAssetRow;
  labels: MediaLabels;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const [title, setTitle] = useState(asset.title ?? "");
  const [altText, setAltText] = useState(asset.altText ?? "");
  const [folder, setFolder] = useState(asset.folder);
  const [tagsText, setTagsText] = useState(asset.tags.join(", "));
  const { run, pending } = useServerAction();
  const router = useRouter();
  const replaceUpload = useUploadProgress<StoredMediaAsset>(
    `/admin/api/uploads/media/${asset.id}`,
    {
      autoResetMs: 2500,
    },
  );
  const replaceInputRef = useRef<HTMLInputElement>(null);

  function save() {
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    run(
      () =>
        updateMediaMetaAction(asset.id, {
          title: title || null,
          altText: altText || null,
          folder,
          tags,
        }),
      { onDone: () => onOpenChange(false) },
    );
  }

  function onReplaceFileChosen(file: File | undefined) {
    if (!file) return;
    void replaceUpload.upload(file).then((stored) => {
      if (stored) router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.detailTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="aspect-video overflow-hidden rounded-md border">
            <AssetThumbnail asset={asset} />
          </div>
          <p className="text-xs text-muted-foreground">
            {asset.fileName} · {asset.mimeType} · {Math.round(asset.size / 1024)} KB
          </p>
          <p className="text-xs text-muted-foreground">
            {labels.usageCount}: {asset.usageCount}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="media-title">{labels.titleLabel}</Label>
            <Input
              id="media-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canManage}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="media-alt">{labels.altTextLabel}</Label>
            <Input
              id="media-alt"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              disabled={!canManage}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="media-folder">{labels.folderLabel}</Label>
            <Input
              id="media-folder"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              disabled={!canManage}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="media-tags">{labels.tagsLabel}</Label>
            <Input
              id="media-tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder={labels.tagsHint}
              disabled={!canManage}
            />
          </div>
          {canManage && (
            <input
              ref={replaceInputRef}
              type="file"
              className="hidden"
              onChange={(e) => onReplaceFileChosen(e.target.files?.[0])}
            />
          )}
          {canManage && replaceUpload.status !== "idle" && (
            <UploadProgress
              status={replaceUpload.status}
              progress={replaceUpload.progress}
              error={replaceUpload.error}
              fileName={replaceUpload.fileName}
              onRetry={() =>
                void replaceUpload.retry().then((stored) => stored && router.refresh())
              }
            />
          )}
        </div>
        <DialogFooter className="justify-between">
          {canManage ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pending || replaceUpload.status === "uploading"}
                onClick={() => replaceInputRef.current?.click()}
              >
                {labels.replace}
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" className="text-destructive" disabled={pending}>
                    {labels.delete}
                  </Button>
                }
                title={labels.confirmDeleteTitle}
                description={labels.confirmDeleteBody}
                confirmLabel={labels.confirm}
                cancelLabel={labels.cancel}
                onConfirm={() =>
                  run(() => deleteMediaAction(asset.id), { onDone: () => onOpenChange(false) })
                }
              />
            </div>
          ) : (
            <span />
          )}
          {canManage && (
            <Button size="sm" disabled={pending} onClick={save}>
              {labels.save}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MediaLibrary({
  assets,
  canUpload,
  canManage,
  labels,
}: {
  assets: MediaAssetRow[];
  canUpload: boolean;
  canManage: boolean;
  labels: MediaLabels;
}) {
  const [kindTab, setKindTab] = useState<KindTab>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MediaAssetRow | null>(null);
  // changes-08 #10: replace/delete straight from the grid tile, without
  // opening the detail dialog first. ONE upload hook and ONE file input
  // for the whole grid, retargeted by `replaceTarget` — a hidden input and
  // an XHR per tile would scale with the library, and the file picker
  // resolves long after the re-render that moves the URL, so the upload
  // always posts to the asset the admin clicked.
  const [replaceTarget, setReplaceTarget] = useState<MediaAssetRow | null>(null);
  const router = useRouter();
  const { run } = useServerAction();
  const upload = useUploadProgress<StoredMediaAsset>("/admin/api/uploads/media", {
    autoResetMs: 2500,
  });
  const replaceUpload = useUploadProgress<StoredMediaAsset>(
    replaceTarget ? `/admin/api/uploads/media/${replaceTarget.id}` : "/admin/api/uploads/media",
    { autoResetMs: 2500 },
  );
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const kindLabel: Record<KindTab, string> = {
    all: labels.allKind,
    IMAGE: labels.imageKind,
    VIDEO: labels.videoKind,
    AUDIO: labels.audioKind,
    DOCUMENT: labels.documentKind,
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (kindTab !== "all" && asset.kind !== kindTab) return false;
      if (!q) return true;
      return (
        asset.fileName.toLowerCase().includes(q) ||
        (asset.title ?? "").toLowerCase().includes(q) ||
        (asset.altText ?? "").toLowerCase().includes(q) ||
        asset.tags.some((t) => t.includes(q))
      );
    });
  }, [assets, kindTab, query]);

  function onUploadFileChosen(file: File | undefined) {
    if (!file) return;
    void upload.upload(file).then((stored) => {
      if (stored) router.refresh();
    });
  }

  function startReplace(asset: MediaAssetRow) {
    setReplaceTarget(asset);
    replaceInputRef.current?.click();
  }

  function onReplaceFileChosen(file: File | undefined) {
    if (!file) return;
    void replaceUpload.upload(file).then((stored) => {
      if (stored) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={kindTab} onValueChange={(v) => setKindTab(v as KindTab)}>
          <TabsList>
            {KIND_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {kindLabel[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="w-56"
          />
          {canUpload && (
            <>
              <input
                ref={uploadInputRef}
                type="file"
                className="hidden"
                onChange={(e) => onUploadFileChosen(e.target.files?.[0])}
              />
              <Button
                size="sm"
                disabled={upload.status === "uploading"}
                onClick={() => uploadInputRef.current?.click()}
              >
                {labels.upload}
              </Button>
            </>
          )}
        </div>
      </div>

      {canUpload && upload.status !== "idle" && (
        <UploadProgress
          status={upload.status}
          progress={upload.progress}
          error={upload.error}
          fileName={upload.fileName}
          onRetry={() => void upload.retry().then((stored) => stored && router.refresh())}
        />
      )}

      {canManage && (
        <input
          ref={replaceInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            onReplaceFileChosen(e.target.files?.[0]);
            // Clear it, so replacing the same file twice still fires change.
            e.target.value = "";
          }}
        />
      )}
      {canManage && replaceUpload.status !== "idle" && (
        <UploadProgress
          status={replaceUpload.status}
          progress={replaceUpload.progress}
          error={replaceUpload.error}
          fileName={replaceUpload.fileName}
          onRetry={() => void replaceUpload.retry().then((stored) => stored && router.refresh())}
        />
      )}

      {filtered.length === 0 ? (
        <Empty className="border">
          <EmptyTitle>{labels.noResults}</EmptyTitle>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((asset) => (
            // A div, not a button: the hover actions are themselves
            // buttons, and a button inside a button is invalid HTML that
            // browsers un-nest — which broke the click target. The tile's
            // own "open details" button is a sibling of the actions
            // instead, and the actions sit above it in the stacking order.
            <div
              key={asset.id}
              className="group card-hover relative overflow-hidden rounded-lg border"
            >
              <button
                type="button"
                className="flex w-full flex-col text-start"
                onClick={() => setSelected(asset)}
              >
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  <AssetThumbnail asset={asset} />
                </div>
                <div className="flex flex-col gap-1 p-2">
                  <span className="truncate text-xs font-medium">
                    {asset.title || asset.fileName}
                  </span>
                  <Badge variant="outline" className="w-fit">
                    {kindLabel[asset.kind]}
                  </Badge>
                </div>
              </button>

              {canManage && (
                // Hidden until hover — but ALSO shown on keyboard focus
                // (focus-within) and on coarse pointers, where there is no
                // hover at all. "Reveal on hover" that only reveals on
                // hover is unreachable by half the people using it.
                <div className="absolute end-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    aria-label={`${labels.replace}: ${asset.title || asset.fileName}`}
                    title={labels.replace}
                    disabled={replaceUpload.status === "uploading"}
                    onClick={() => startReplace(asset)}
                  >
                    <Upload aria-hidden className="size-3.5" />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        className="text-destructive"
                        aria-label={`${labels.delete}: ${asset.title || asset.fileName}`}
                        title={labels.delete}
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                      </Button>
                    }
                    title={labels.confirmDeleteTitle}
                    description={labels.confirmDeleteBody}
                    confirmLabel={labels.confirm}
                    cancelLabel={labels.cancel}
                    onConfirm={() => run(() => deleteMediaAction(asset.id))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <AssetDetailDialog
          asset={selected}
          labels={labels}
          open={Boolean(selected)}
          onOpenChange={(open) => !open && setSelected(null)}
          canManage={canManage}
        />
      )}
    </div>
  );
}
