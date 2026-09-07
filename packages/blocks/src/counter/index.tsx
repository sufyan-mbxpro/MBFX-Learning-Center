import { Counter } from "@repo/ui/components/counter";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type CounterProps } from "./definition.ts";

function CounterBlock({ props, locale }: BlockComponentProps<CounterProps>) {
  return (
    <Counter
      value={props.value}
      prefix={props.prefix || undefined}
      suffix={props.suffix || undefined}
      locale={locale}
      className="text-display-sm font-semibold text-foreground"
    />
  );
}

registerBlock(definition, CounterBlock);

export { CounterBlock };
