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
      category: "brand",
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
      category: "general",
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
        category: "general",
        allowedKinds: ["IMAGE"],
      }),
    ).rejects.toThrow(media.UploadRejectedError);
  });

  it("storeImage rejects a non-image even though storeMedia would accept it", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    await expect(
      media.storeImage(actor.id, {
        bytes: PDF,
        fileName: "brochure.pdf",
        purpose: "content",
        category: "general",
      }),
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
      media.storeMedia(actor.id, {
        bytes: PDF,
        fileName: "big.pdf",
        purpose: "content",
        category: "general",
      }),
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
      category: "brand",
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
      category: "brand",
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
      category: "brand",
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
      category: "brand",
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
      category: "brand",
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
      category: "brand",
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
      category: "brand",
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
      category: "general",
    });
    const doc = await media.storeMedia(actor.id, {
      bytes: PDF,
      fileName: "deleted.pdf",
      purpose: "content",
      category: "general",
    });
    await media.deleteMedia(actor.id, doc.id);

    const images = await media.listMediaAssets({ kind: "IMAGE" });
    expect(images.items.some((r) => r.id === image.id)).toBe(true);

    const documents = await media.listMediaAssets({ kind: "DOCUMENT" });
    expect(documents.items.some((r) => r.id === doc.id)).toBe(false);
  });

  // ADR-067 — the page is the only shape, and nothing can ask for more.

  it("returns a bounded page and a cursor that walks the rest without skipping or repeating", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const ids: string[] = [];
    for (let index = 0; index < 7; index += 1) {
      const stored = await media.storeMedia(actor.id, {
        bytes: PNG,
        fileName: `page-${index}.png`,
        purpose: "content",
        category: "news",
      });
      ids.push(stored.id);
    }

    const first = await media.listMediaAssets({ category: "news", limit: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).not.toBeNull();

    const second = await media.listMediaAssets({
      category: "news",
      limit: 3,
      cursor: first.nextCursor ?? undefined,
    });
    const third = await media.listMediaAssets({
      category: "news",
      limit: 3,
      cursor: second.nextCursor ?? undefined,
    });

    const walked = [...first.items, ...second.items, ...third.items].map((r) => r.id);
    expect(walked).toHaveLength(7);
    expect(new Set(walked).size).toBe(7); // no repeats across the cursor boundary
    expect([...walked].sort()).toEqual([...ids].sort()); // and none skipped
    expect(third.nextCursor).toBeNull();
  });

  it("clamps an oversized or absent limit rather than answering with everything", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);
    await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "clamp.png",
      purpose: "content",
      category: "general",
    });

    // No input produces an unbounded read — ADR-067 §1.
    const huge = await media.listMediaAssets({ limit: 10_000 });
    expect(huge.items.length).toBeLessThanOrEqual(100);
    const zero = await media.listMediaAssets({ limit: 0 });
    expect(zero.items).toHaveLength(1);
  });

  it("scopes a category to its own path boundary, never a name that merely starts the same", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    const inside = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "inside.png",
      purpose: "content",
      category: "news",
      folder: "/news/2026-covers",
    });
    const elsewhere = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "elsewhere.png",
      purpose: "content",
      category: "learn",
    });

    const news = await media.listMediaAssets({ category: "news" });
    const newsIds = news.items.map((r) => r.id);
    expect(newsIds).toContain(inside.id);
    expect(newsIds).not.toContain(elsewhere.id);
    expect(news.items.find((r) => r.id === inside.id)?.category).toBe("news");
  });

  it("finds a match that is not on the first page — search is the server's job now", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    for (let index = 0; index < 5; index += 1) {
      await media.storeMedia(actor.id, {
        bytes: PNG,
        fileName: `filler-${index}.png`,
        purpose: "content",
        category: "general",
      });
    }
    const needle = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "needle-in-haystack.png",
      purpose: "content",
      category: "general",
    });
    for (let index = 0; index < 5; index += 1) {
      await media.storeMedia(actor.id, {
        bytes: PNG,
        fileName: `after-${index}.png`,
        purpose: "content",
        category: "general",
      });
    }

    // The needle is outside any first page of 3, so a client-side filter
    // over page 1 could never have found it.
    const found = await media.listMediaAssets({ query: "needle-in", limit: 3 });
    expect(found.items.map((r) => r.id)).toContain(needle.id);
  });

  it("records intrinsic dimensions on upload, and tolerates a header too short to carry them", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    // A real IHDR. The shared PNG fixture is 12 bytes — enough to sniff the
    // type, not enough to hold a size — which is itself the "no dimensions,
    // still a valid upload" case asserted below.
    const sized = new Uint8Array(24);
    sized.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(sized.buffer).setUint32(16, 1280);
    new DataView(sized.buffer).setUint32(20, 720);

    const stored = await media.storeMedia(actor.id, {
      bytes: sized,
      fileName: "sized.png",
      purpose: "content",
      category: "general",
    });
    const detail = await media.getMediaAssetDetail(stored.id);
    expect(detail?.width).toBe(1280);
    expect(detail?.height).toBe(720);
    expect(detail?.thumbnailUrl).toBe(detail?.url);

    const truncated = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "no-header.png",
      purpose: "content",
      category: "general",
    });
    const truncatedDetail = await media.getMediaAssetDetail(truncated.id);
    expect(truncatedDetail?.width).toBeNull();
    expect(truncatedDetail?.id).toBe(truncated.id); // the upload still succeeded
  });

  it("counts usage only when asked (ADR-067 §4)", async () => {
    const brandAssets = await import("./brand-assets.ts");
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);
    const asset = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "used.png",
      purpose: "brand",
      category: "brand",
    });
    await brandAssets.setBrandAsset(actor.id, { key: "favicon", mediaAssetId: asset.id });

    const withoutUsage = await media.listMediaAssets({ query: "used.png" });
    expect(withoutUsage.items[0]?.usageCount).toBe(0);

    const withUsage = await media.listMediaAssets({ query: "used.png", withUsage: true });
    expect(withUsage.items[0]?.usageCount).toBe(1);

    // The delete guard reads ContentReference directly and is unaffected.
    await expect(media.deleteMedia(actor.id, asset.id)).rejects.toThrow(media.MediaAssetInUseError);
    await brandAssets.clearBrandAsset(actor.id, "favicon");
  });
});

describe("getMediaFacets", () => {
  it("counts per category and kind, and excludes soft-deleted rows", async () => {
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "facet-a.png",
      purpose: "content",
      category: "news",
    });
    const removed = await media.storeMedia(actor.id, {
      bytes: PDF,
      fileName: "facet-b.pdf",
      purpose: "content",
      category: "news",
    });
    await media.deleteMedia(actor.id, removed.id);

    const facets = await media.getMediaFacets();
    expect(facets.byCategory.news.IMAGE).toBeGreaterThanOrEqual(1);
    expect(facets.byCategory.news.DOCUMENT).toBe(0);
    expect(facets.total.IMAGE).toBeGreaterThanOrEqual(facets.byCategory.news.IMAGE);
  });
});

describe("getRecentlyUsedMedia", () => {
  it("returns assets in reference order, and nothing at all when none are placed", async () => {
    const brandAssets = await import("./brand-assets.ts");
    const { driver } = fakeDriver();
    media.setStorageDriverForTests(driver);

    expect(await media.getRecentlyUsedMedia({ sourceType: "ARTICLE" })).toEqual([]);

    const asset = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "recent.png",
      purpose: "brand",
      category: "brand",
    });
    await brandAssets.setBrandAsset(actor.id, { key: "logo_light", mediaAssetId: asset.id });

    const recent = await media.getRecentlyUsedMedia({ sourceType: "BRAND" });
    expect(recent.map((r) => r.id)).toContain(asset.id);
    await brandAssets.clearBrandAsset(actor.id, "logo_light");
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
      category: "general",
    });
    const deleted = await media.storeMedia(actor.id, {
      bytes: PNG,
      fileName: "b.png",
      purpose: "content",
      category: "general",
    });
    await media.deleteMedia(actor.id, deleted.id);

    const urls = await media.getMediaUrls([kept.id, deleted.id, "does-not-exist"]);
    expect(urls).toEqual({ [kept.id]: kept.url });
  });

  it("returns an empty object for an empty input without querying the database", async () => {
    expect(await media.getMediaUrls([])).toEqual({});
  });
});
