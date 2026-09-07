import { cn } from "@repo/ui/lib/utils";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type HeadingProps } from "./definition.ts";

const LEVEL_CLASS: Record<HeadingProps["level"], string> = {
  "1": "text-display-lg font-semibold tracking-tight",
  "2": "text-display-sm font-semibold tracking-tight",
  "3": "text-2xl font-semibold",
  "4": "text-xl font-semibold",
  "5": "text-lg font-semibold",
  "6": "text-base font-semibold",
};

const ALIGN_CLASS: Record<HeadingProps["align"], string> = {
  start: "text-start",
  center: "text-center",
};

function HeadingBlock({ props }: BlockComponentProps<HeadingProps>) {
  const className = cn(LEVEL_CLASS[props.level], ALIGN_CLASS[props.align], "text-balance");
  switch (props.level) {
    case "1":
      return <h1 className={className}>{props.text}</h1>;
    case "3":
      return <h3 className={className}>{props.text}</h3>;
    case "4":
      return <h4 className={className}>{props.text}</h4>;
    case "5":
      return <h5 className={className}>{props.text}</h5>;
    case "6":
      return <h6 className={className}>{props.text}</h6>;
    default:
      return <h2 className={className}>{props.text}</h2>;
  }
}

registerBlock(definition, HeadingBlock);

export { HeadingBlock };
