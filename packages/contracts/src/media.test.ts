// changes-02 media/brand-asset contracts — shape guards for the upload and
// settings-batch server-action inputs (security.md #6: parse, don't spread).
import { describe, expect, it } from "vitest";
import {
  brandAssetKeySchema,
  categoryOfFolder,
  clampPageSize,
  folderForCategory,
  listMediaAssetsQuerySchema,
  mediaCategorySchema,
  mediaFolderSchema,
  mediaKindSchema,
  setBrandAssetSchema,
  updateMediaMetaSchema,
  uploadPurposeSchema,
  MAX_MEDIA_PAGE_SIZE,
  MEDIA_CATEGORIES,
  MEDIA_PAGE_SIZE,
  type BrandAssetKey,
} from "./media.ts";
import { updateSettingsBatchSchema } from "./settings.ts";

describe("uploadPurposeSchema", () => {
  it("accepts the four declared purposes and rejects anything else", () => {
    for (const value of ["brand", "setting", "article", "content"]) {
      expect(uploadPurposeSchema.safeParse(value).success).toBe(true);
    }
    expect(uploadPurposeSchema.safeParse("avatar").success).toBe(false);
    expect(uploadPurposeSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("brandAssetKeySchema", () => {
  it("accepts exactly the three BrandAsset slots", () => {
    const valid: BrandAssetKey[] = ["logo_light", "logo_dark", "favicon"];
    for (const key of valid) expect(brandAssetKeySchema.safeParse(key).success).toBe(true);
    expect(brandAssetKeySchema.safeParse("og_image").success).toBe(false);
  });
});

describe("setBrandAssetSchema", () => {
  it("requires a key and a mediaAssetId, and strips unknown fields", () => {
    expect(setBrandAssetSchema.safeParse({ key: "favicon", mediaAssetId: "asset1" }).success).toBe(
      true,
    );
    expect(setBrandAssetSchema.safeParse({ key: "favicon" }).success).toBe(false);
    expect(setBrandAssetSchema.safeParse({ key: "logo_light", mediaAssetId: "" }).success).toBe(
      false,
    );

    const parsed = setBrandAssetSchema.parse({
      key: "logo_light",
      mediaAssetId: "asset1",
      url: "https://attacker.example/x.png",
    } as never);
    expect("url" in parsed).toBe(false);
  });
});

describe("mediaKindSchema (ADR-034 §1)", () => {
  it("accepts exactly the four kinds", () => {
    for (const kind of ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]) {
      expect(mediaKindSchema.safeParse(kind).success).toBe(true);
    }
    expect(mediaKindSchema.safeParse("EMBED").success).toBe(false);
  });
});

describe("updateMediaMetaSchema", () => {
  it("accepts a partial update with every field optional", () => {
    expect(updateMediaMetaSchema.safeParse({}).success).toBe(true);
    expect(updateMediaMetaSchema.safeParse({ title: "Logo" }).success).toBe(true);
  });

  it("lower-cases tags and rejects more than 20", () => {
    const parsed = updateMediaMetaSchema.parse({ tags: ["Logo", "BRAND"] });
    expect(parsed.tags).toEqual(["logo", "brand"]);
    expect(
      updateMediaMetaSchema.safeParse({ tags: Array.from({ length: 21 }, (_, i) => `t${i}`) })
        .success,
    ).toBe(false);
  });

  it("requires folder to be an absolute path", () => {
    expect(updateMediaMetaSchema.safeParse({ folder: "brand" }).success).toBe(false);
    expect(updateMediaMetaSchema.safeParse({ folder: "/brand" }).success).toBe(true);
  });
});

describe("listMediaAssetsQuerySchema", () => {
  it("accepts an empty query and an optional kind/q filter", () => {
    expect(listMediaAssetsQuerySchema.safeParse({}).success).toBe(true);
    expect(listMediaAssetsQuerySchema.safeParse({ kind: "VIDEO", q: "logo" }).success).toBe(true);
    expect(listMediaAssetsQuerySchema.safeParse({ kind: "EMBED" }).success).toBe(false);
  });

  it("normalises a single kind and a repeated kind param to an array (ADR-067 §5)", () => {
    expect(listMediaAssetsQuerySchema.parse({ kinds: "IMAGE" }).kinds).toEqual(["IMAGE"]);
    expect(listMediaAssetsQuerySchema.parse({ kinds: ["IMAGE", "VIDEO"] }).kinds).toEqual([
      "IMAGE",
      "VIDEO",
    ]);
  });

  it("accepts a category and rejects an unregistered one", () => {
    expect(listMediaAssetsQuerySchema.safeParse({ category: "news" }).success).toBe(true);
    expect(listMediaAssetsQuerySchema.safeParse({ category: "invoices" }).success).toBe(false);
  });
});

// ─── ADR-066 / ADR-067 ───────────────────────────────────────

describe("mediaCategorySchema (ADR-066 §1)", () => {
  it("accepts every registered category and nothing else", () => {
    for (const category of MEDIA_CATEGORIES) {
      expect(mediaCategorySchema.safeParse(category).success).toBe(true);
    }
    expect(mediaCategorySchema.safeParse("invoices").success).toBe(false);
    expect(mediaCategorySchema.safeParse("").success).toBe(false);
  });
});

describe("mediaFolderSchema (ADR-066 §1, §3)", () => {
  it("accepts a bare category and a category with a sub-path", () => {
    for (const category of MEDIA_CATEGORIES) {
      expect(mediaFolderSchema.safeParse(`/${category}`).success).toBe(true);
    }
    expect(mediaFolderSchema.safeParse("/news/2026-covers").success).toBe(true);
    expect(mediaFolderSchema.safeParse("/learn/forex/course-covers").success).toBe(true);
  });

  it("rejects the bare root and any unregistered first segment", () => {
    expect(mediaFolderSchema.safeParse("/").success).toBe(false);
    expect(mediaFolderSchema.safeParse("/unknown/x").success).toBe(false);
    expect(mediaFolderSchema.safeParse("news").success).toBe(false);
    expect(mediaFolderSchema.safeParse("/News").success).toBe(false);
  });

  it("refuses a sub-path that names a media type — `kind` is the type axis (ADR-066 §3)", () => {
    expect(mediaFolderSchema.safeParse("/news/images").success).toBe(false);
    expect(mediaFolderSchema.safeParse("/learn/videos").success).toBe(false);
    expect(mediaFolderSchema.safeParse("/general/documents").success).toBe(false);
    expect(mediaFolderSchema.safeParse("/general/audio").success).toBe(false);
  });

  it("round-trips a category through folderForCategory/categoryOfFolder", () => {
    for (const category of MEDIA_CATEGORIES) {
      expect(categoryOfFolder(folderForCategory(category))).toBe(category);
    }
    expect(categoryOfFolder("/news/2026-covers")).toBe("news");
    expect(categoryOfFolder("/")).toBeNull();
  });
});

describe("clampPageSize (ADR-067 §1 — no input asks for everything)", () => {
  it("defaults an absent, non-numeric or infinite value to the page size", () => {
    expect(clampPageSize(undefined)).toBe(MEDIA_PAGE_SIZE);
    expect(clampPageSize("abc")).toBe(MEDIA_PAGE_SIZE);
    expect(clampPageSize(Number.POSITIVE_INFINITY)).toBe(MEDIA_PAGE_SIZE);
    expect(clampPageSize(Number.NaN)).toBe(MEDIA_PAGE_SIZE);
  });

  it("clamps zero, negatives and oversized requests into [1, MAX]", () => {
    expect(clampPageSize(0)).toBe(1);
    expect(clampPageSize(-10)).toBe(1);
    expect(clampPageSize(10_000)).toBe(MAX_MEDIA_PAGE_SIZE);
    expect(clampPageSize("9999")).toBe(MAX_MEDIA_PAGE_SIZE);
    expect(clampPageSize("24")).toBe(24);
  });

  it("is what the query schema uses, so no request can be unbounded", () => {
    expect(listMediaAssetsQuerySchema.parse({}).limit).toBe(MEDIA_PAGE_SIZE);
    expect(listMediaAssetsQuerySchema.parse({ limit: "9999" }).limit).toBe(MAX_MEDIA_PAGE_SIZE);
    expect(listMediaAssetsQuerySchema.parse({ limit: 0 }).limit).toBe(1);
  });
});

describe("updateSettingsBatchSchema (changes-02: one Save per section)", () => {
  it("accepts a non-empty array of {key, value} entries, rejects an empty batch", () => {
    expect(updateSettingsBatchSchema.safeParse([{ key: "site.name", value: "MBX" }]).success).toBe(
      true,
    );
    expect(updateSettingsBatchSchema.safeParse([]).success).toBe(false);
    expect(updateSettingsBatchSchema.safeParse([{ value: "x" }]).success).toBe(false);
  });

  it("`value` is intentionally unknown here — per-key shape is @repo/settings' job", () => {
    expect(
      updateSettingsBatchSchema.safeParse([{ key: "seo.robotsIndex", value: { nested: true } }])
        .success,
    ).toBe(true);
  });
});
