// Same mechanism as `columns` (a distinct registered type, not an alias) —
// `columns` arranges a handful of authored children side by side; `grid`
// names the layout an admin reaches for to repeat card-shaped children.
// Kept separate so either can diverge later without a breaking change to
// the other's stored props.
import { z } from "zod";
import { responsiveValueSchema } from "@repo/contracts";
import { defineBlock } from "../registry.ts";

const gridColumnCountSchema = z.enum(["1", "2", "3", "4"]);

export const gridPropsSchema = z.object({
  columns: responsiveValueSchema(gridColumnCountSchema).default("3"),
  gap: z.enum(["none", "sm", "md", "lg"]).default("md"),
});
export type GridProps = z.infer<typeof gridPropsSchema>;

export const definition = defineBlock<GridProps>({
  type: "grid",
  version: 1,
  labelKey: "cms.blocks.grid.label",
  category: "layout",
  schema: gridPropsSchema,
  defaults: { columns: "3", gap: "md" },
  fields: [
    {
      path: "columns",
      kind: "select",
      labelKey: "cms.blocks.common.fields.columnCount",
      options: ["1", "2", "3", "4"].map((v) => ({
        value: v,
        labelKey: `cms.blocks.common.options.count${v}`,
      })),
    },
    {
      path: "gap",
      kind: "select",
      labelKey: "cms.blocks.common.fields.gap",
      options: [
        { value: "none", labelKey: "cms.blocks.common.options.none" },
        { value: "sm", labelKey: "cms.blocks.common.options.sm" },
        { value: "md", labelKey: "cms.blocks.common.options.md" },
        { value: "lg", labelKey: "cms.blocks.common.options.lg" },
      ],
    },
  ],
  responsive: ["columns"],
  supports: { style: ["padding"], motion: true, visibility: true, children: true },
});
