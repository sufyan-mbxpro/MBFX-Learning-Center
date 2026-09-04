// Public-surface layout primitive (changes-03-plan.md §4.1). Wraps the
// existing .container-page utility (admin-set max-width, ADR-018 leaves it
// untouched) and adds its two fixed siblings for hero/prose measure.
import { cn } from "@repo/ui/lib/utils";

// "wide"/"narrow" use hand-written .container-wide/.container-narrow, not
// Tailwind's generated max-w-(--container-wide) arbitrary utility — see the
// comment beside those classes in globals.css for why that utility would
// silently lose to .container-page's own max-width at equal specificity.
const CONTAINER_SIZE_CLASS = {
  page: "container-page",
  wide: "container-page container-wide",
  narrow: "container-page container-narrow",
} as const;

function Container({
  size = "page",
  className,
  ...props
}: React.ComponentProps<"div"> & { size?: keyof typeof CONTAINER_SIZE_CLASS }) {
  return (
    <div data-slot="container" className={cn(CONTAINER_SIZE_CLASS[size], className)} {...props} />
  );
}

export { Container };
