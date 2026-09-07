import { cn } from "@repo/ui/lib/utils";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type ParagraphProps } from "./definition.ts";

const SIZE_CLASS: Record<ParagraphProps["size"], string> = {
  sm: "text-sm",
  default: "text-base",
  lg: "text-lg",
};

const ALIGN_CLASS: Record<ParagraphProps["align"], string> = {
  start: "text-start",
  center: "text-center",
};

function ParagraphBlock({ props }: BlockComponentProps<ParagraphProps>) {
  return (
    <p
      className={cn(
        SIZE_CLASS[props.size],
        ALIGN_CLASS[props.align],
        "text-pretty text-muted-foreground",
      )}
    >
      {props.text}
    </p>
  );
}

registerBlock(definition, ParagraphBlock);

export { ParagraphBlock };
