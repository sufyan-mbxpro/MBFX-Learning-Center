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
  type UploadPurpose,
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
  type MediaAssetRow,
  type StoredImage,
  type StoredMediaAsset,
} from "@repo/core";
import { requireAnyPermission, requirePermission, type Subject } from "@repo/rbac";

// Exported so the XHR-uploadable route handlers under `api/uploads/*`
// (real upload-progress events; see that folder's comment) reuse this
// exact gate rather than a second copy that could drift.
export async function gateForPurpose(purpose: UploadPurpose): Promise<Subject> {
  switch (purpose) {
    case "brand":
      return requirePermission("theme.update");
    case "setting":
      return requirePermission("settings.update");
    case "article":
    case "content":
      return requireAnyPermission(["analysis.update", "news.manage"]);
  }
}

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
  return storeImage(subject.id, { bytes, fileName: file.name, purpose });
}

// ─── Media library (ADR-034) ─────────────────────────────────

export async function listMediaAssetsAction(query: unknown): Promise<MediaAssetRow[]> {
  await requirePermission("media.view");
  const parsed: ListMediaAssetsQuery = listMediaAssetsQuerySchema.parse(query);
  return listMediaAssets({ kind: parsed.kind, query: parsed.q });
}

/** FormData: `file` + optional `kind` (a UI hint only — the server decides by magic bytes regardless, ADR-034 §1). */
export async function uploadMediaAction(formData: FormData): Promise<StoredMediaAsset> {
  const subject = await requirePermission("media.upload");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file was received");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return storeMedia(subject.id, { bytes, fileName: file.name, purpose: "content" });
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
