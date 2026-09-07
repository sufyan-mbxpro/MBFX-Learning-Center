import { z } from "zod";
import { responsiveValueSchema } from "@repo/contracts";
import { defineBlock } from "../registry.ts";

const columnCountSchema = z.enum(["1", "2", "3", "4"]);

export const columnsPropsSchema = z.object({
  count: responsiveValueSchema(columnCountSchema).default("2"),
  gap: z.enum(["none", "sm", "md", "lg"]).default("md"),
});
export type ColumnsProps = z.infer<typeof columnsPropsSchema>;

export const definition = defineBlock<ColumnsProps>({
  type: "columns",
  version: 1,
  labelKey: "cms.blocks.columns.label",
  category: "layout",
  schema: columnsPropsSchema,
  defaults: { count: "2", gap: "md" },
  fields: [
    {
      path: "count",
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
  responsive: ["count"],
  supports: { style: ["padding"], motion: true, visibility: true, children: true },
});
