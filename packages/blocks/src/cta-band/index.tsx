import { Button } from "@repo/ui/components/button";
import { CtaBand } from "@repo/ui/components/cta-band";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type CtaBandProps } from "./definition.ts";

function CtaBandBlock({ props, resolvedLinks }: BlockComponentProps<CtaBandProps>) {
  const link = resolvedLinks?.buttonLink;
  return (
    <CtaBand
      variant={props.variant}
      title={props.title}
      description={props.description || undefined}
    >
      {link && link.state === "ok" && link.href ? (
        <Button variant="secondary" render={<a href={link.href} />}>
          {props.buttonLabel}
        </Button>
      ) : (
        <Button variant="secondary" disabled aria-disabled="true">
          {props.buttonLabel}
        </Button>
      )}
    </CtaBand>
  );
}

registerBlock(definition, CtaBandBlock);

export { CtaBandBlock };
