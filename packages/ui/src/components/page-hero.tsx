// The banner every About-section page opens with (changes-09-plan.md §2,
// mapped from the reference's `page-heading dark-theme`). Distinct from the
// homepage `Hero`: that one is a homepage SECTION with admin-chosen
// variants, this is a page masthead — an <h1>, an optional lead, optional
// actions, optional media, and nothing else.
//
// The eyebrow is a plain uppercase line, NOT Badge's `eyebrow` variant:
// that variant pairs bg-primary/10 with --primary-interactive, and
// --primary-interactive is computed against --background, so on this
// component's default `inverted` band the pairing is exactly the
// low-contrast trap badge.tsx documents. An opacity step off the band's own
// foreground is tone-agnostic and cannot drift.
import { Container } from "@repo/ui/components/container";
import { Reveal } from "@repo/ui/components/reveal";
import { Section } from "@repo/ui/components/section";
import { cn } from "@repo/ui/lib/utils";

const ALIGN_CLASS = {
  start: "items-start text-start",
  center: "items-center text-center",
} as const;

// The hero owns its own surface rather than taking Section's `tone`, for two
// reasons found in the browser rather than in review:
//
//   1. `cn()` is tailwind-merge. A `bg-*` utility passed through className
//      REPLACES Section's own `bg-secondary` — that is how the first build of
//      this component rendered light text on the page background with no band
//      at all. Owning the surface here means one class list, no merge race.
//   2. `inverted` is not dark in this theme: `--secondary` is a light neutral
//      in light mode (#E8E6E3), so the reference's dark photo band has no
//      equivalent among Section's tones.
//
// `brand` is a large gradient FILL of --primary with its DERIVED
// --primary-foreground on top (ADR-003) — the one pairing the theme engine
// guarantees legible, and exactly the large-area case ADR-018 rule 5 allows.
const HERO_TONE_CLASS = {
  brand: "bg-gradient-to-br from-primary to-primary-active text-primary-foreground",
  muted: "bg-muted/40 text-foreground",
  default: "bg-background text-foreground",
  inverted: "bg-secondary text-secondary-foreground",
} as const;

function PageHero({
  backdrop,
  breadcrumb,
  eyebrow,
  title,
  lead,
  actions,
  media,
  footnote,
  tone = "brand",
  align = "start",
  className,
  ...props
}: Omit<React.ComponentProps<typeof Section>, "title" | "tone"> & {
  tone?: keyof typeof HERO_TONE_CLASS;
  eyebrow?: React.ReactNode;
  /**
   * A breadcrumb trail, rendered above the eyebrow inside the copy column.
   *
   * Its own slot rather than something the caller folds into `eyebrow`:
   * the eyebrow renders as a <p>, and a <nav> inside a <p> is invalid markup
   * that browsers silently reparent — which moves the trail out of the hero
   * entirely. The caller owns the trail's own ink for the tone it sits on.
   */
  breadcrumb?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  /** Buttons/links, composed in by the caller — same slot idiom as CtaBand. */
  actions?: React.ReactNode;
  /** A media element (typically `<ImageReveal>`); omitted, the copy runs full width. */
  media?: React.ReactNode;
  /**
   * Full-bleed artwork BEHIND the copy, as opposed to `media` beside it.
   * Rendered under a scrim, at low opacity, `aria-hidden` and non-selectable:
   * a masthead's background is texture, never information. Compose the two
   * only when the art is quiet enough to survive being cropped by the
   * headline (ADR-051 §5's generated pieces are).
   */
  backdrop?: React.ReactNode;
  /** Small print that belongs to the headline claim, not to the page body. */
  footnote?: React.ReactNode;
  align?: keyof typeof ALIGN_CLASS;
}) {
  return (
    <Section
      data-slot="page-hero"
      spacing="lg"
      data-tone={tone}
      className={cn("relative isolate overflow-hidden", HERO_TONE_CLASS[tone], className)}
      {...props}
    >
      {backdrop && (
        // -z-10 rather than a lower stacking order on the content: Section
        // already sets `isolate`, so this cannot escape the hero and paint
        // over the sub-nav above it. 25% is the ceiling, not a taste call —
        // above it the art starts eating the contrast the tone was checked
        // for, and the generated pieces already carry their own vignette.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-25 select-none"
        >
          {backdrop}
        </div>
      )}
      <Container className={cn("grid items-center gap-10", media && "lg:grid-cols-2")}>
        <div className={cn("flex flex-col gap-5", ALIGN_CLASS[align])}>
          {breadcrumb}
          {eyebrow && (
            <Reveal variant="up">
              <p className="text-sm font-semibold tracking-wide uppercase opacity-70">{eyebrow}</p>
            </Reveal>
          )}
          <Reveal variant="up" delay={60}>
            <h1 className="text-display-md font-semibold tracking-tight text-balance">{title}</h1>
          </Reveal>
          {lead && (
            <Reveal variant="up" delay={120}>
              {/* opacity, not text-muted-foreground: this component renders on
                  four different tones and muted-foreground is computed against
                  --background only. */}
              <p className="max-w-2xl text-lg text-pretty opacity-80">{lead}</p>
            </Reveal>
          )}
          {actions && (
            <Reveal variant="up" delay={180}>
              <div className={cn("flex flex-wrap gap-3", align === "center" && "justify-center")}>
                {actions}
              </div>
            </Reveal>
          )}
          {footnote && <p className="max-w-2xl text-xs opacity-60">{footnote}</p>}
        </div>
        {media && (
          <Reveal variant="end" className="hidden lg:block">
            {media}
          </Reveal>
        )}
      </Container>
    </Section>
  );
}

export { PageHero };
