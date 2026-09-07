import { cn } from "@repo/ui/lib/utils";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type ImageProps } from "./definition.ts";

const ASPECT_CLASS: Record<ImageProps["aspectRatio"], string> = {
  auto: "",
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
};

const FIT_CLASS: Record<ImageProps["fit"], string> = {
  cover: "object-cover",
  contain: "object-contain",
};

function ImageBlock({ props, resolveMediaUrl }: BlockComponentProps<ImageProps>) {
  if (!props.assetId) return null;
  return (
    // A resolved MediaAsset URL is not authored CSS — see render.tsx's
    // background image for the same reasoning (ADR-032 §2).
    <img
      // Never actually undefined: this block isn't `client: true`, so
      // render.tsx always supplies it (registry.ts's note on the field).
      src={resolveMediaUrl!(props.assetId)}
      alt={props.alt}
      className={cn("w-full", ASPECT_CLASS[props.aspectRatio], FIT_CLASS[props.fit])}
    />
  );
}

registerBlock(definition, ImageBlock);

export { ImageBlock };
