import { Separator } from "@repo/ui/components/separator";
import { registerBlock } from "../registry.ts";
import { definition } from "./definition.ts";

function DividerBlock() {
  return <Separator />;
}

registerBlock(definition, DividerBlock);

export { DividerBlock };
