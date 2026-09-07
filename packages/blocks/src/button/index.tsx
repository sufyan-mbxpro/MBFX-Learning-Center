// A target that is not `ok` (missing/unpublished/forbidden) renders as
// static text, never a dead or unreachable link (ADR-031 §4).
import { Button } from "@repo/ui/components/button";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type ButtonProps } from "./definition.ts";

function ButtonBlock({ props, resolvedLinks }: BlockComponentProps<ButtonProps>) {
  const link = resolvedLinks?.link;
  if (!link || link.state !== "ok" || !link.href) {
    return (
      <Button size={props.size} variant={props.variant} disabled aria-disabled="true">
        {props.label}
      </Button>
    );
  }
  return (
    <Button size={props.size} variant={props.variant} render={<a href={link.href} />}>
      {props.label}
    </Button>
  );
}

registerBlock(definition, ButtonBlock);

export { ButtonBlock };
