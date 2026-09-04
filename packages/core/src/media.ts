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
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { db } from "@repo/db";
import type { UploadPurpose } from "@repo/contracts";
import { recordAudit } from "./index.ts";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class UploadRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadRejectedError";
  }
}

export interface SniffedImage {
  mimeType: string;
  extension: "png" | "jpg" | "gif" | "webp" | "ico" | "svg";
}

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
export function sniffImageType(bytes: Uint8Array): SniffedImage | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39)) {
    return { mimeType: "image/gif", extension: "gif" };
  }
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
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
    if (/<script[\s>]/i.test(whole) || /\son[a-z]+\s*=/i.test(whole)) return null;
    return { mimeType: "image/svg+xml", extension: "svg" };
  }
  return null;
}

/** Random, extension-bearing object key — never derived from the client filename. */
export function generateObjectKey(extension: SniffedImage["extension"]): string {
  return `${randomBytes(12).toString("hex")}.${extension}`;
}

export const OBJECT_KEY_PATTERN = /^[a-f0-9]{24}\.(png|jpg|gif|webp|ico|svg)$/;

export interface StorageDriver {
  /** Persist bytes under `key`; returns the URL pages should embed. */
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<string>;
  /** Raw bytes for a key this driver stored, or null when absent. */
  get(key: string): Promise<Uint8Array | null>;
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
  };
}

export function uploadsRootDir(): string {
  // turbopackIgnore: this never feeds a require()/import() — it only builds
  // a string for Node's fs calls below — but Turbopack's static analysis
  // can't tell that from a cwd()-relative resolve() and defensively traces
  // the whole project (public folder included) into the server bundle.
  return resolve(/* turbopackIgnore: true */ process.env.UPLOADS_DIR ?? join(process.cwd(), "storage", "uploads"));
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

/** Pure checks shared by the service and its unit tests. */
export function validateImageUpload(bytes: Uint8Array): SniffedImage {
  if (bytes.length === 0) throw new UploadRejectedError("The file is empty");
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new UploadRejectedError(
      `The file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
    );
  }
  const sniffed = sniffImageType(bytes);
  if (!sniffed) {
    throw new UploadRejectedError("Only PNG, JPEG, GIF, WebP, ICO or SVG images are accepted");
  }
  return sniffed;
}

export async function storeImage(actorId: string, input: StoreImageInput): Promise<StoredImage> {
  const sniffed = validateImageUpload(input.bytes);
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
    },
  });
  await recordAudit({
    userId: actorId,
    action: "media.upload",
    entityType: "mediaAsset",
    entityId: row.id,
    changes: { after: { key, mimeType: sniffed.mimeType, size: row.size, purpose: input.purpose } },
  });
  return { id: row.id, url, mimeType: sniffed.mimeType, size: row.size, fileName };
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
  return { id: row.id, url: row.url, mimeType: row.mimeType, size: row.size, fileName: row.fileName };
}
