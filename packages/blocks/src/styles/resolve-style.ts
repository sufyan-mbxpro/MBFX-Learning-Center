// Turns the envelope's authored StyleChoices (ADR-032 §2) into class names
// via the literal tables — never a template. Image/video backgrounds still
// need a resolved MediaAsset URL, which this package cannot look up itself
// (no @repo/db, ADR-020); `render.tsx`'s `renderTree` batches every
// referenced asset id through `RenderContext.resolveMediaUrls` once (PR
// 3.3, the collect/resolve pipeline ADR-029 anticipated for this) and
// hands this function a plain synchronous id -> URL lookup built from
// that result — this function itself never awaits anything.
import { cn } from "@repo/ui/lib/utils";
import type { StyleChoices } from "@repo/contracts";
import {
  BACKGROUND_TOKEN_CLASS,
  BORDER_CLASS,
  GAP_CLASS,
  GRADIENT_DIRECTION_CLASS,
  GRADIENT_TOKEN_CLASS,
  OVERLAY_CLASS,
  PADDING_CLASS,
  RADIUS_CLASS,
  SHADOW_CLASS,
  TEXT_TONE_CLASS,
  WIDTH_CLASS,
} from "./tables.ts";

export interface ResolvedBackground {
  /** Class(es) for the background itself — a token fill or a gradient. Empty for image/video, which paint through `mediaUrl`/`posterUrl` instead. */
  className: string;
  overlayClassName: string;
  kind: "token" | "gradient" | "image" | "video";
  mediaUrl?: string;
  posterUrl?: string;
  fit?: "cover" | "contain";
  position?: "center" | "top" | "bottom";
  fixed?: boolean;
}

export function resolveBackground(
  background: StyleChoices["background"] | undefined,
  resolveMediaUrl: (assetId: string) => string,
): ResolvedBackground | undefined {
  if (!background) return undefined;
  if (background.kind === "token") {
    return {
      kind: "token",
      className: BACKGROUND_TOKEN_CLASS[background.token],
      overlayClassName: "",
    };
  }
  if (background.kind === "gradient") {
    return {
      kind: "gradient",
      className: cn(
        "bg-gradient-to-br",
        GRADIENT_DIRECTION_CLASS[background.direction],
        GRADIENT_TOKEN_CLASS.from[background.from],
        GRADIENT_TOKEN_CLASS.to[background.to],
      ),
      overlayClassName: "",
    };
  }
  if (background.kind === "image") {
    return {
      kind: "image",
      className: "bg-cover",
      overlayClassName: OVERLAY_CLASS[background.overlay.tone][background.overlay.strength],
      mediaUrl: resolveMediaUrl(background.assetId),
      fit: background.fit,
      position: background.position,
      fixed: background.fixed,
    };
  }
  return {
    kind: "video",
    className: "",
    overlayClassName: OVERLAY_CLASS[background.overlay.tone][background.overlay.strength],
    mediaUrl: resolveMediaUrl(background.assetId),
    posterUrl: resolveMediaUrl(background.posterAssetId),
  };
}

/** Everything except `background` — a plain class string, since none of these need a resolved asset. */
export function resolveStyleClassName(style: StyleChoices | undefined): string {
  if (!style) return "";
  return cn(
    style.background?.kind === "token" ? BACKGROUND_TOKEN_CLASS[style.background.token] : undefined,
    style.textTone && TEXT_TONE_CLASS[style.textTone],
    style.padding && PADDING_CLASS[style.padding],
    style.gap && GAP_CLASS[style.gap],
    style.radius && RADIUS_CLASS[style.radius],
    style.shadow && SHADOW_CLASS[style.shadow],
    style.border && BORDER_CLASS[style.border],
    style.width && WIDTH_CLASS[style.width],
  );
}
