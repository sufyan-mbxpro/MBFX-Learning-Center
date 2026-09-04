"use server";

// Upload + brand-asset actions (changes-02, ADR-017). Gate order per
// security.md: permission FIRST (chosen by the declared purpose), then the
// contracts parse, then @repo/core does the byte validation, storage write,
// MediaAsset row and audit. The client's File.type is never consulted.
import { z } from "zod";
import {
  brandAssetKeySchema,
  setBrandAssetSchema,
  uploadPurposeSchema,
  type UploadPurpose,
} from "@repo/contracts";
import { clearBrandAsset, setBrandAsset, storeImage, type StoredImage } from "@repo/core";
import { requireAnyPermission, requirePermission, type Subject } from "@repo/rbac";

async function gateForPurpose(purpose: UploadPurpose): Promise<Subject> {
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

export async function setBrandAssetAction(input: unknown): Promise<void> {
  const subject = await requirePermission("theme.update");
  await setBrandAsset(subject.id, setBrandAssetSchema.parse(input));
}

export async function clearBrandAssetAction(key: string): Promise<void> {
  const subject = await requirePermission("theme.update");
  await clearBrandAsset(subject.id, brandAssetKeySchema.parse(z.string().parse(key)));
}
