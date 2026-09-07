import { ProcessStep } from "@repo/ui/components/process-step";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type ProcessStepProps } from "./definition.ts";

function ProcessStepBlock({ props }: BlockComponentProps<ProcessStepProps>) {
  return (
    <ProcessStep step={props.step} title={props.title} isLast={props.isLast}>
      {props.body || undefined}
    </ProcessStep>
  );
}

registerBlock(definition, ProcessStepBlock);

export { ProcessStepBlock };
