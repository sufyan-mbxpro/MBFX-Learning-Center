import { cn } from "@repo/ui/lib/utils";

// No hardcoded label (code-style.md #2): pass `aria-label` from a message
// catalog to announce a standalone spinner; without one it renders as a
// purely decorative icon and the surrounding container owns the status text
// (the PageLoader/SectionLoader pattern). The mark itself is the branded
// loading animation (changes-05) — four rounded squares morphing/rotating,
// styled entirely in globals.css's brand-loader-* rules so every consumer
// here (buttons, PageLoader, SectionLoader, DataTable's loading rows) picks
// it up with no call-site changes.
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const labelled = "aria-label" in props && props["aria-label"];
  return (
    <svg
      data-slot="spinner"
      role={labelled ? "status" : undefined}
      aria-hidden={labelled ? undefined : true}
      viewBox="0 0 128 128"
      className={cn("size-4", className)}
      {...props}
    >
      <g fill="var(--primary)">
        <g className="brand-loader__g">
          <g transform="translate(20,20) rotate(0,44,44)">
            <g>
              <rect height="40" width="40" ry="8" rx="8" className="brand-loader__rect" />
              <rect
                transform="translate(0,48)"
                height="40"
                width="40"
                ry="8"
                rx="8"
                className="brand-loader__rect"
              />
            </g>
            <g transform="rotate(180,44,44)">
              <rect height="40" width="40" ry="8" rx="8" className="brand-loader__rect" />
              <rect
                transform="translate(0,48)"
                height="40"
                width="40"
                ry="8"
                rx="8"
                className="brand-loader__rect"
              />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

export { Spinner };
