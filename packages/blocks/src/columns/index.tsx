import { cn } from "@repo/ui/lib/utils";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { GAP_CLASS, GRID_COLUMNS_CLASS, responsiveClasses } from "../styles/tables.ts";
import { definition, type ColumnsProps } from "./definition.ts";

function ColumnsBlock({ props, children }: BlockComponentProps<ColumnsProps>) {
  return (
    <div
      className={cn(
        "grid items-start",
        responsiveClasses(GRID_COLUMNS_CLASS, props.count),
        GAP_CLASS[props.gap],
      )}
    >
      {children}
    </div>
  );
}

registerBlock(definition, ColumnsBlock);

export { ColumnsBlock };
