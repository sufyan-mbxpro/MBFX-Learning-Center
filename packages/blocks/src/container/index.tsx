import { Container } from "@repo/ui/components/container";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type ContainerProps } from "./definition.ts";

function ContainerBlock({ props, children }: BlockComponentProps<ContainerProps>) {
  return <Container size={props.size}>{children}</Container>;
}

registerBlock(definition, ContainerBlock);

export { ContainerBlock };
