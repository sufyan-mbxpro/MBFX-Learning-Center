import type { Metadata } from "next";
import type { BrandAssetView } from "@repo/core";

/**
 * Turn a `BrandAsset` row into the icon descriptor Next.js expects.
 *
 * Both root layouts used to hand `brandAssets.favicon` to `icons.icon`
 * straight. Next renders an icon descriptor by spreading its fields onto the
 * `<link>` element, so the row's own fields (`key`, `altText`, `mimeType`)
 * went out as DOM attributes and React warned about `altText` on every public
 * and admin page. Only `url` (and, mapped, the MIME type) belong there.
 */
export function faviconIcons(favicon: BrandAssetView | undefined): Metadata["icons"] {
  if (!favicon) return undefined;
  return { icon: { url: favicon.url, type: favicon.mimeType ?? undefined } };
}
