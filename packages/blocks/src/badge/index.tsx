import { Badge } from "@repo/ui/components/badge";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type BadgeProps } from "./definition.ts";

function BadgeBlock({ props }: BlockComponentProps<BadgeProps>) {
  return <Badge variant={props.variant}>{props.text}</Badge>;
}

registerBlock(definition, BadgeBlock);

export { BadgeBlock };
