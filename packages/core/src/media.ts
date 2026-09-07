// Media uploads (changes-02, ADR-017). The ONE path bytes take into
// storage: size cap → magic-byte sniff → random key → storage driver →
// MediaAsset row → audit. The client's declared type/extension is never
// consulted (security.md #9: validate server-side), and nothing here ever
// fetches a URL (no SSRF surface).
//
// Storage driver: local disk today; S3 is the named seam (ADR-017) —
// implement `StorageDriver` against the bucket and select it in
// `resolveStorageDriver()`; nothing above the driver changes.
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { revalidateTag } from "next/cache";
import { db, type MediaKind } from "@repo/db";
import type { SettingKey, UploadPurpose } from "@repo/contracts";
import { getSetting } from "@repo/settings";
import { recordAudit } from "./index.ts";
import { revalidatePageTags } from "./cms/revalidate.ts";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class UploadRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadRejectedError";
  }
}

// ADR-034 §3-4 — replace-in-place and the usage-guarded delete.

export class MediaAssetNotFoundError extends Error {
  constructor(id: string) {
    super(`Media asset not found: ${id}`);
    this.name = "MediaAssetNotFoundError";
  }
}

export class MediaAssetInUseError extends Error {
  constructor(public usageBySourceType: Record<string, number>) {
    const summary = Object.entries(usageBySourceType)
      .map(([type, count]) => `${count} ${type.toLowerCase()}`)
      .join(", ");
    super(`Media asset is referenced by ${summary} — remove those placements first`);
    this.name = "MediaAssetInUseError";
  }
}

export interface SniffedImage {
  mimeType: string;
  extension: "png" | "jpg" | "gif" | "webp" | "ico" | "svg";
}

/**
 * The third sniffing outcome (ADR-049 §6): the bytes ARE an SVG, and the
 * SVG is refused for carrying a `<script>` element or an `on*=` handler.
 *
 * A distinct TYPE rather than a `SniffedImage`-shaped sentinel on purpose —
 * it has no `mimeType`, so any caller that forgets to handle it fails
 * typecheck instead of silently treating a scripted SVG as a valid image.
 * The refusal is unchanged; only what the admin is told about it changes.
 */
export const UNSAFE_SVG = { rejected: "unsafe-svg" } as const;
export type UnsafeSvg = typeof UNSAFE_SVG;

export function isUnsafeSvg(
  result: SniffedImage | SniffedMedia | UnsafeSvg | null,
): result is UnsafeSvg {
  return result === UNSAFE_SVG;
}

const UNSAFE_SVG_MESSAGE =
  "This SVG contains a script or an event handler, so it cannot be uploaded. Export it without scripting, or use a PNG or WebP instead.";

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

/**
 * Identify an image by its leading bytes. SVG has no binary magic, so it is
 * recognised by a leading `<svg` / `<?xml` after optional BOM/whitespace —
 * and only when the document contains no `<script` element, which is the
 * one SVG feature the serving CSP (ADR-017) cannot fully neutralise inside
 * an <img>-less context like a direct navigation.
 */
export function sniffImageType(bytes: Uint8Array): SniffedImage | UnsafeSvg | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39)) {
    return { mimeType: "image/gif", extension: "gif" };
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) {
    return { mimeType: "image/x-icon", extension: "ico" };
  }
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, Math.min(bytes.length, 512)))
    .replace(/^\uFEFF/, "")
    .trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    const whole = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    // ADR-049 §6: still refused, but no longer as an anonymous `null`. The
    // caller can now tell "this is an SVG carrying executable content" from
    // "this is not an image at all" and say so — the old behaviour told an
    // admin their SVG was not an SVG.
    if (/<script[\s>]/i.test(whole) || /\son[a-z]+\s*=/i.test(whole)) return UNSAFE_SVG;
    return { mimeType: "image/svg+xml", extension: "svg" };
  }
  return null;
}

/** Every extension a magic-byte sniffer in this file can produce (ADR-034 §1). */
export type MediaExtension = SniffedImage["extension"] | "mp4" | "webm" | "m4a" | "mp3" | "pdf";

/** Random, extension-bearing object key — never derived from the client filename. */
export function generateObjectKey(extension: MediaExtension): string {
  return `${randomBytes(12).toString("hex")}.${extension}`;
}

export const OBJECT_KEY_PATTERN = /^[a-f0-9]{24}\.(png|jpg|gif|webp|ico|svg|mp4|webm|m4a|mp3|pdf)$/;

export interface StorageDriver {
  /** Persist bytes under `key`; returns the URL pages should embed. */
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<string>;
  /** Raw bytes for a key this driver stored, or null when absent. */
  get(key: string): Promise<Uint8Array | null>;
  /** Remove a key this driver stored — best-effort; a missing key is not an error (ADR-034 §3: the old object, after replace). */
  delete(key: string): Promise<void>;
}

/**
 * Local-disk driver. Files live under UPLOADS_DIR (default
 * `<cwd>/storage/uploads`, git-ignored) and are served by the
 * `/uploads/[file]` route handler — never straight from the filesystem.
 */
export function createLocalDiskStorage(rootDir = uploadsRootDir()): StorageDriver {
  return {
    async put(key, bytes) {
      await mkdir(rootDir, { recursive: true });
      await writeFile(join(rootDir, key), bytes, { flag: "wx" });
      return `/uploads/${key}`;
    },
    async get(key) {
      if (!OBJECT_KEY_PATTERN.test(key)) return null;
      try {
        return new Uint8Array(await readFile(join(rootDir, key)));
      } catch {
        return null;
      }
    },
    async delete(key) {
      if (!OBJECT_KEY_PATTERN.test(key)) return;
      await rm(join(rootDir, key), { force: true });
    },
  };
}

export function uploadsRootDir(): string {
  // turbopackIgnore: this never feeds a require()/import() — it only builds
  // a string for Node's fs calls below — but Turbopack's static analysis
  // can't tell that from a cwd()-relative resolve() and defensively traces
  // the whole project (public folder included) into the server bundle.
  return resolve(
    /* turbopackIgnore: true */ process.env.UPLOADS_DIR ??
      join(process.cwd(), "storage", "uploads"),
  );
}

let driver: StorageDriver | null = null;

/** The configured driver — local disk until an S3 driver lands (ADR-017). */
export function resolveStorageDriver(): StorageDriver {
  driver ??= createLocalDiskStorage();
  return driver;
}

/** Test seam: swap the driver (pass null to restore the default). */
export function setStorageDriverForTests(next: StorageDriver | null): void {
  driver = next;
}

export interface StoredImage {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  fileName: string;
}

export interface StoreImageInput {
  bytes: Uint8Array;
  fileName: string;
  purpose: UploadPurpose;
}

/** Pure checks shared by the service and its unit tests — unchanged since ADR-017; `storeMedia`'s per-kind, settings-backed cap (below) is the path every new caller uses. */
export function validateImageUpload(bytes: Uint8Array): SniffedImage {
  if (bytes.length === 0) throw new UploadRejectedError("The file is empty");
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new UploadRejectedError(
      `The file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
    );
  }
  const sniffed = sniffImageType(bytes);
  if (isUnsafeSvg(sniffed)) throw new UploadRejectedError(UNSAFE_SVG_MESSAGE);
  if (!sniffed) {
    throw new UploadRejectedError("Only PNG, JPEG, GIF, WebP, ICO or SVG images are accepted");
  }
  return sniffed;
}

// ─── Media v2 (ADR-034) ──────────────────────────────────────

type SniffedMedia = { kind: MediaKind; mimeType: string; extension: MediaExtension };

/** ISO-BMFF container (mp4/m4a share it) — the "ftyp" box at offset 4; the major brand at offset 8-11 tells audio-only (M4A) from video (everything else, incl. mp4/mov/m4v). */
function sniffIsoBmff(bytes: Uint8Array): SniffedMedia | null {
  if (bytes.length < 12 || !startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return null;
  const brand = new TextDecoder("ascii", { fatal: false }).decode(bytes.subarray(8, 12));
  if (brand.startsWith("M4A")) return { kind: "AUDIO", mimeType: "audio/mp4", extension: "m4a" };
  return { kind: "VIDEO", mimeType: "video/mp4", extension: "mp4" };
}

/** EBML magic — covers WebM (and Matroska, which this MVP does not distinguish; both are "video/webm" here). */
function sniffWebm(bytes: Uint8Array): SniffedMedia | null {
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { kind: "VIDEO", mimeType: "video/webm", extension: "webm" };
  }
  return null;
}

/** An ID3v2 tag or a bare MPEG audio frame sync (11 set bits). */
function sniffMp3(bytes: Uint8Array): SniffedMedia | null {
  if (startsWith(bytes, [0x49, 0x44, 0x33]))
    return { kind: "AUDIO", mimeType: "audio/mpeg", extension: "mp3" };
  if (bytes.length >= 2 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0) {
    return { kind: "AUDIO", mimeType: "audio/mpeg", extension: "mp3" };
  }
  return null;
}

function sniffPdf(bytes: Uint8Array): SniffedMedia | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { kind: "DOCUMENT", mimeType: "application/pdf", extension: "pdf" };
  }
  return null;
}

/** Every kind this file knows how to recognise, tried in a fixed order — signatures do not overlap, so order only matters for readability. */
export function sniffMediaType(bytes: Uint8Array): SniffedMedia | UnsafeSvg | null {
  const image = sniffImageType(bytes);
  // A scripted SVG is passed through as its own outcome rather than falling
  // to the video/audio/document sniffers — it is an image, it is refused,
  // and the caller says why (ADR-049 §6).
  if (isUnsafeSvg(image)) return image;
  if (image) return { kind: "IMAGE", mimeType: image.mimeType, extension: image.extension };
  return sniffIsoBmff(bytes) ?? sniffWebm(bytes) ?? sniffMp3(bytes) ?? sniffPdf(bytes);
}

const DEFAULT_MAX_BYTES: Record<MediaKind, number> = {
  IMAGE: 5 * 1024 * 1024,
  VIDEO: 100 * 1024 * 1024,
  AUDIO: 20 * 1024 * 1024,
  DOCUMENT: 20 * 1024 * 1024,
};

const MAX_BYTES_SETTING_KEY: Record<MediaKind, SettingKey> = {
  IMAGE: "media.maxBytes.image",
  VIDEO: "media.maxBytes.video",
  AUDIO: "media.maxBytes.audio",
  DOCUMENT: "media.maxBytes.document",
};

const KIND_LABEL: Record<MediaKind, string> = {
  IMAGE: "PNG, JPEG, GIF, WebP, ICO or SVG images",
  VIDEO: "MP4 or WebM videos",
  AUDIO: "MP3 or M4A audio files",
  DOCUMENT: "PDF documents",
};

/** `media.maxBytes.{kind}` (ADR-034 §1) — a missing/unseeded row falls back to the ADR's own defaults rather than failing every upload. */
async function getMaxBytesForKind(kind: MediaKind): Promise<number> {
  const value = await getSetting(MAX_BYTES_SETTING_KEY[kind]);
  return typeof value === "number" ? value : DEFAULT_MAX_BYTES[kind];
}

/**
 * The `storeMedia()` half of `validateImageUpload` — decides by magic
 * bytes, never the client's declared type, and checks the per-KIND cap
 * only once the kind is known. `allowedKinds` narrows acceptance (e.g.
 * `storeImage` passes `["IMAGE"]`) without duplicating the sniffing logic.
 */
export async function validateMediaUpload(
  bytes: Uint8Array,
  allowedKinds?: MediaKind[],
): Promise<SniffedMedia> {
  if (bytes.length === 0) throw new UploadRejectedError("The file is empty");
  const sniffed = sniffMediaType(bytes);
  if (isUnsafeSvg(sniffed)) throw new UploadRejectedError(UNSAFE_SVG_MESSAGE);
  if (!sniffed || (allowedKinds && !allowedKinds.includes(sniffed.kind))) {
    const kinds = allowedKinds ?? (["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"] as const);
    throw new UploadRejectedError(
      `Only ${kinds.map((k) => KIND_LABEL[k]).join(", ")} are accepted`,
    );
  }
  const maxBytes = await getMaxBytesForKind(sniffed.kind);
  if (bytes.length > maxBytes) {
    throw new UploadRejectedError(
      `The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB`,
    );
  }
  return sniffed;
}

export interface StoredMediaAsset {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  fileName: string;
  kind: MediaKind;
}

export interface StoreMediaInput {
  bytes: Uint8Array;
  fileName: string;
  purpose: UploadPurpose;
  /** Restricts which kinds this call accepts — omit to accept any of the four. */
  allowedKinds?: MediaKind[];
}

export async function storeMedia(
  actorId: string,
  input: StoreMediaInput,
): Promise<StoredMediaAsset> {
  const sniffed = await validateMediaUpload(input.bytes, input.allowedKinds);
  const key = generateObjectKey(sniffed.extension);
  const url = await resolveStorageDriver().put(key, input.bytes, sniffed.mimeType);
  // Display-only: keep the original name for the media list, trimmed to
  // the column width and stripped of path separators.
  const fileName = input.fileName.replace(/^.*[\\/]/, "").slice(0, 255) || key;

  const row = await db.mediaAsset.create({
    data: {
      key,
      url,
      fileName,
      mimeType: sniffed.mimeType,
      size: input.bytes.length,
      purpose: input.purpose,
      uploadedBy: actorId,
      kind: sniffed.kind,
    },
  });
  await recordAudit({
    userId: actorId,
    action: "media.upload",
    entityType: "mediaAsset",
    entityId: row.id,
    changes: {
      after: {
        key,
        mimeType: sniffed.mimeType,
        size: row.size,
        purpose: input.purpose,
        kind: sniffed.kind,
      },
    },
  });
  return {
    id: row.id,
    url,
    mimeType: sniffed.mimeType,
    size: row.size,
    fileName,
    kind: sniffed.kind,
  };
}

/** Thin wrapper, kind-restricted to IMAGE (ADR-034 §1) — Module 15's callers do not change. */
export async function storeImage(actorId: string, input: StoreImageInput): Promise<StoredImage> {
  return storeMedia(actorId, { ...input, allowedKinds: ["IMAGE"] });
}

export interface StoredFile {
  bytes: Uint8Array;
  mimeType: string;
}

/**
 * For the serving route: only keys the MediaAsset table knows are served,
 * with the MIME recorded at upload (never re-sniffed from the request).
 */
export async function readStoredFile(key: string): Promise<StoredFile | null> {
  if (!OBJECT_KEY_PATTERN.test(key)) return null;
  const row = await db.mediaAsset.findUnique({ where: { key }, select: { mimeType: true } });
  if (!row) return null;
  const bytes = await resolveStorageDriver().get(key);
  if (!bytes) return null;
  return { bytes, mimeType: row.mimeType };
}

export async function loadMediaAsset(id: string): Promise<StoredImage | null> {
  const row = await db.mediaAsset.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    mimeType: row.mimeType,
    size: row.size,
    fileName: row.fileName,
  };
}

// ─── The library (ADR-034 §5) ───────────────────────────────

export interface MediaAssetRow {
  id: string;
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: MediaKind;
  title: string | null;
  altText: string | null;
  folder: string;
  tags: string[];
  posterAssetId: string | null;
  createdAt: Date;
  usageCount: number;
}

interface RawMediaAssetRow {
  id: string;
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: MediaKind;
  title: string | null;
  altText: string | null;
  folder: string;
  tags: unknown;
  posterAssetId: string | null;
  createdAt: Date;
}

function toMediaAssetRow(row: RawMediaAssetRow, usageCount: number): MediaAssetRow {
  return {
    id: row.id,
    key: row.key,
    url: row.url,
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.size,
    kind: row.kind,
    title: row.title,
    altText: row.altText,
    folder: row.folder,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    posterAssetId: row.posterAssetId,
    createdAt: row.createdAt,
    usageCount,
  };
}

async function usageCountsByAssetId(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db.contentReference.groupBy({
    by: ["refId"],
    where: { refType: "MEDIA", refId: { in: ids } },
    _count: { refId: true },
  });
  return new Map(rows.map((r) => [r.refId, r._count.refId]));
}

/** Text search covers `fileName`/`title`/`altText`; tags are JSON (ADR-034 Consequences: not indexable on MariaDB) and are filtered in memory over this page of results. */
export async function listMediaAssets(filter?: {
  kind?: MediaKind;
  query?: string;
  tag?: string;
}): Promise<MediaAssetRow[]> {
  const rows = await db.mediaAsset.findMany({
    where: {
      deletedAt: null,
      kind: filter?.kind,
      ...(filter?.query
        ? {
            OR: [
              { fileName: { contains: filter.query } },
              { title: { contains: filter.query } },
              { altText: { contains: filter.query } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  const usage = await usageCountsByAssetId(rows.map((r) => r.id));
  const mapped = rows.map((r) => toMediaAssetRow(r, usage.get(r.id) ?? 0));
  if (!filter?.tag) return mapped;
  const tag = filter.tag.toLowerCase();
  return mapped.filter((r) => r.tags.some((t) => t.toLowerCase() === tag));
}

/**
 * PR 3.3 — the batched lookup `@repo/blocks/render`'s `RenderContext.
 * resolveMediaUrls` needs (ADR-029's own anticipated shape, "fold it into
 * the same collect/resolve pipeline as links, not bolt an async call onto
 * pass 3"). A soft-deleted or missing id is simply absent from the
 * result — the renderer's own `resolveMediaUrl` falls back to `""` for
 * anything not in the map, same "never crash on missing data" contract
 * every other resolver in this pipeline follows.
 */
export async function getMediaUrls(assetIds: string[]): Promise<Record<string, string>> {
  if (assetIds.length === 0) return {};
  const rows = await db.mediaAsset.findMany({
    where: { id: { in: [...new Set(assetIds)] }, deletedAt: null },
    select: { id: true, url: true },
  });
  return Object.fromEntries(rows.map((r) => [r.id, r.url]));
}

export async function getMediaAssetDetail(id: string): Promise<MediaAssetRow | null> {
  const row = await db.mediaAsset.findUnique({ where: { id } });
  if (!row || row.deletedAt) return null;
  const usage = await usageCountsByAssetId([id]);
  return toMediaAssetRow(row, usage.get(id) ?? 0);
}

export interface UpdateMediaMetaInput {
  title?: string | null;
  altText?: string | null;
  folder?: string;
  tags?: string[];
}

export async function updateMediaMeta(
  actorId: string,
  id: string,
  input: UpdateMediaMetaInput,
): Promise<void> {
  const existing = await db.mediaAsset.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new MediaAssetNotFoundError(id);

  await db.mediaAsset.update({
    where: { id },
    data: {
      title: input.title,
      altText: input.altText,
      folder: input.folder,
      tags: input.tags !== undefined ? (input.tags as never) : undefined,
    },
  });
  await recordAudit({
    userId: actorId,
    action: "media.update",
    entityType: "mediaAsset",
    entityId: id,
    changes: { after: input },
  });
}

/**
 * Every `ContentReference` row pointing at this asset, revalidated by its
 * owning tag. `PAGE_VERSION` sources resolve to a real `page:{id}` +
 * `page-path:{locale}:{path}` invalidation (ADR-025); `BRAND` revalidates
 * `theme` (the tag `getBrandAssets()` reads under, ADR-035); every other
 * source type revalidates its own frozen tag where one exists, or falls
 * back to `content` — coarse, but safe. `SETTING`/`COURSE`/`MENU_ITEM`
 * (icon) never appear here yet: ADR-035 named them as not wired (no
 * write path for Course/MenuItem icon; Setting's generic value shape made
 * wiring disproportionate for two keys) — the fallback below is dead code
 * for those three until one of them gets wired.
 */
async function invalidateMediaReferences(assetId: string): Promise<void> {
  const refs = await db.contentReference.findMany({
    where: { refType: "MEDIA", refId: assetId },
    select: { sourceType: true, sourceId: true },
  });
  if (refs.length === 0) return;

  const pageVersionIds = refs.filter((r) => r.sourceType === "PAGE_VERSION").map((r) => r.sourceId);
  if (pageVersionIds.length > 0) {
    const versions = await db.pageVersion.findMany({
      where: { id: { in: pageVersionIds } },
      select: { pageId: true },
    });
    const pageIds = [...new Set(versions.map((v) => v.pageId))];
    const pages = await db.page.findMany({
      where: { id: { in: pageIds } },
      select: {
        id: true,
        kind: true,
        contentType: true,
        translations: { select: { locale: true, path: true } },
      },
    });
    for (const page of pages) {
      revalidatePageTags({
        id: page.id,
        translations: page.translations,
        kind: page.kind,
        contentType: page.contentType,
      });
    }
  }

  for (const ref of refs) {
    if (ref.sourceType === "PAGE_VERSION") continue; // handled above
    if (ref.sourceType === "MENU_ITEM") revalidateTag("navigation", { expire: 0 });
    else if (ref.sourceType === "STYLE_PRESET")
      revalidateTag(`style-preset:${ref.sourceId}`, { expire: 0 });
    else if (ref.sourceType === "CARD_TEMPLATE")
      revalidateTag(`card-template:${ref.sourceId}`, { expire: 0 });
    else if (ref.sourceType === "BRAND") revalidateTag("theme", { expire: 0 });
    else revalidateTag("content", { expire: 0 }); // ARTICLE, COURSE, SETTING, LAYOUT_TEMPLATE
  }
}

export interface ReplaceMediaInput {
  bytes: Uint8Array;
  fileName: string;
}

/**
 * New bytes under a NEW object key (so the immutable cache on the old URL
 * stays correct); same row, same id, `version + 1`; the old object is
 * removed only after every reference is invalidated (ADR-034 §3). Kind may
 * not change — a video cannot become a document by "replace".
 */
export async function replaceMedia(
  actorId: string,
  id: string,
  input: ReplaceMediaInput,
): Promise<StoredMediaAsset> {
  const existing = await db.mediaAsset.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new MediaAssetNotFoundError(id);

  const sniffed = await validateMediaUpload(input.bytes, [existing.kind]);
  const key = generateObjectKey(sniffed.extension);
  const url = await resolveStorageDriver().put(key, input.bytes, sniffed.mimeType);
  const fileName = input.fileName.replace(/^.*[\\/]/, "").slice(0, 255) || key;
  const oldKey = existing.key;

  await db.mediaAsset.update({
    where: { id },
    data: {
      key,
      url,
      fileName,
      mimeType: sniffed.mimeType,
      size: input.bytes.length,
      version: { increment: 1 },
    },
  });

  await invalidateMediaReferences(id);
  await resolveStorageDriver().delete(oldKey);

  await recordAudit({
    userId: actorId,
    action: "media.replace",
    entityType: "mediaAsset",
    entityId: id,
    changes: { after: { key, mimeType: sniffed.mimeType, size: input.bytes.length } },
  });

  return {
    id,
    url,
    mimeType: sniffed.mimeType,
    size: input.bytes.length,
    fileName,
    kind: existing.kind,
  };
}

/**
 * Soft delete, refused while any `ContentReference` still points at the
 * asset (ADR-034 §4) — the error lists how many sources of each type.
 * There is no hard-delete UI: a soft-deleted, unreferenced row is a
 * maintenance job's job, not a screen's.
 */
export async function deleteMedia(actorId: string, id: string): Promise<void> {
  const existing = await db.mediaAsset.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new MediaAssetNotFoundError(id);

  const refs = await db.contentReference.findMany({
    where: { refType: "MEDIA", refId: id },
    select: { sourceType: true },
  });
  if (refs.length > 0) {
    const bySourceType: Record<string, number> = {};
    for (const ref of refs) bySourceType[ref.sourceType] = (bySourceType[ref.sourceType] ?? 0) + 1;
    throw new MediaAssetInUseError(bySourceType);
  }

  await db.mediaAsset.update({ where: { id }, data: { deletedAt: new Date() } });
  await recordAudit({
    userId: actorId,
    action: "media.delete",
    entityType: "mediaAsset",
    entityId: id,
    changes: { before: { key: existing.key } },
  });
}
