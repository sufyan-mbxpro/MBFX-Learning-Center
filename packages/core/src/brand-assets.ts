// Brand assets — logos & favicon (changes-02; plan.md Module 09's "Logos &
// Favicons via BrandAsset upload"). One row per slot (`BrandAsset.key`),
// pointing at a MediaAsset URL produced by media.ts. Reads ride the frozen
// `theme` cache tag (architecture.md #12): a logo swap invalidates exactly
// what a colour swap does, and both surfaces' layouts already read it.
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { db } from "@repo/db";
import { BRAND_ASSET_KEYS, type BrandAssetKey, type SetBrandAssetInput } from "@repo/contracts";
import { syncReferences } from "./cms/references.ts";
import { recordAudit } from "./index.ts";

export interface BrandAssetView {
  key: BrandAssetKey;
  url: string;
  altText: string | null;
  mimeType: string | null;
}

export type BrandAssets = Partial<Record<BrandAssetKey, BrandAssetView>>;

/** Pure DB read (admin screens, tests). */
export async function loadBrandAssets(): Promise<BrandAssets> {
  const rows = await db.brandAsset.findMany({ where: { key: { in: [...BRAND_ASSET_KEYS] } } });
  const out: BrandAssets = {};
  for (const row of rows) {
    const key = row.key as BrandAssetKey;
    out[key] = { key, url: row.url, altText: row.altText, mimeType: row.mimeType };
  }
  return out;
}

/** Cached read for both root layouts / headers (tag: theme). */
export async function getBrandAssets(): Promise<BrandAssets> {
  "use cache";
  cacheTag("theme");
  cacheLife({ revalidate: 3600 });
  return loadBrandAssets();
}

export async function setBrandAsset(actorId: string, input: SetBrandAssetInput): Promise<void> {
  const media = await db.mediaAsset.findUniqueOrThrow({ where: { id: input.mediaAssetId } });
  const before = await db.brandAsset.findUnique({ where: { key: input.key } });
  const data = {
    url: media.url,
    mediaAssetId: media.id,
    altText: input.altText ?? before?.altText ?? null,
    width: media.width,
    height: media.height,
    mimeType: media.mimeType,
    updatedBy: actorId,
  };
  await db.$transaction(async (tx) => {
    await tx.brandAsset.upsert({
      where: { key: input.key },
      update: data,
      create: { key: input.key, ...data },
    });
    // ADR-035: closes the ADR-034 usage-guard gap for BrandAsset.
    await syncReferences(tx, { sourceType: "BRAND", sourceId: input.key }, [
      { refType: "MEDIA", refId: media.id, field: "mediaAssetId" },
    ]);
  });
  await recordAudit({
    userId: actorId,
    action: "brandAssets.set",
    entityType: "brandAsset",
    entityId: input.key,
    changes: { before: before ? { url: before.url } : undefined, after: { url: media.url } },
  });
  revalidateTag("theme", { expire: 0 });
}

export async function clearBrandAsset(actorId: string, key: BrandAssetKey): Promise<void> {
  const before = await db.brandAsset.findUnique({ where: { key } });
  if (!before) return;
  await db.$transaction(async (tx) => {
    await tx.brandAsset.delete({ where: { key } });
    await syncReferences(tx, { sourceType: "BRAND", sourceId: key }, []);
  });
  await recordAudit({
    userId: actorId,
    action: "brandAssets.clear",
    entityType: "brandAsset",
    entityId: key,
    changes: { before: { url: before.url } },
  });
  revalidateTag("theme", { expire: 0 });
}
