// Public design system (changes-03-plan.md §4.1): the eyebrow + h2 + lead
// pattern every reference section opens with ("ACCOUNT" / "Trading
// Accounts" / body copy). One component so the pattern can't drift per
// section. All three fields are optional except `title` — a caller with no
// eyebrow or lead just omits the prop, not an empty string.
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

const ALIGN_CLASS = {
  start: "items-start text-start",
  center: "items-center text-center",
} as const;

function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: keyof typeof ALIGN_CLASS;
}) {
  return (
    <div
      data-slot="section-heading"
      className={cn("flex flex-col gap-3", ALIGN_CLASS[align], className)}
      {...props}
    >
      {eyebrow && <Badge variant="eyebrow">{eyebrow}</Badge>}
      <h2 className="text-display-sm font-semibold text-balance">{title}</h2>
      {lead && <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{lead}</p>}
    </div>
  );
}

export { SectionHeading };
