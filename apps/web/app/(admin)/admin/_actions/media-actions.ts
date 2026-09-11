"use server";

// Upload + brand-asset actions (changes-02, ADR-017). Gate order per
// security.md: permission FIRST (chosen by the declared purpose), then the
// contracts parse, then @repo/core does the byte validation, storage write,
// MediaAsset row and audit. The client's File.type is never consulted.
import { z } from "zod";
import {
  brandAssetKeySchema,
  listMediaAssetsQuerySchema,
  setBrandAssetSchema,
  updateMediaMetaSchema,
  uploadPurposeSchema,
  type ListMediaAssetsQuery,
  type UpdateMediaMetaInput,
} from "@repo/contracts";
import {
  clearBrandAsset,
  deleteMedia,
  listMediaAssets,
  replaceMedia,
  setBrandAsset,
  storeImage,
  storeMedia,
  updateMediaMeta,
  type ListMediaAssetsPage,
  type StoredImage,
  type StoredMediaAsset,
} from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { gateForPurpose, readUploadCategory } from "../_lib/media-upload.ts";

/**
 * FormData: `file` (the image) + `purpose`. Returns the stored asset so the
 * widget can show the preview and hand the URL/id to its form.
 */
export async function uploadImageAction(formData: FormData): Promise<StoredImage> {
  const purpose = uploadPurposeSchema.parse(formData.get("purpose"));
  const subject = await gateForPurpose(purpose);

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file was received");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return storeImage(subject.id, {
    bytes,
    fileName: file.name,
    purpose,
    category: readUploadCategory(formData),
  });
}

// ─── Media library (ADR-034, paged by ADR-067) ───────────────

/**
 * Kept for the retained (hidden) Website Builder picker — ADR-042 retains
 * that code, so it stays compiling. It returns a PAGE, not an array: under
 * ADR-067 §1 no signature in this repo may claim to hand back "the list", and
 * hidden code is not exempt. Live surfaces use `GET /admin/api/media`, which
 * can be aborted.
 */
export async function listMediaAssetsAction(query: unknown): Promise<ListMediaAssetsPage> {
  await requirePermission("media.view");
  const parsed: ListMediaAssetsQuery = listMediaAssetsQuerySchema.parse(query);
  return listMediaAssets({
    category: parsed.category,
    kind: parsed.kind,
    kinds: parsed.kinds,
    query: parsed.q,
    cursor: parsed.cursor,
    limit: parsed.limit,
  });
}

/** FormData: `file` + `category` (the kind is decided by magic bytes regardless, ADR-034 §1). */
export async function uploadMediaAction(formData: FormData): Promise<StoredMediaAsset> {
  const subject = await requirePermission("media.upload");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file was received");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return storeMedia(subject.id, {
    bytes,
    fileName: file.name,
    purpose: "content",
    category: readUploadCategory(formData),
  });
}

export async function updateMediaMetaAction(
  id: string,
  input: UpdateMediaMetaInput,
): Promise<void> {
  const subject = await requirePermission("media.update");
  await updateMediaMeta(subject.id, id, updateMediaMetaSchema.parse(input));
}

export async function replaceMediaAction(
  id: string,
  formData: FormData,
): Promise<StoredMediaAsset> {
  const subject = await requirePermission("media.update");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file was received");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return replaceMedia(subject.id, id, { bytes, fileName: file.name });
}

export async function deleteMediaAction(id: string): Promise<void> {
  const subject = await requirePermission("media.delete");
  await deleteMedia(subject.id, id);
}

export async function setBrandAssetAction(input: unknown): Promise<void> {
  const subject = await requirePermission("theme.update");
  await setBrandAsset(subject.id, setBrandAssetSchema.parse(input));
}

export async function clearBrandAssetAction(key: string): Promise<void> {
  const subject = await requirePermission("theme.update");
  await clearBrandAsset(subject.id, brandAssetKeySchema.parse(z.string().parse(key)));
}
