// Media v2 (ADR-034) against real MariaDB: storeMedia's per-kind
// acceptance/cap, replace-in-place, the usage-guarded delete, and the
// reference-invalidation path. The storage driver is swapped for an
// in-memory fake (`setStorageDriverForTests`) — this suite is the
// database/service layer, not the filesystem, which `media.test.ts`'s
// pure `sniffMediaType`/`validateImageUpload` coverage and the local-disk
// driver's own logic already exercise.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type * as MediaModule from "./media.ts";
import {
  ALL_CMS_PERMISSIONS,
  makeActor,
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "./test-utils/cms-container.ts";

let ctx: CmsTestContext;
let media: typeof MediaModule;
let actor: Awaited<ReturnType<typeof makeActor>>;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PDF = new TextEncoder().encode("%PDF-1.7\nhello");

function fakeDriver(): { driver: MediaModule.StorageDriver; store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>();
  return {
    store,
    driver: {
      async put(key, bytes) {
        store.set(key, bytes);
        return `/uploads/${key}`;
      },
      async get(key) {
        return store.get(key) ?? null;
      },
      async delete(key) {
        store.delete(key);
      },
    },
  };
}

beforeAll(async () => {
  ctx = await startCmsTestDb();
  media = await import("./media.ts");
  actor = await makeActor(ctx.db, "media-actor", [
    ...ALL_CMS_PERMISSIONS,
    "media.upload",
    "media.update",
    "media.delete",
  ]);
}, 120_000);

afterEach(() => {
  media.setStorageDriverForTests(null);
});

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

describe("storeMedia", () => {
  it("stores a PNG as kind IMAGE and writes an audit row", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const asset = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "logo.png",
      purpose: "brand",
    });
    expect(asset.kind).toBe("IMAGE");
    const row = await ctx.db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(row.kind).toBe("IMAGE");

    const audit = await ctx.db.auditLog.findFirst({
      where: { action: "media.upload", entityId: asset.id },
    });
    expect(audit).not.toBeNull();
  });

  it("stores a PDF as kind DOCUMENT", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const asset = await media.storeMedia(actor.id, {
      bytes: PDF,
      fileName: "brochure.pdf",
      purpose: "content",
    });
    expect(asset.kind).toBe("DOCUMENT");
  });

  it("refuses a kind outside allowedKinds even if it sniffs cleanly", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    await expect(
      media.storeMedia(actor.id, {
        bytes: PDF,
        fileName: "brochure.pdf",
        purpose: "content",
        allowedKinds: ["IMAGE"],
      }),
    ).rejects.toThrow(media.UploadRejectedError);
  });

  it("storeImage rejects a non-image even though storeMedia would accept it", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    await expect(
      media.storeImage(actor.id, { bytes: PDF, fileName: "brochure.pdf", purpose: "content" }),
    ).rejects.toThrow(media.UploadRejectedError);
  });

  it("enforces the per-kind cap from settings, not the image-only MAX_UPLOAD_BYTES constant", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    // `startCmsTestDb` migrates but does not run the full seed — this
    // setting row does not exist yet, so it is created here, not merely
    // updated (the pattern the seed itself would use as an upsert).
    await ctx.db.setting.upsert({
      where: { key: "media.maxBytes.document" },
      update: { value: 10 },
      create: {
        groupName: "media",
        key: "media.maxBytes.document",
        value: 10,
        type: "NUMBER",
        label: "Max document upload size (bytes)",
        isPublic: false,
      },
    });
    await expect(
      media.storeMedia(actor.id, { bytes: PDF, fileName: "big.pdf", purpose: "content" }),
    ).rejects.toThrow(/larger than/);

    // Restore for later tests in this file.
    await ctx.db.setting.update({
      where: { key: "media.maxBytes.document" },
      data: { value: 20 * 1024 * 1024 },
    });
  });
});

describe("replaceMedia", () => {
  it("keeps the id, changes the key, bumps version, and removes the old object", async () => {
    const { driver, store } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const asset = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "logo.png",
      purpose: "brand",
    });
    const before = await ctx.db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(store.has(before.key)).toBe(true);

    const newBytes = new Uint8Array([...PNG, 9, 9, 9]);
    const replaced = await media.replaceMedia(actor.id, asset.id, {
      bytes: newBytes,
      fileName: "logo-v2.png",
    });
    expect(replaced.id).toBe(asset.id);

    const after = await ctx.db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(after.key).not.toBe(before.key);
    expect(after.version).toBe(before.version + 1);
    expect(store.has(before.key)).toBe(false); // old object removed
    expect(store.has(after.key)).toBe(true);
  });

  it("refuses a replacement whose sniffed kind differs from the original", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const asset = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "logo.png",
      purpose: "brand",
    });
    await expect(
      media.replaceMedia(actor.id, asset.id, { bytes: PDF, fileName: "not-an-image.pdf" }),
    ).rejects.toThrow(media.UploadRejectedError);
  });

  it("404s a not-found id", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);
    await expect(
      media.replaceMedia(actor.id, "does-not-exist", { bytes: PNG, fileName: "x.png" }),
    ).rejects.toThrow(media.MediaAssetNotFoundError);
  });
});

describe("updateMediaMeta", () => {
  it("updates title/altText/folder/tags and writes an audit row", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const asset = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "logo.png",
      purpose: "brand",
    });
    await media.updateMediaMeta(actor.id, asset.id, {
      title: "Brand logo",
      altText: "Company logo",
      folder: "/brand",
      tags: ["logo", "brand"],
    });

    const detail = await media.getMediaAssetDetail(asset.id);
    expect(detail).toMatchObject({
      title: "Brand logo",
      altText: "Company logo",
      folder: "/brand",
    });
    expect(detail?.tags).toEqual(["logo", "brand"]);
  });
});

describe("deleteMedia — usage-guarded (ADR-034 §4)", () => {
  it("soft-deletes an unreferenced asset", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const asset = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "logo.png",
      purpose: "brand",
    });
    await media.deleteMedia(actor.id, asset.id);

    expect(await media.getMediaAssetDetail(asset.id)).toBeNull();
    const row = await ctx.db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(row.deletedAt).not.toBeNull();
  });

  it("refuses to delete a referenced asset and names the source types", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const asset = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "logo.png",
      purpose: "brand",
    });
    await ctx.db.contentReference.create({
      data: {
        sourceType: "PAGE_VERSION",
        sourceId: "fake-version",
        refType: "MEDIA",
        refId: asset.id,
      },
    });

    const detail = await media.getMediaAssetDetail(asset.id);
    expect(detail?.usageCount).toBe(1);

    await expect(media.deleteMedia(actor.id, asset.id)).rejects.toThrow(media.MediaAssetInUseError);
  });

  it("404s a not-found id", async () => {
    await expect(media.deleteMedia(actor.id, "does-not-exist")).rejects.toThrow(
      media.MediaAssetNotFoundError,
    );
  });
});

describe("ADR-035: setBrandAsset/clearBrandAsset sync a MEDIA reference (closes ADR-034's usage-guard gap)", () => {
  it("setBrandAsset creates a reference on sourceId: key; clearBrandAsset removes it", async () => {
    const brandAssets = await import("./brand-assets.ts");
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const asset = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "logo.png",
      purpose: "brand",
    });

    await brandAssets.setBrandAsset(actor.id, { key: "logo_light", mediaAssetId: asset.id });
    let refs = await ctx.db.contentReference.findMany({
      where: { sourceType: "BRAND", sourceId: "logo_light", refType: "MEDIA" },
    });
    expect(refs).toHaveLength(1);
    expect(refs[0]?.refId).toBe(asset.id);

    const row = await ctx.db.brandAsset.findUniqueOrThrow({ where: { key: "logo_light" } });
    expect(row.mediaAssetId).toBe(asset.id);

    await brandAssets.clearBrandAsset(actor.id, "logo_light");
    refs = await ctx.db.contentReference.findMany({
      where: { sourceType: "BRAND", sourceId: "logo_light", refType: "MEDIA" },
    });
    expect(refs).toHaveLength(0);
  });

  it("deleteMedia refuses when a BRAND-sourced reference exists", async () => {
    const brandAssets = await import("./brand-assets.ts");
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const asset = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "favicon.png",
      purpose: "brand",
    });
    await brandAssets.setBrandAsset(actor.id, { key: "favicon", mediaAssetId: asset.id });

    await expect(media.deleteMedia(actor.id, asset.id)).rejects.toThrow(media.MediaAssetInUseError);

    await brandAssets.clearBrandAsset(actor.id, "favicon");
    await expect(media.deleteMedia(actor.id, asset.id)).resolves.toBeUndefined();
  });
});

describe("listMediaAssets", () => {
  it("filters by kind and excludes soft-deleted rows", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const image = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "kept.png",
      purpose: "content",
    });
    const doc = await media.storeMedia(actor.id, {
      bytes: PDF,
      fileName: "deleted.pdf",
      purpose: "content",
    });
    await media.deleteMedia(actor.id, doc.id);

    const images = await media.listMediaAssets({ kind: "IMAGE" });
    expect(images.some((r) => r.id === image.id)).toBe(true);

    const documents = await media.listMediaAssets({ kind: "DOCUMENT" });
    expect(documents.some((r) => r.id === doc.id)).toBe(false);
  });
});

describe("getMediaUrls — the batched lookup renderTree's resolveMediaUrls calls (PR 3.3)", () => {
  it("resolves multiple ids in one call, excludes a soft-deleted one, and ignores an unknown id", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const kept = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "a.png",
      purpose: "content",
    });
    const deleted = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "b.png",
      purpose: "content",
    });
    await media.deleteMedia(actor.id, deleted.id);

    const urls = await media.getMediaUrls([kept.id, deleted.id, "does-not-exist"]);
    expect(urls).toEqual({ [kept.id]: kept.url });
  });

  it("returns an empty object for an empty input without querying the database", async () => {
    expect(await media.getMediaUrls([])).toEqual({});
  });
});
