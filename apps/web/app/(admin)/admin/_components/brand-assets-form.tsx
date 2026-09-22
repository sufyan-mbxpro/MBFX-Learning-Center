"use client";

// The site's logos and favicon (changes-50: "place the branding in the
// general under the tab, remove from the theme settings"). This was the theme
// editor's "Logos & Favicon" tab; it moved to Settings → General → Branding
// because a logo is part of the site's identity (its name, tagline and
// contact details live there), while the theme editor is about colour.
//
// Each slot saves on its own through its own action, as it did in the theme
// editor: an upload is already a committed file, and holding it for a Save
// would leave a library row pointing at nothing if the admin walked away.
// The actions gate on `theme.update`, the key this UI has always required —
// the page only renders it for a subject who holds it.
import { useState } from "react";
import { clearBrandAssetAction, setBrandAssetAction } from "../_actions/media-actions.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";
import { ImageUploadField, type ImageUploadLabels } from "./image-upload-field.tsx";

export interface BrandAssetUrls {
  logo_light: string | null;
  logo_dark: string | null;
  favicon: string | null;
}

export interface BrandAssetsLabels {
  logoLight: string;
  logoDark: string;
  favicon: string;
  saved: string;
  upload: ImageUploadLabels;
}

export function BrandAssetsForm({
  initial,
  labels,
}: {
  initial: BrandAssetUrls;
  labels: BrandAssetsLabels;
}) {
  const [logos, setLogos] = useState(initial);
  const { run, pending } = useServerAction();

  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
      {(
        [
          ["logo_light", labels.logoLight],
          ["logo_dark", labels.logoDark],
          ["favicon", labels.favicon],
        ] as const
      ).map(([key, label]) => (
        <ImageUploadField
          key={key}
          label={label}
          value={logos[key]}
          purpose="brand"
          category="brand"
          sourceType="BRAND"
          labels={labels.upload}
          disabled={pending}
          onChange={(next) => {
            setLogos((current) => ({ ...current, [key]: next?.url ?? null }));
            run(
              () =>
                next
                  ? setBrandAssetAction({ key, mediaAssetId: next.id })
                  : clearBrandAssetAction(key),
              { successMessage: labels.saved, skipRefresh: true },
            );
          }}
        />
      ))}
    </div>
  );
}
