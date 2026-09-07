import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const tablePropsSchema = z.object({
  headers: z.array(z.string().trim().max(80)).max(10),
  rows: z.array(z.array(z.string().trim().max(200)).max(10)).max(50),
});
export type TableProps = z.infer<typeof tablePropsSchema>;

export const definition = defineBlock<TableProps>({
  type: "table",
  version: 1,
  labelKey: "cms.blocks.table.label",
  category: "content",
  schema: tablePropsSchema,
  defaults: { headers: [], rows: [] },
  fields: [
    {
      path: "headers",
      kind: "json",
      labelKey: "cms.blocks.table.fields.headers",
      translatable: true,
    },
    { path: "rows", kind: "json", labelKey: "cms.blocks.table.fields.rows", translatable: true },
  ],
  translatable: ["headers", "rows"],
  supports: { style: ["width"], visibility: true },
});
