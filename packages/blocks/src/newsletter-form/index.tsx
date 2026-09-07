import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type NewsletterFormProps } from "./definition.ts";

function NewsletterFormBlock({ id, props }: BlockComponentProps<NewsletterFormProps>) {
  const describedById = `${id}-unavailable`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          type="email"
          name="email"
          aria-label={props.label}
          placeholder={props.placeholder}
          disabled
          aria-describedby={describedById}
          className={cn("flex-1", props.tone !== "default" && "bg-background")}
        />
        <Button type="button" variant={props.tone === "onFill" ? "secondary" : "default"} disabled>
          {props.submitLabel}
        </Button>
      </div>
      <p
        id={describedById}
        className={cn(
          "text-xs",
          props.tone === "onFill" && "text-primary-foreground/80",
          props.tone === "onSecondary" && "text-secondary-foreground/70",
          props.tone === "default" && "text-muted-foreground",
        )}
      >
        {props.unavailableLabel}
      </p>
    </div>
  );
}

registerBlock(definition, NewsletterFormBlock);

export { NewsletterFormBlock };
