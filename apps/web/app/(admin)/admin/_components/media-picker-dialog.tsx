"use client";

// THE media picker (ADR-049), rebuilt paged by ADR-067.
//
// The rule this component exists to honour: **opening it never loads the
// library.** It opens on the caller's category, one kind and one page — one
// request, with the facet counts and the recently-used strip folded into it
// — and issues exactly one more request per thing the admin asks for: a
// category, a kind tab, a search, a page. `useMediaBrowser` owns all of that;
// this file is chrome and selection.
//
// Chrome order is fixed (ADR-067 §5): category and kind share one row because
// they are the same decision seen from two sides, search sits beneath because
// it is scoped by them, and Load More is a real button, not only a scroll
// sentinel — an observer alone is unreachable by keyboard.
//
// Deliberately NOT MediaLibrary with a `mode` flag: that component is the
// management UI (metadata form, replace, delete, confirms) and every branch
// of it would need guarding. This is a picker — grid in, asset out. Editing
// an asset stays on /admin/media, one implementation each.
//
// Strings resolve here via useTranslations rather than a `labels` prop,
// following upload-progress.tsx and breadcrumbs.tsx — the alternative is
// threading a dozen more props through four screens to say six words.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { FileText, ImageIcon, Link2, Music, Upload, Video } from "lucide-react";
import { ALL_MEDIA_CATEGORIES, MEDIA_CATEGORIES, webImageUrlSchema } from "@repo/contracts";
import type { MediaCategory, MediaSourceType } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { EmptyState, ErrorState } from "@repo/ui/components/empty";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { SearchInput } from "@repo/ui/components/search-input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { cn } from "@repo/ui/lib/utils";
import { AdminCombobox } from "./combobox.tsx";
import {
  invalidateMediaCache,
  useMediaBrowser,
  type CategoryFilter,
  type PickableKind,
} from "../_hooks/use-media-browser.ts";
import { useUploadProgress } from "../_hooks/use-upload-progress.ts";
import { UploadProgress } from "./upload-progress.tsx";
import { describeOversizeFile, fileAcceptAttribute } from "./media-constraints.ts";
import type { MediaAssetRow, StoredMediaAsset } from "@repo/core";
import type { UploadPurpose } from "@repo/contracts";

export type { PickableKind };

/** What a picked asset hands back. A superset of ImageUploadField's
 * `{ id, url }` so the field's own contract (ADR-035's reference wiring)
 * is unchanged, with the extras the rich-text editor needs for alt text. */
export interface PickedMedia {
  /** The asset id — EMPTY for a web address, which is not in the library. */
  id: string;
  url: string;
  fileName: string;
  altText: string | null;
  kind: PickableKind;
}

const KIND_LABEL_KEY: Record<PickableKind, string> = {
  IMAGE: "mediaKindImage",
  VIDEO: "mediaKindVideo",
  AUDIO: "mediaKindAudio",
  DOCUMENT: "mediaKindDocument",
};

function AssetTile({ asset }: { asset: MediaAssetRow }) {
  // `thumbnailUrl`, never `url` (changes-13 D6): when changes-12 M7 generates
  // derivatives, this tile already reads the right field.
  if (asset.kind === "IMAGE" && asset.thumbnailUrl) {
    return (
      <Image
        src={asset.thumbnailUrl}
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
  category,
  sourceType,
  canUpload = true,
  allowWebAddress = false,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (picked: PickedMedia) => void;
  /** Which kinds the dialog offers. The server still decides by magic
   * bytes (ADR-034 §1) — this narrows the UI, it does not grant anything. */
  kinds?: PickableKind[];
  purpose: UploadPurpose;
  /** Where this surface files its media, and where the picker opens (ADR-066 §4). */
  category: MediaCategory;
  /** Scopes the recently-used strip to this kind of surface. */
  sourceType?: MediaSourceType;
  canUpload?: boolean;
  /**
   * A "Web address" tab beside the library (changes-49). Only for a surface
   * whose value is a bare URL — the rich-text editor's image — because a
   * field that stores an ASSET id has nothing to store for a hotlink.
   */
  allowWebAddress?: boolean;
  /** Overrides the dialog heading where the calling surface has a better
   * word for what is being chosen. */
  title?: string;
}) {
  const t = useTranslations("admin");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wider than the default dialog, and deliberately: the thumbnails ARE
          the content here, and at `max-w-3xl` with four columns each one was
          about 150px — too small to tell two chart screenshots apart, which
          is the whole job of the screen. Padding and header are the Dialog's
          own (changes-20, tokens.md §6.14): it used to borrow EditorSection's
          tinted band, which made it the one modal in the admin that did not
          look like the others — a dialog header has no band in the
          reference. */}
      <DialogContent className="max-w-5xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{title ?? t("mediaPickerTitle")}</DialogTitle>
          <DialogDescription>
            {allowWebAddress ? t("dialogDesc.mediaPickerWeb") : t("dialogDesc.mediaPicker")}
          </DialogDescription>
        </DialogHeader>
        {/* The body mounts with the dialog and unmounts with it. That IS
            the reset: category, tab, query and the upload hook's state all
            go with it, so reopening starts clean. The fetched pages do NOT
            go with it — `useMediaBrowser`'s cache lives outside React, so
            reopening the same picker mid-edit is instant without stale
            component state. A field whose picker is never opened still
            costs no request. */}
        {open && (
          <div className="min-w-0">
            <MediaPickerBody
              onSelect={onSelect}
              onOpenChange={onOpenChange}
              kinds={kinds}
              purpose={purpose}
              category={category}
              sourceType={sourceType}
              canUpload={canUpload}
              allowWebAddress={allowWebAddress}
            />
          </div>
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
  category: initialCategory,
  sourceType,
  canUpload,
  allowWebAddress,
}: {
  onSelect: (picked: PickedMedia) => void;
  onOpenChange: (open: boolean) => void;
  kinds: PickableKind[];
  purpose: UploadPurpose;
  category: MediaCategory;
  sourceType?: MediaSourceType;
  canUpload: boolean;
  allowWebAddress: boolean;
}) {
  const t = useTranslations("admin");
  const [source, setSource] = useState<"library" | "web">("library");
  const [category, setCategory] = useState<CategoryFilter>(initialCategory);
  const [kind, setKind] = useState<PickableKind>(kinds[0] ?? "IMAGE");
  const [query, setQuery] = useState("");
  const [sizeError, setSizeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);

  const browser = useMediaBrowser({ category, kind, kinds, query, sourceType });
  const tError = useTranslations("error");

  const uploadUrl =
    kinds.length === 1 && kinds[0] === "IMAGE"
      ? "/admin/api/uploads/image"
      : "/admin/api/uploads/media";
  const upload = useUploadProgress<StoredMediaAsset>(uploadUrl);

  // Keyboard first: the search box is where an admin who knows what they
  // want starts, and reaching it should not cost a Tab through the chrome.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // The convenience half of "Load More". The button below is the accessible
  // half and both call the same loader, so a keyboard user is never stuck
  // behind a scroll event that will not fire for them.
  const { hasMore, loadMore, status } = browser;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || status !== "ready") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, status]);

  const pick = useCallback(
    (asset: MediaAssetRow) => {
      onSelect({
        id: asset.id,
        url: asset.url,
        fileName: asset.fileName,
        altText: asset.altText,
        kind: asset.kind as PickableKind,
      });
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

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
    const uploadCategory = category === ALL_MEDIA_CATEGORIES ? initialCategory : category;
    const stored = await upload.upload(file, { purpose, category: uploadCategory });
    if (inputRef.current) inputRef.current.value = "";
    if (stored) {
      invalidateMediaCache();
      onSelect({
        id: stored.id,
        url: stored.url,
        fileName: stored.fileName,
        altText: null,
        kind: (stored.kind ?? "IMAGE") as PickableKind,
      });
      onOpenChange(false);
    }
  };

  const categoryOptions = [
    { value: ALL_MEDIA_CATEGORIES, label: t("mediaCategoryAll") },
    ...MEDIA_CATEGORIES.map((key) => {
      const count = browser.facets?.byCategory[key]?.[kind];
      return {
        value: key,
        label:
          count === undefined
            ? t(`mediaCategory.${key}`)
            : `${t(`mediaCategory.${key}`)} (${count})`,
        // A category holding nothing of this kind is shown disabled rather
        // than hidden, so the library's shape stays legible.
        disabled: count === 0,
      };
    }),
  ];

  const uploadButton = canUpload && (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="ms-auto"
      onClick={() => inputRef.current?.click()}
      disabled={upload.status === "uploading"}
    >
      <Upload data-icon="inline-start" aria-hidden />
      {t("mediaUpload")}
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* changes-49: where the image comes from — the library or a web
          address — with "Upload from computer" at the end of the same row,
          the owner's reference layout. One button on the field opens all
          three; there is no second "upload" button anywhere else. */}
      {allowWebAddress && (
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={source} onValueChange={(value) => setSource(value as "library" | "web")}>
            <TabsList>
              <TabsTrigger value="library">
                <ImageIcon data-icon="inline-start" aria-hidden />
                {t("mediaSourceLibrary")}
              </TabsTrigger>
              <TabsTrigger value="web">
                <Link2 data-icon="inline-start" aria-hidden />
                {t("mediaSourceWeb")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {uploadButton}
        </div>
      )}

      {source === "web" ? (
        <WebAddressPane
          onInsert={(url, altText) => {
            onSelect({ id: "", url, fileName: url, altText, kind: "IMAGE" });
            onOpenChange(false);
          }}
        />
      ) : (
        <LibraryPane>
          {/* ADR-067 §5: one row, two sides of the same decision. */}
          <div className="flex flex-wrap items-center gap-2">
            <AdminCombobox
              className="w-48"
              value={category}
              onValueChange={(value) => setCategory(value as CategoryFilter)}
              options={categoryOptions}
              aria-label={t("mediaCategoryLabel")}
            />
            {kinds.length > 1 && (
              <Tabs value={kind} onValueChange={(value) => setKind(value as PickableKind)}>
                <TabsList>
                  {kinds.map((entry) => (
                    <TabsTrigger key={entry} value={entry}>
                      {t(KIND_LABEL_KEY[entry])}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            {!allowWebAddress && uploadButton}
          </div>

          <SearchInput
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("mediaSearchPlaceholder")}
            aria-label={t("mediaSearchPlaceholder")}
          />

          {sizeError && <p className="text-xs text-destructive-interactive">{sizeError}</p>}
          {upload.status !== "idle" && (
            <UploadProgress
              status={upload.status}
              progress={upload.progress}
              error={upload.error}
              fileName={upload.fileName}
              onRetry={() => void upload.retry()}
            />
          )}

          {/* Absent, not empty, when this surface has placed nothing yet.
          `min-w-0` is load-bearing (changes-22): this section is a flex item,
          so its automatic minimum width is its min-content — and the strip
          below is a row of 80px tiles that never wraps, so twelve recent
          assets asked for ~1,140px inside a 5xl dialog. The strip scrolled
          as designed, and the DIALOG scrolled too, which put the Upload
          button off the right edge of the modal. Zero here lets the section
          shrink to the dialog and hands the overflow to the strip, which is
          the element that knows how to carry it. */}
          {browser.recent.length > 0 && !query.trim() && (
            <section className="flex min-w-0 flex-col gap-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">
                {t("mediaRecentlyUsed")}
              </h3>
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {browser.recent.map((asset) => (
                  <li key={asset.id} className="w-20 shrink-0">
                    <AssetButton asset={asset} onPick={pick} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* changes-21 Phase A: the shared states — tiles in the grid's own
          columns while a page loads, ErrorState with a working retry (was red
          text with no way out), EmptyState. */}
          {browser.status === "loading" ? (
            <div
              role="status"
              aria-live="polite"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            >
              <span className="sr-only">{t("loading")}</span>
              {Array.from({ length: 10 }, (_, index) => (
                <Skeleton key={index} className="aspect-square w-full rounded-lg" />
              ))}
            </div>
          ) : browser.status === "error" ? (
            <ErrorState
              title={tError("title")}
              description={browser.error}
              action={
                <Button size="sm" variant="outline" onClick={browser.refresh}>
                  {tError("retry")}
                </Button>
              }
            />
          ) : browser.items.length === 0 ? (
            <EmptyState title={query.trim() ? t("noResults") : t("mediaCategoryEmpty")} />
          ) : (
            <>
              {/* Taller and one column wider than the dialog used to allow: at
              `max-h-96` the grid showed barely two rows, so paging through a
              category meant scrolling a 24rem window inside a 48rem box.
              Half the viewport rather than 60%, though (changes-43): with the
              header, tabs, search and recent strip above it, 60vh put the
              dialog past a 768px-tall screen, and the dialog now caps itself
              at the viewport, so the overflow became a second scrollbar. */}
              <ul className="grid max-h-(--height-half-screen) grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-5">
                {browser.items.map((asset) => (
                  <li key={asset.id}>
                    <AssetButton asset={asset} onPick={pick} />
                  </li>
                ))}
                <li ref={sentinelRef} aria-hidden className="col-span-full h-px" />
              </ul>
              {browser.hasMore && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-center"
                  disabled={browser.status === "loading-more"}
                  onClick={loadMore}
                >
                  {t("mediaLoadMore")}
                </Button>
              )}
            </>
          )}
        </LibraryPane>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={fileAcceptAttribute(kinds)}
        className="sr-only"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}

/** A fragment with a name, so the library branch above reads as one pane. */
function LibraryPane({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * The "Web address" tab (changes-49): an HTTPS image URL, previewed before it
 * is inserted. HOTLINKED — the owner's choice — so nothing is fetched by our
 * server (no SSRF surface, security.md #9) and nothing enters the library;
 * the reader's browser loads it from its own host, and it disappears if that
 * host removes it. The alt text is asked for here because there is no
 * library record to carry one.
 */
function WebAddressPane({ onInsert }: { onInsert: (url: string, altText: string | null) => void }) {
  const t = useTranslations("admin");
  const [url, setUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const parsed = webImageUrlSchema.safeParse(url);

  const insert = () => {
    if (!parsed.success) {
      setError(t("mediaWebInvalid"));
      return;
    }
    onInsert(parsed.data, altText.trim() || null);
  };

  return (
    <div className="flex flex-col gap-4">
      <Field invalid={Boolean(error)} required>
        <FieldLabel>{t("mediaWebUrlLabel")}</FieldLabel>
        <Input
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
            setBroken(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              insert();
            }
          }}
        />
        <FieldError>{error}</FieldError>
      </Field>
      <Field>
        <FieldLabel>{t("mediaWebAltLabel")}</FieldLabel>
        <Input value={altText} onChange={(e) => setAltText(e.target.value)} />
      </Field>
      <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-2">
        {parsed.success && !broken ? (
          // A plain <img>: the address is on another host, which next/image
          // would refuse without an allowlist entry per domain.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={parsed.data}
            alt={altText}
            className="max-h-64 max-w-full object-contain"
            onError={() => setBroken(true)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {broken ? t("mediaWebBroken") : t("mediaWebHint")}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={insert} disabled={url.trim() === ""}>
          {t("mediaWebInsert")}
        </Button>
      </div>
    </div>
  );
}

function AssetButton({
  asset,
  onPick,
}: {
  asset: MediaAssetRow;
  onPick: (asset: MediaAssetRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(asset)}
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
  );
}
