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
import { mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { revalidateTag } from "next/cache";
import { db, type MediaKind, type ReferenceSourceType } from "@repo/db";
import {
  clampPageSize,
  folderForCategory,
  categoryOfFolder,
  MEDIA_CATEGORIES,
  type MediaCategory,
  type SettingKey,
  type UploadPurpose,
} from "@repo/contracts";
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
  /**
   * Bytes `[start, end]` inclusive, without materialising the whole object.
   * Optional so an existing driver keeps working — callers fall back to
   * `get()` and slice, which is what every driver did before this existed.
   *
   * It matters at video scale: seeking in a 100 MB lesson video used to
   * allocate 100 MB per request to return a few hundred KB. changes-12 M2's
   * S3 driver implements this as a native ranged GET, so the seam is the
   * same shape at both ends.
   */
  getRange?(key: string, start: number, end: number): Promise<Uint8Array | null>;
  /** Total byte length for a key, or null when absent — lets a range be validated without a read. */
  size?(key: string): Promise<number | null>;
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
    async getRange(key, start, end) {
      if (!OBJECT_KEY_PATTERN.test(key)) return null;
      let handle;
      try {
        handle = await open(join(rootDir, key), "r");
        const length = end - start + 1;
        const buffer = new Uint8Array(length);
        const { bytesRead } = await handle.read(buffer, 0, length, start);
        return bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
      } catch {
        return null;
      } finally {
        await handle?.close();
      }
    },
    async size(key) {
      if (!OBJECT_KEY_PATTERN.test(key)) return null;
      try {
        return (await stat(join(rootDir, key))).size;
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
  /**
   * Where in the library this lands (ADR-066 §4). Required, and never
   * inferred from `purpose` — that column picks the permission gate, not the
   * shelf, and an article's header image and its inline diagram share a
   * purpose while belonging on different shelves.
   */
  category: MediaCategory;
  /** An explicit folder wins over `category`; it must still sit under a registered category. */
  folder?: string;
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

export interface StoreMediaInput extends StoreImageInput {
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
  const folder = input.folder ?? folderForCategory(input.category);
  // Never a reason to fail an upload: an unrecognised container simply has
  // no dimensions, and the grid falls back to its aspect-ratio box.
  const dimensions = sniffed.kind === "IMAGE" ? readImageDimensions(input.bytes) : null;

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
      folder,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
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
        folder,
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

// ─── Intrinsic dimensions (ADR-067 / changes-13 D7) ──────────

/**
 * Width and height from a container's header — the first few dozen bytes for
 * every format we accept. Deliberately NOT `sharp`: decoding a whole image to
 * learn two integers is the wrong trade, and the columns have been sitting
 * unpopulated since ADR-034 declared them.
 *
 * Feeds three things: a tile that reserves its space before the bytes arrive,
 * a `next/image` `srcset` computed from real intrinsics, and changes-12 M7's
 * "no upscaling" rule, whose profile choice is a function of the long edge.
 *
 * Returns null for anything it does not recognise — never throws, and never
 * blocks an upload.
 */
export function readImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // PNG: IHDR is always the first chunk, at a fixed offset.
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) && bytes.length >= 24) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  // GIF: little-endian logical screen descriptor.
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && bytes.length >= 10) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }

  // WebP: three sub-formats, each carrying the size in a different place.
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8) &&
    bytes.length >= 30
  ) {
    const format = new TextDecoder("ascii").decode(bytes.subarray(12, 16));
    if (format === "VP8 ") {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (format === "VP8L") {
      // 14 bits each, packed across four bytes, both stored minus one.
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (format === "VP8X") {
      const read24 = (offset: number) =>
        (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
      return { width: read24(24) + 1, height: read24(27) + 1 };
    }
    return null;
  }

  // JPEG: walk the marker chain to the first start-of-frame.
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return readJpegDimensions(bytes, view);

  // SVG: width/height attributes, else the viewBox's extent.
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 2048));
  if (/<svg[\s>]/i.test(head)) return readSvgDimensions(head);

  return null;
}

/** SOFn markers carry the frame size; every other segment declares its own length, so the chain is walkable without decoding. */
function readJpegDimensions(
  bytes: Uint8Array,
  view: DataView,
): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1; // resync past fill bytes rather than give up
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    // Standalone markers (padding, restart) carry no length field.
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    const length = view.getUint16(offset + 2);
    if (length < 2) return null; // malformed: a length that cannot advance
    offset += 2 + length;
  }
  return null;
}

function readSvgDimensions(head: string): { width: number; height: number } | null {
  const attribute = (name: string) => {
    const match = new RegExp(`\\b${name}\\s*=\\s*["']\\s*([0-9.]+)`, "i").exec(head);
    return match ? Number.parseFloat(match[1] ?? "") : Number.NaN;
  };
  const width = attribute("width");
  const height = attribute("height");
  if (Number.isFinite(width) && Number.isFinite(height)) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const viewBox = /\bviewBox\s*=\s*["']\s*([-\d.\s,]+)["']/i.exec(head);
  const parts =
    viewBox?.[1]
      ?.trim()
      .split(/[\s,]+/)
      .map(Number) ?? [];
  if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
    return { width: Math.round(parts[2] as number), height: Math.round(parts[3] as number) };
  }
  return null;
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

export interface StoredFileMeta {
  mimeType: string;
  size: number;
  kind: MediaKind;
  /** The original client filename, kept for display — and for a download's suggested name. */
  fileName: string;
}

/**
 * ADR-034 §1 specified `Content-Disposition: attachment` for anything that is
 * not meant to render inline, and the serving route never implemented it
 * (changes-13 §9 #6). A DOCUMENT is the one kind nothing in this repository
 * embeds: images, video and audio are placed in pages, a PDF is linked. So a
 * PDF opening same-origin is a navigation nobody asked for, into a viewer
 * whose behaviour is the browser's business, on our origin.
 *
 * Returns `null` for every other kind — the decision belongs here rather than
 * in the route handler, which composes headers and decides nothing
 * (architecture.md #1).
 *
 * Both filename forms are emitted, per RFC 6266: a quoted ASCII fallback for
 * old parsers and `filename*` (RFC 5987) for the real name. The fallback is
 * scrubbed of quotes, backslashes and control characters, because a filename
 * is attacker-adjacent input — it is whatever the uploader's file was called.
 */
export function contentDispositionFor(kind: MediaKind, fileName: string): string | null {
  if (kind !== "DOCUMENT") return null;
  // Everything outside printable ASCII goes, which is the header-injection
  // defense as well as the encoding one: CR and LF are below 0x20.
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  // A name scrubbed down to punctuation ("…" → "_") is not a filename any
  // more, so it gets a generic one rather than a row of underscores.
  const fallback = /[a-z0-9]/i.test(ascii) ? ascii.trim() : "download";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * What the serving route needs to answer a `Range` request without reading
 * the object: the MIME recorded at upload and the true byte length. The
 * driver's own `size()` wins where it has one (the file on disk is the
 * truth); the `MediaAsset.size` column is the fallback and is written by the
 * same call that stored the bytes.
 */
export async function readStoredFileMeta(key: string): Promise<StoredFileMeta | null> {
  if (!OBJECT_KEY_PATTERN.test(key)) return null;
  const row = await db.mediaAsset.findUnique({
    where: { key },
    select: { mimeType: true, size: true, kind: true, fileName: true },
  });
  if (!row) return null;
  const driver = resolveStorageDriver();
  const size = (await driver.size?.(key)) ?? row.size;
  return { mimeType: row.mimeType, size, kind: row.kind, fileName: row.fileName };
}

/**
 * Bytes `[start, end]` inclusive for a key the MediaAsset table knows.
 * Falls back to a whole-object read and a slice for a driver with no
 * `getRange` — correct either way, just not cheap.
 */
export async function readStoredFileRange(
  key: string,
  start: number,
  end: number,
): Promise<Uint8Array | null> {
  if (!OBJECT_KEY_PATTERN.test(key)) return null;
  const driver = resolveStorageDriver();
  if (driver.getRange) return driver.getRange(key, start, end);
  const bytes = await driver.get(key);
  return bytes ? bytes.subarray(start, end + 1) : null;
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
  /** What a GRID renders. Today `url` for an image; changes-12 M7 makes it the `thumb` derivative and no UI moves. */
  thumbnailUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: MediaKind;
  title: string | null;
  altText: string | null;
  folder: string;
  /** The folder's first segment (ADR-066 §1), or null for a path filed before it. */
  category: MediaCategory | null;
  width: number | null;
  height: number | null;
  tags: string[];
  posterAssetId: string | null;
  createdAt: Date;
  /** 0 unless the read asked for it — `withUsage` (ADR-067 §4). Never the delete guard's input. */
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
  width: number | null;
  height: number | null;
  tags: unknown;
  posterAssetId: string | null;
  createdAt: Date;
}

/**
 * The one place a grid tile's image URL is decided (changes-13 D6). It is an
 * identity function on an image today because no derivatives exist yet; when
 * changes-12 M7 generates them, this body returns the `thumb` row and every
 * consumer already reads it. The `StorageDriver` lesson applied to
 * derivatives: build the seam before the implementation.
 *
 * A non-image has no thumbnail — the grids render a kind icon, and an empty
 * string is the honest answer rather than a URL that would 404 into an
 * `<img>`.
 */
export function resolveThumbnailUrl(row: { url: string; kind: MediaKind }): string {
  return row.kind === "IMAGE" ? row.url : "";
}

function toMediaAssetRow(row: RawMediaAssetRow, usageCount: number): MediaAssetRow {
  return {
    id: row.id,
    key: row.key,
    url: row.url,
    thumbnailUrl: resolveThumbnailUrl(row),
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.size,
    kind: row.kind,
    title: row.title,
    altText: row.altText,
    folder: row.folder,
    category: categoryOfFolder(row.folder),
    width: row.width,
    height: row.height,
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

// ─── Paged browsing (ADR-067) ────────────────────────────────

export interface ListMediaAssetsFilter {
  /** Matches `/news` and everything beneath it — never `/newsroom`. */
  category?: MediaCategory;
  /** An exact folder; wins over `category` when both are given. */
  folder?: string;
  kind?: MediaKind;
  kinds?: MediaKind[];
  query?: string;
  tag?: string;
  cursor?: string;
  /** Clamped to [1, 100] — see `clampPageSize`. There is no "everything". */
  limit?: number;
  /** Off by default: the picker does not render usage and must not pay a groupBy for it (ADR-067 §4). */
  withUsage?: boolean;
}

export interface ListMediaAssetsPage {
  items: MediaAssetRow[];
  /** Opaque; pass back as `cursor`. Null means this was the last page. */
  nextCursor: string | null;
}

/** `createdAt|id`, base64url. The id tiebreak matters: a batch upload writes several rows in the same millisecond. */
export function encodeMediaCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

export function decodeMediaCursor(cursor: string): { createdAt: Date; id: string } | null {
  const [timestamp, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  if (!timestamp || !id) return null;
  const createdAt = new Date(timestamp);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
}

/**
 * One page of the library, newest first.
 *
 * **There is no unbounded variant of this function, and adding one needs a
 * superseding ADR** (ADR-067 §1). The owner's rule — never load the whole
 * library because a picker opened — is enforced by this signature: the return
 * type is a page, `limit` clamps, and no argument means "everything". A caller
 * who wants more asks again with `nextCursor`.
 *
 * Keyset, not offset: an admin uploading into the library they are scrolling
 * inserts rows at the top, and offset paging would repeat and skip around it.
 *
 * Text search covers `fileName`/`title`/`altText`. Tags stay JSON (ADR-034
 * Consequences: not indexable on MariaDB) and are filtered in memory — so the
 * tag filter narrows THIS page while `nextCursor` still comes from the raw
 * rows, which keeps paging correct even when a page filters down to nothing.
 */
export async function listMediaAssets(
  filter?: ListMediaAssetsFilter,
): Promise<ListMediaAssetsPage> {
  const limit = clampPageSize(filter?.limit);
  const kinds = filter?.kinds ?? (filter?.kind ? [filter.kind] : undefined);
  const cursor = filter?.cursor ? decodeMediaCursor(filter.cursor) : null;

  const conditions: Record<string, unknown>[] = [];
  if (filter?.folder) {
    conditions.push({ folder: filter.folder });
  } else if (filter?.category) {
    const folder = folderForCategory(filter.category);
    // Two clauses, not `startsWith: "/news"` — that would also match
    // `/newsroom`, and a category boundary has to be a path boundary.
    conditions.push({ OR: [{ folder }, { folder: { startsWith: `${folder}/` } }] });
  }
  if (filter?.query) {
    conditions.push({
      OR: [
        { fileName: { contains: filter.query } },
        { title: { contains: filter.query } },
        { altText: { contains: filter.query } },
      ],
    });
  }
  if (cursor) {
    conditions.push({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    });
  }

  const rows = await db.mediaAsset.findMany({
    where: {
      deletedAt: null,
      ...(kinds ? { kind: { in: kinds } } : {}),
      ...(conditions.length > 0 ? { AND: conditions } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1, // the extra row answers "is there a next page" without a count
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  const nextCursor = hasMore && last ? encodeMediaCursor(last) : null;

  const usage = filter?.withUsage
    ? await usageCountsByAssetId(page.map((r) => r.id))
    : new Map<string, number>();
  const mapped = page.map((r) => toMediaAssetRow(r, usage.get(r.id) ?? 0));

  if (!filter?.tag) return { items: mapped, nextCursor };
  const tag = filter.tag.toLowerCase();
  return { items: mapped.filter((r) => r.tags.some((t) => t.toLowerCase() === tag)), nextCursor };
}

export type MediaKindCounts = Record<MediaKind, number>;

export interface MediaFacets {
  byCategory: Record<MediaCategory, MediaKindCounts>;
  /** Across every category, including assets filed outside one. */
  total: MediaKindCounts;
}

function emptyKindCounts(): MediaKindCounts {
  return { IMAGE: 0, VIDEO: 0, AUDIO: 0, DOCUMENT: 0 };
}

/**
 * Counts per (category, kind) — one grouped aggregate, which is what lets the
 * picker show how much is behind each tab and disable a category that holds
 * nothing of the current kind. Bounded by the number of distinct folders, not
 * by the number of assets.
 */
export async function getMediaFacets(): Promise<MediaFacets> {
  const rows = await db.mediaAsset.groupBy({
    by: ["folder", "kind"],
    where: { deletedAt: null },
    _count: { _all: true },
  });

  const byCategory = Object.fromEntries(
    MEDIA_CATEGORIES.map((category) => [category, emptyKindCounts()]),
  ) as Record<MediaCategory, MediaKindCounts>;
  const total = emptyKindCounts();

  for (const row of rows) {
    const count = row._count._all;
    total[row.kind] += count;
    const category = categoryOfFolder(row.folder);
    if (category) byCategory[category][row.kind] += count;
  }
  return { byCategory, total };
}

/**
 * The assets most recently placed by this kind of source — the picker's
 * "Recently Used" strip. Most picks are re-picks of something placed minutes
 * ago, so this turns the common case into a zero-scroll case.
 *
 * Ordered by when the REFERENCE was written, not when the asset was uploaded:
 * "used recently" and "uploaded recently" are different questions, and the
 * grid beneath already answers the second.
 */
export async function getRecentlyUsedMedia(filter?: {
  sourceType?: ReferenceSourceType;
  kinds?: MediaKind[];
  limit?: number;
}): Promise<MediaAssetRow[]> {
  const limit = Math.min(Math.max(filter?.limit ?? 12, 1), 24);
  const refs = await db.contentReference.findMany({
    where: { refType: "MEDIA", ...(filter?.sourceType ? { sourceType: filter.sourceType } : {}) },
    orderBy: { createdAt: "desc" },
    // Over-fetch, because one asset placed in six fields is six rows and we
    // want `limit` distinct ASSETS. Bounded either way.
    take: limit * 5,
    select: { refId: true },
  });
  const ids = [...new Set(refs.map((r) => r.refId))].slice(0, limit);
  if (ids.length === 0) return [];

  const rows = await db.mediaAsset.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      ...(filter?.kinds ? { kind: { in: filter.kinds } } : {}),
    },
  });
  // Restore the reference order the database lost in the `in` lookup.
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toMediaAssetRow(row, 0)] : [];
  });
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

  const dimensions = sniffed.kind === "IMAGE" ? readImageDimensions(input.bytes) : null;
  await db.mediaAsset.update({
    where: { id },
    data: {
      key,
      url,
      fileName,
      mimeType: sniffed.mimeType,
      size: input.bytes.length,
      // Re-read rather than kept: replacement bytes are a different image,
      // and stale intrinsics are worse than none (they size the tile wrong).
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
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
