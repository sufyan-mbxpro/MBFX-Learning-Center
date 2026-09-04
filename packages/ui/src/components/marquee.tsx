// ADR-018 rule 1 — CSS-only ticker, no runtime animation library. Renders
// its children TWICE (a duplicated track, translated by exactly -50% in
// globals.css's .marquee-track keyframe) so the loop seam is invisible;
// the second copy is aria-hidden since it's the same content again.
import { cn } from "@repo/ui/lib/utils";

function Marquee({
  children,
  speed = 32,
  reverse = false,
  pauseOnHover = true,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  children: React.ReactNode;
  /** Seconds for one full loop — lower is faster. */
  speed?: number;
  reverse?: boolean;
  pauseOnHover?: boolean;
}) {
  return (
    <div
      data-slot="marquee"
      data-pause-on-hover={pauseOnHover ? undefined : "false"}
      className={cn("marquee", className)}
      style={{ "--marquee-duration": `${speed}s` } as React.CSSProperties}
      {...props}
    >
      <div
        className="marquee-track gap-12"
        style={reverse ? { animationDirection: "reverse" } : undefined}
      >
        <div className="flex shrink-0 items-center gap-12">{children}</div>
        <div aria-hidden className="flex shrink-0 items-center gap-12">
          {children}
        </div>
      </div>
    </div>
  );
}

export { Marquee };
