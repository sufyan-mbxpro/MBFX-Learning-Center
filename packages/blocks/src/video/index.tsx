import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type VideoProps } from "./definition.ts";

function VideoBlock({ props, resolveMediaUrl }: BlockComponentProps<VideoProps>) {
  if (!props.assetId) return null;
  return (
    <video
      className="w-full"
      // Never actually undefined: this block isn't `client: true`, so
      // render.tsx always supplies it (registry.ts's note on the field).
      src={resolveMediaUrl!(props.assetId)}
      poster={props.posterAssetId ? resolveMediaUrl!(props.posterAssetId) : undefined}
      controls={!props.autoplay}
      muted={props.autoplay}
      autoPlay={props.autoplay}
      playsInline
      loop={props.autoplay}
      preload="none"
    />
  );
}

registerBlock(definition, VideoBlock);

export { VideoBlock };
