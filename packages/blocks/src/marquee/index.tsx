import { Marquee } from "@repo/ui/components/marquee";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type MarqueeProps } from "./definition.ts";

function MarqueeBlock({ props }: BlockComponentProps<MarqueeProps>) {
  return (
    <Marquee speed={props.speed}>
      {props.items.map((item, i) => (
        <span key={i} className="text-sm font-medium text-muted-foreground">
          {item}
        </span>
      ))}
    </Marquee>
  );
}

registerBlock(definition, MarqueeBlock);

export { MarqueeBlock };
