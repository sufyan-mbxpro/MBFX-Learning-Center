// The reference's `two-column-callout` (changes-09-plan.md §2) — media on
// one side, copy on the other, optionally numbered, optionally reversed,
// on any of Section's tones. It appears sixteen times across the five About
// pages, which is why it is a primitive rather than per-page markup.
//
// `reverse` swaps the columns with `lg:[direction:rtl]`-free markup: the
// media element is ordered, not positioned, so RTL locales mirror the whole
// thing for free and no physical property appears anywhere.
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { cn } from "@repo/ui/lib/utils";

function SplitCallout({
  step,
  eyebrow,
  title,
  media,
  actions,
  reverse = false,
  tone = "default",
  spacing = "md",
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Section>, "title"> & {
  /** 1-based position, rendered as a filled marker. Omit for an unnumbered callout. */
  step?: number;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Typically `<ImageReveal>`; omitted, a tinted panel holds the column instead. */
  media?: React.ReactNode;
  actions?: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <Section
      data-slot="split-callout"
      spacing={spacing}
      tone={tone}
      className={className}
      {...props}
    >
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal variant={reverse ? "end" : "start"} className={cn(reverse && "lg:order-2")}>
          {media ?? (
            // No image supplied (ADR-047 §3). A gradient panel, never a
            // broken <img> — and when the callout is numbered, the panel
            // carries the step as a watermark so it reads as a deliberate
            // graphic rather than a slot waiting for a photograph.
            <div
              aria-hidden
              className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-primary-subtle to-muted"
            >
              {step !== undefined && (
                <span className="text-[10rem] leading-none font-semibold text-primary/20">
                  {step}
                </span>
              )}
            </div>
          )}
        </Reveal>

        <Reveal
          variant="up"
          delay={80}
          className={cn("flex flex-col gap-4", reverse && "lg:order-1")}
        >
          {(step !== undefined || eyebrow) && (
            <div className="flex items-center gap-3">
              {step !== undefined && (
                // A filled marker, not a tinted numeral: --primary as a
                // FILL with its derived foreground is the pairing ADR-018
                // rule 5 endorses, and it stays legible on every tone.
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  {step}
                </span>
              )}
              {eyebrow && (
                <p className="text-sm font-semibold tracking-wide uppercase opacity-70">
                  {eyebrow}
                </p>
              )}
            </div>
          )}

          <h2 className="text-display-sm font-semibold text-balance">{title}</h2>
          {children && <div className="flex flex-col gap-3 text-pretty opacity-80">{children}</div>}
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </Reveal>
      </Container>
    </Section>
  );
}

export { SplitCallout };
