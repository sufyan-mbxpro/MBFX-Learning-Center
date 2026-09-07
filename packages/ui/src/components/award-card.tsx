// One recognition badge (changes-09-plan.md §2).
//
// It was deliberately plain when it shipped: an award is a claim of fact, so
// everything on it comes from the caller's facts module (ADR-047 §2) and none
// of it was decorated into looking like more than it is.
//
// ADR-051 §6 gives it presentation without giving it authority. What is added
// is a laurel-framed medallion, a hover lift and a sheen — all of it about the
// CARD, none of it about the award. Nothing here invents a rank, a badge
// image, a verification mark or a link to a citation that does not exist. If
// the underlying claim is a placeholder, this card still says exactly what the
// facts module gave it and nothing more.
import { Award as AwardGlyph } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

function AwardCard({
  title,
  issuer,
  year,
  media,
  className,
  ...props
}: Omit<React.ComponentProps<"li">, "title"> & {
  title: React.ReactNode;
  issuer: React.ReactNode;
  year: number;
  /** A badge image when one exists; the medallion stands in when it doesn't. */
  media?: React.ReactNode;
}) {
  return (
    <li
      data-slot="award-card"
      className={cn(
        "card-hover hover-lift sheen group/award flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      {media ?? (
        <span className="relative flex size-16 items-center justify-center">
          {/* Two concentric rings and a tinted disc: a medallion read at a
              glance, built from the same --primary tint the icon boxes use
              rather than a new colour. The outer ring rotates a few degrees
              on hover, which is the whole animation — a badge that spins is
              a toy. */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border border-primary/25 transition-transform duration-(--duration-slow) ease-(--ease-out-quint) group-hover/award:rotate-12"
          />
          <span
            aria-hidden
            className="absolute inset-1.5 rounded-full border border-dashed border-primary/20"
          />
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary-interactive transition-colors duration-(--duration-base) group-hover/award:bg-primary group-hover/award:text-primary-foreground">
            <AwardGlyph aria-hidden className="size-5" />
          </span>
        </span>
      )}
      <p className="font-semibold text-balance text-card-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">
        {issuer} · {year}
      </p>
    </li>
  );
}

export { AwardCard };
