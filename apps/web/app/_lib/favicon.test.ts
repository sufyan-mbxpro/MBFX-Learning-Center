// Regression test for the favicon descriptor both root layouts build.
//
// The bug: `icons: { icon: brandAssets.favicon }` handed Next the whole
// BrandAsset row. Next spreads an icon descriptor onto the <link>, so
// `altText` and `mimeType` reached the DOM and React warned on every page.
import { describe, expect, it } from "vitest";
import type { BrandAssetView } from "@repo/core";
import { faviconIcons } from "./favicon.ts";

const favicon: BrandAssetView = {
  key: "favicon",
  url: "/uploads/f701ecea7605bc53adafd0d8.jpg",
  altText: null,
  mimeType: "image/jpeg",
};

describe("faviconIcons", () => {
  it("emits only link attributes — never the row's own fields", () => {
    const icons = faviconIcons(favicon);
    const icon = (icons as { icon: Record<string, unknown> }).icon;

    expect(icon).toEqual({ url: favicon.url, type: "image/jpeg" });
    expect(Object.keys(icon)).not.toContain("altText");
    expect(Object.keys(icon)).not.toContain("key");
    expect(Object.keys(icon)).not.toContain("mimeType");
  });

  it("drops a null mime type rather than emitting type={null}", () => {
    const icons = faviconIcons({ ...favicon, mimeType: null });
    expect((icons as { icon: { type?: string } }).icon.type).toBeUndefined();
  });

  it("returns undefined when no upload has replaced the static favicon", () => {
    expect(faviconIcons(undefined)).toBeUndefined();
  });
});
