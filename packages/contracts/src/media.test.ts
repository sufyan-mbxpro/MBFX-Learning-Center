// changes-02 media/brand-asset contracts — shape guards for the upload and
// settings-batch server-action inputs (security.md #6: parse, don't spread).
import { describe, expect, it } from "vitest";
import {
  brandAssetKeySchema,
  setBrandAssetSchema,
  uploadPurposeSchema,
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
    expect(
      setBrandAssetSchema.safeParse({ key: "favicon", mediaAssetId: "asset1" }).success,
    ).toBe(true);
    expect(setBrandAssetSchema.safeParse({ key: "favicon" }).success).toBe(false);
    expect(
      setBrandAssetSchema.safeParse({ key: "logo_light", mediaAssetId: "" }).success,
    ).toBe(false);

    const parsed = setBrandAssetSchema.parse({
      key: "logo_light",
      mediaAssetId: "asset1",
      url: "https://attacker.example/x.png",
    } as never);
    expect("url" in parsed).toBe(false);
  });
});

describe("updateSettingsBatchSchema (changes-02: one Save per section)", () => {
  it("accepts a non-empty array of {key, value} entries, rejects an empty batch", () => {
    expect(
      updateSettingsBatchSchema.safeParse([{ key: "site.name", value: "MBX" }]).success,
    ).toBe(true);
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
