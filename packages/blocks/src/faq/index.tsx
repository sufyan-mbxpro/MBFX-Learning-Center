import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type FaqProps } from "./definition.ts";

function FaqBlock({ props }: BlockComponentProps<FaqProps>) {
  return (
    <Accordion>
      {props.items.map((item, i) => (
        // Items have no stable id of their own (plain authored data);
        // order is the only identity a static FAQ list has.
        <AccordionItem key={i} value={`q${i + 1}`}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

registerBlock(definition, FaqBlock);

export { FaqBlock };
