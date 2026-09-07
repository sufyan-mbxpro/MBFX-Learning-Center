import { z } from "zod";
import { defineBlock } from "../registry.ts";

export const dividerPropsSchema = z.object({});
export type DividerProps = z.infer<typeof dividerPropsSchema>;

export const definition = defineBlock<DividerProps>({
  type: "divider",
  version: 1,
  labelKey: "cms.blocks.divider.label",
  category: "layout",
  schema: dividerPropsSchema,
  defaults: {},
  supports: { visibility: true },
});
