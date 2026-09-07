import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { SPACER_HEIGHT_CLASS } from "../styles/tables.ts";
import { definition, type SpacerProps } from "./definition.ts";

function SpacerBlock({ props }: BlockComponentProps<SpacerProps>) {
  return <div aria-hidden className={SPACER_HEIGHT_CLASS[props.size]} />;
}

registerBlock(definition, SpacerBlock);

export { SpacerBlock };
