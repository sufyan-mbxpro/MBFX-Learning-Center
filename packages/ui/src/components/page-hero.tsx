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

// Two vertical densities, and nothing between them.
//
// `default` is the section front every masthead has been since ADR-047: a
// tall brand band that is the first thing on the site and has a job to do.
// `compact` is the thin top banner — the SAME anatomy at a third of the
// height, for a page whose real content should start near the top.
// `medium` sits between them (changes-47): the article listings' banner was
// asked to be "a little" smaller, which `compact` overshoots by two thirds.
//
// A named variant rather than a `spacing` prop the caller passes through
// (which is what `/glossary/[term]` and `ComingSoon` were each doing on their
// own, and what this replaces), for ADR-082 §Rail's reason: a density is
// several numbers that have to move together, and a call site that shortens
// only the padding leaves the copy stack's own 60px of gaps behind. Height
// is the only axis here — the TYPE scale is untouched, because ADR-072's
// rule is that a band which looks wrong gets its spacing fixed, never a
// private font size.
const HERO_SIZE = {
  default: { spacing: "lg", copyGap: "gap-5" },
  medium: { spacing: "md", copyGap: "gap-4" },
  compact: { spacing: "sm", copyGap: "gap-3" },
} as const;

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
// It is still the tone for a band with no artwork behind it.
//
// `photo` is the band that has a photograph to show (ADR-117). It is
// `inverted`'s surface — the same `--secondary` / `--secondary-foreground`
// pair the homepage hero and the footer already run on — because the ink has
// to be readable over a SCRIM of that fill, and `--primary-foreground` is
// derived against `--primary`, which is no longer what is behind the words.
const HERO_TONE_CLASS = {
  brand: "bg-gradient-to-br from-primary to-primary-active text-primary-foreground",
  photo: "bg-secondary text-secondary-foreground",
  muted: "bg-muted/40 text-foreground",
  default: "bg-background text-foreground",
  inverted: "bg-secondary text-secondary-foreground",
} as const;

// The veil between the artwork and the copy, and the whole of ADR-117's
// legibility argument.
//
// It is built from `--secondary` at varying alpha, so whatever the
// photograph is, the ink above it is reading against a known fill in a known
// direction — `--secondary-foreground` is derived readable ON `--secondary`
// by construction (ADR-003), which a text-shadow over an arbitrary
// photograph is not.
//
// Two shapes, because the copy sits in two places. A start-aligned masthead
// puts its words in the inline-start half, so the scrim is opaque there and
// clears completely on the other side — the homepage hero's exact idiom, and
// the reason a reader sees the photograph rather than a tint of it. A
// centred masthead has copy across the full width and gets a vertical one
// instead, softest through the middle where the picture has the most to say.
//
// A gradient direction has no logical form in Tailwind, so the RTL flip is
// written out — the same place-by-place honesty `.reveal-start` needs.
const HERO_SCRIM_CLASS = {
  start:
    "bg-gradient-to-t from-secondary via-secondary/85 to-secondary/40 md:bg-gradient-to-r md:from-secondary md:via-secondary/85 md:to-transparent rtl:md:bg-gradient-to-l",
  center: "bg-gradient-to-b from-secondary/90 via-secondary/65 to-secondary/90",
} as const;

function PageHero({
  backdrop,
  motif,
  breadcrumb,
  eyebrow,
  title,
  lead,
  actions,
  media,
  footnote,
  tone,
  align = "start",
  size = "default",
  className,
  ...props
}: Omit<React.ComponentProps<typeof Section>, "title" | "tone" | "spacing"> & {
  /**
   * The band's surface. Defaults to `photo` when a `backdrop` is supplied and
   * `brand` when one is not (ADR-117) — a masthead that was given artwork is
   * a masthead whose job is to show it, and making that the DEFAULT is what
   * stops the next photographic masthead from being added under a fill again.
   * An explicit value always wins.
   */
  tone?: keyof typeof HERO_TONE_CLASS;
  /** Vertical density. `compact` is the thin top banner — see HERO_SIZE. */
  size?: keyof typeof HERO_SIZE;
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
   * `aria-hidden` and non-selectable: a masthead's background carries nothing
   * the copy beside it does not. Compose the two only when the art survives
   * being cropped by the headline (ADR-051 §5's generated pieces do).
   *
   * Supplying this switches the band to the `photo` tone unless the caller
   * says otherwise, which renders the artwork at full strength under a
   * `--secondary` scrim rather than at 25% under a brand fill (ADR-117).
   */
  backdrop?: React.ReactNode;
  /**
   * A decorative ambient layer — `AmbientMotif` — painted between the
   * backdrop and the copy.
   *
   * Its own slot rather than something folded into `backdrop`, for two
   * reasons. Under every tone but `photo` the backdrop is clamped to 25%
   * opacity; the motif already carries its own much lower ink and would come
   * out invisible under a second multiplier. And the two compose — the news
   * masthead runs a photograph AND a chart motif — which a single slot
   * cannot express. The motif sits ABOVE the scrim, which is right: it is
   * line work meant to read, not texture meant to recede.
   */
  motif?: React.ReactNode;
  /** Small print that belongs to the headline claim, not to the page body. */
  footnote?: React.ReactNode;
  align?: keyof typeof ALIGN_CLASS;
}) {
  const resolvedTone = tone ?? (backdrop ? "photo" : "brand");
  const isPhoto = resolvedTone === "photo";

  return (
    <Section
      data-slot="page-hero"
      spacing={HERO_SIZE[size].spacing}
      data-tone={resolvedTone}
      className={cn("relative isolate overflow-hidden", HERO_TONE_CLASS[resolvedTone], className)}
      {...props}
    >
      {backdrop && (
        // -z-10 rather than a lower stacking order on the content: Section
        // already sets `isolate`, so this cannot escape the hero and paint
        // over the sub-nav above it.
        //
        // Full strength under `photo`, 25% under every other tone. The 25%
        // was the ceiling for artwork sitting UNDER a fill — above it the art
        // ate the contrast the tone had been checked for. `photo` moves the
        // legibility guarantee from a clamp on the picture to a scrim under
        // the words, which is what lets the picture be a picture (ADR-117).
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 select-none",
            !isPhoto && "opacity-25",
          )}
        >
          {backdrop}
        </div>
      )}
      {isPhoto && (
        <div
          aria-hidden
          className={cn("pointer-events-none absolute inset-0 -z-10", HERO_SCRIM_CLASS[align])}
        />
      )}
      {motif}
      <Container className={cn("grid items-center gap-10", media && "lg:grid-cols-2")}>
        <div
          className={cn(
            "flex flex-col",
            HERO_SIZE[size].copyGap,
            ALIGN_CLASS[align],
            // The copy has to stay inside the opaque half of a start-aligned
            // scrim. `text-balance` already keeps the headline from running
            // the full 1400px on most titles; this makes it a guarantee
            // rather than a property of the words that happen to be there.
            isPhoto && align === "start" && "md:max-w-3xl",
          )}
        >
          {breadcrumb}
          {eyebrow && (
            <Reveal variant="up">
              <p className="text-sm font-semibold tracking-wide uppercase opacity-70">{eyebrow}</p>
            </Reveal>
          )}
          <Reveal variant="up" delay={60}>
            <h1 className="font-display text-display-md font-bold tracking-tight text-balance">
              {title}
            </h1>
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
