// Section rhythm primitive (changes-03-plan.md §4.1) — every public section
// uses this instead of hand-rolling its own `py-N`, so the rhythm scale
// (globals.css .section-sm/md/lg) stays the one place that changes it.
import { cn } from "@repo/ui/lib/utils";

const SECTION_SPACING_CLASS = {
  sm: "section-sm",
  md: "section-md",
  lg: "section-lg",
} as const;

// Tone token choices mirror the theme's own surface tokens exactly — no new
// color literal, no color the theme engine doesn't already emit.
const SECTION_TONE_CLASS = {
  default: "bg-background text-foreground",
  muted: "bg-muted/40 text-foreground",
  inverted: "bg-secondary text-secondary-foreground",
  accent: "bg-accent text-accent-foreground",
} as const;

function Section({
  spacing = "md",
  tone = "default",
  className,
  ...props
}: React.ComponentProps<"section"> & {
  spacing?: keyof typeof SECTION_SPACING_CLASS;
  tone?: keyof typeof SECTION_TONE_CLASS;
}) {
  return (
    <section
      data-slot="section"
      className={cn(SECTION_SPACING_CLASS[spacing], SECTION_TONE_CLASS[tone], className)}
      {...props}
    />
  );
}

export { Section };
