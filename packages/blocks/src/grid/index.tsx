import { cn } from "@repo/ui/lib/utils";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { GAP_CLASS, GRID_COLUMNS_CLASS, responsiveClasses } from "../styles/tables.ts";
import { definition, type GridProps } from "./definition.ts";

function GridBlock({ props, children }: BlockComponentProps<GridProps>) {
  return (
    <div
      className={cn(
        "grid",
        responsiveClasses(GRID_COLUMNS_CLASS, props.columns),
        GAP_CLASS[props.gap],
      )}
    >
      {children}
    </div>
  );
}

registerBlock(definition, GridBlock);

export { GridBlock };
