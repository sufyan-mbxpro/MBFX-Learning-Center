import { StatCard } from "@repo/ui/components/stat-card";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type StatCardProps } from "./definition.ts";

function StatCardBlock({ props }: BlockComponentProps<StatCardProps>) {
  return (
    <StatCard
      value={props.value}
      prefix={props.prefix || undefined}
      suffix={props.suffix || undefined}
      label={props.label}
    />
  );
}

registerBlock(definition, StatCardBlock);

export { StatCardBlock };
