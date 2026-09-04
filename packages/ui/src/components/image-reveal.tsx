// ADR-018 rule 2 / changes-03-plan.md §4.1. Deliberately takes a single
// image element as `children` rather than importing next/image itself —
// architecture.md #10: a shared package doesn't depend on Next's APIs
// except where its job IS Next integration, and rendering images isn't
// @repo/ui's job (every existing next/image call lives in apps/web, e.g.
// news/_components/article-list.tsx). The caller passes a <Image fill .../>
// (or a plain <img>); this primitive owns only the aspect box, the hover
// zoom (.media-zoom), and the scroll-entrance wipe (.image-wipe).
import { cloneElement, type ReactElement } from "react";

import { AspectRatio } from "@repo/ui/components/aspect-ratio";
import { cn } from "@repo/ui/lib/utils";

function ImageReveal({
  ratio = 16 / 9,
  wipe = true,
  className,
  imageClassName,
  children,
}: {
  ratio?: number;
  wipe?: boolean;
  className?: string;
  imageClassName?: string;
  children: ReactElement<{ className?: string }>;
}) {
  return (
    <AspectRatio
      ratio={ratio}
      className={cn("group overflow-hidden rounded-lg bg-muted", wipe && "image-wipe", className)}
    >
      {cloneElement(children, {
        className: cn(
          "media-zoom size-full object-cover",
          children.props.className,
          imageClassName,
        ),
      })}
    </AspectRatio>
  );
}

export { ImageReveal };
