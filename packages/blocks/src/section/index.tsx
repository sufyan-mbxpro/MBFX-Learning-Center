import { Section } from "@repo/ui/components/section";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type SectionProps } from "./definition.ts";

function SectionBlock({ props, children }: BlockComponentProps<SectionProps>) {
  return <Section spacing={props.spacing}>{children}</Section>;
}

registerBlock(definition, SectionBlock);

export { SectionBlock };
