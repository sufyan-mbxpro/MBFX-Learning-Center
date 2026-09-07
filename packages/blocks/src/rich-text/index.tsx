import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type RichTextProps } from "./definition.ts";

function RichTextBlock({ props }: BlockComponentProps<RichTextProps>) {
  return (
    <div
      className="prose prose-sm max-w-none text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-3 [&_a]:hover:underline"
      // Sanitized on save (definition.ts) — same trust boundary as the
      // repo's other rich-text renderers.
      dangerouslySetInnerHTML={{ __html: props.html }}
    />
  );
}

registerBlock(definition, RichTextBlock);

export { RichTextBlock };
