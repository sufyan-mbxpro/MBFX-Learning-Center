import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type TabsProps } from "./definition.ts";

function TabsBlock({ props }: BlockComponentProps<TabsProps>) {
  const first = props.items[0];
  if (!first) return null;
  return (
    <Tabs defaultValue={first.label}>
      <TabsList>
        {props.items.map((item) => (
          <TabsTrigger key={item.label} value={item.label}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {props.items.map((item) => (
        <TabsContent key={item.label} value={item.label}>
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

registerBlock(definition, TabsBlock);

export { TabsBlock };
