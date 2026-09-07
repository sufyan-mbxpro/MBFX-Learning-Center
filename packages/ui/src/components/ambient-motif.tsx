// Ambient forex motif — a decorative field of trading glyphs drifting
// behind a band's copy (public design system, ADR-018 rule 1: CSS only, no
// runtime animation library).
//
// Server component. Everything that moves is a CSS animation declared in
// globals.css (`.motif-glyph`), so this file only decides WHICH glyph goes
// WHERE. That split matters: the readability guarantees live in the
// stylesheet where they cannot be overridden per call site, and the
// arrangements live here where they can be read as data.
//
// Three properties are structural, not styling choices:
//
//   1. `aria-hidden` + `pointer-events-none` + `select-none`. This is
//      texture, never information and never a target. A screen reader that
//      announced "dollar sign, chart, percent" before the headline would be
//      strictly worse off than one that saw nothing.
//   2. `currentColor` at a low opacity, never a palette. The layer inherits
//      the band's own ink, so one component works on PageHero's `brand`
//      fill, a `muted` Section and the page background without a per-tone
//      colour table — and it cannot drift from the theme (code-style.md #1).
//   3. Placement is edge-biased AND the stylesheet masks the centre out.
//      Belt and braces, deliberately: copy sits mid-band, so even a future
//      arrangement with a careless coordinate cannot put a glyph behind a
//      headline.
//
// The host must be `relative isolate overflow-hidden` — the field is
// `absolute inset-0 -z-10` and has nothing else to anchor to or be clipped
// by. `isolate` is what stops `-z-10` escaping the band and painting over
// whatever sits above it; `PageHero` and the homepage `Hero` already set all
// three for their existing backdrops.
import {
  Activity,
  ArrowLeftRight,
  ArrowUpRight,
  BookOpen,
  ChartCandlestick,
  ChartLine,
  ChartNoAxesCombined,
  ChartSpline,
  Coins,
  Compass,
  DollarSign,
  Euro,
  Gauge,
  GraduationCap,
  JapaneseYen,
  Lightbulb,
  Percent,
  PoundSterling,
  Scale,
  SwissFranc,
  Target,
  TrendingDown,
  TrendingUp,
  Waves,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

/** One glyph's placement and drift. Percentages are of the field's box. */
interface MotifGlyph {
  Icon: LucideIcon;
  /**
   * Distance from the INLINE start edge, in percent. Applied as
   * `inset-inline-start`, so the whole arrangement mirrors under RTL
   * without a second table — same reasoning as `.reveal-start`.
   */
  x: number;
  /** Distance from the block start edge, in percent. */
  y: number;
  /** Rendered size in px. */
  size: number;
  /**
   * Ink, 0–100, as a percentage of full opacity. The ceiling across every
   * arrangement is 8: above that the field starts competing with body copy
   * on a `muted` band, which is the one thing it must never do.
   */
  ink: number;
  /** Seconds for one leg of the drift. Long and staggered, so no two
   *  glyphs ever pulse together and the field never reads as a loop. */
  duration: number;
  /** Negative seconds — starts the animation mid-cycle rather than making
   *  the visitor wait for it to begin. */
  delay: number;
  /** Drift distance in px. `dx` is flipped under RTL by the stylesheet. */
  dx: number;
  dy: number;
  /** Degrees of rotation across the drift. Small; a spinning glyph reads
   *  as a loading spinner, which is a different promise entirely. */
  spin?: number;
  /**
   * Kept on small screens. Everything else is `md:` and up — a phone band
   * is narrow enough that the masked centre is most of the box, so only the
   * true corner glyphs have anywhere safe to sit.
   */
  compact?: boolean;
}

/**
 * Which arrangement a surface asks for. Declared as its own union rather
 * than derived from `keyof typeof MOTIF_ARRANGEMENTS`, because the table
 * below is annotated with it — deriving one from the other would be
 * circular, and the annotation is what widens each entry to `MotifGlyph`
 * so optional fields stay readable as `number | undefined`.
 */
export type MotifVariant = "mixed" | "currency" | "chart" | "learn";

/**
 * The arrangements. Chosen per surface so the motif says something about
 * the page it sits on rather than being wallpaper: `currency` for money
 * pages, `chart` for market and news pages, `learn` for the glossary and
 * other teaching surfaces, `mixed` for the homepage where all three apply.
 *
 * Coordinates keep glyphs outside the middle third on the inline axis
 * (x ≤ 22 or x ≥ 72). The stylesheet's mask enforces this too; the data
 * respects it so the mask never has to do visible work.
 */
const MOTIF_ARRANGEMENTS: Record<MotifVariant, readonly MotifGlyph[]> = {
  mixed: [
    {
      Icon: DollarSign,
      x: 4,
      y: 12,
      size: 54,
      ink: 7,
      duration: 26,
      delay: 0,
      dx: 6,
      dy: -14,
      compact: true,
    },
    {
      Icon: ChartCandlestick,
      x: 12,
      y: 60,
      size: 46,
      ink: 6,
      duration: 32,
      delay: -6,
      dx: -5,
      dy: 12,
    },
    { Icon: TrendingUp, x: 20, y: 30, size: 30, ink: 5, duration: 22, delay: -3, dx: 4, dy: -9 },
    {
      Icon: Euro,
      x: 86,
      y: 10,
      size: 48,
      ink: 7,
      duration: 28,
      delay: -9,
      dx: -6,
      dy: 11,
      compact: true,
    },
    { Icon: ChartSpline, x: 90, y: 50, size: 58, ink: 6, duration: 34, delay: -4, dx: 5, dy: -13 },
    {
      Icon: JapaneseYen,
      x: 75,
      y: 76,
      size: 34,
      ink: 5,
      duration: 24,
      delay: -12,
      dx: -4,
      dy: -10,
    },
    {
      Icon: Percent,
      x: 8,
      y: 84,
      size: 26,
      ink: 5,
      duration: 30,
      delay: -8,
      dx: 5,
      dy: -8,
      spin: 6,
    },
    {
      Icon: PoundSterling,
      x: 93,
      y: 84,
      size: 30,
      ink: 6,
      duration: 27,
      delay: -2,
      dx: -4,
      dy: -11,
      compact: true,
    },
    { Icon: Activity, x: 2, y: 42, size: 36, ink: 4, duration: 36, delay: -14, dx: 7, dy: 9 },
    { Icon: ArrowUpRight, x: 72, y: 4, size: 24, ink: 4, duration: 20, delay: -5, dx: 3, dy: -7 },
  ],
  currency: [
    {
      Icon: DollarSign,
      x: 5,
      y: 16,
      size: 50,
      ink: 7,
      duration: 27,
      delay: 0,
      dx: 5,
      dy: -13,
      compact: true,
    },
    {
      Icon: Euro,
      x: 88,
      y: 14,
      size: 46,
      ink: 7,
      duration: 30,
      delay: -7,
      dx: -6,
      dy: 10,
      compact: true,
    },
    {
      Icon: PoundSterling,
      x: 16,
      y: 68,
      size: 38,
      ink: 6,
      duration: 24,
      delay: -11,
      dx: 4,
      dy: 11,
    },
    { Icon: JapaneseYen, x: 92, y: 62, size: 42, ink: 6, duration: 33, delay: -3, dx: -5, dy: -12 },
    { Icon: SwissFranc, x: 78, y: 86, size: 28, ink: 5, duration: 26, delay: -15, dx: 4, dy: -9 },
    {
      Icon: Coins,
      x: 3,
      y: 80,
      size: 34,
      ink: 5,
      duration: 35,
      delay: -5,
      dx: 6,
      dy: -10,
      compact: true,
    },
    {
      Icon: ArrowLeftRight,
      x: 21,
      y: 34,
      size: 26,
      ink: 4,
      duration: 21,
      delay: -9,
      dx: -4,
      dy: 8,
    },
    { Icon: Scale, x: 74, y: 38, size: 30, ink: 4, duration: 29, delay: -13, dx: 5, dy: 9 },
    {
      Icon: Percent,
      x: 95,
      y: 32,
      size: 24,
      ink: 5,
      duration: 23,
      delay: -6,
      dx: -3,
      dy: -8,
      spin: 8,
    },
  ],
  chart: [
    {
      Icon: ChartCandlestick,
      x: 4,
      y: 14,
      size: 56,
      ink: 7,
      duration: 29,
      delay: 0,
      dx: 6,
      dy: -12,
      compact: true,
    },
    {
      Icon: ChartSpline,
      x: 87,
      y: 12,
      size: 52,
      ink: 6,
      duration: 32,
      delay: -8,
      dx: -5,
      dy: 12,
      compact: true,
    },
    { Icon: TrendingUp, x: 14, y: 62, size: 40, ink: 6, duration: 25, delay: -4, dx: 5, dy: 10 },
    {
      Icon: TrendingDown,
      x: 92,
      y: 66,
      size: 34,
      ink: 5,
      duration: 31,
      delay: -12,
      dx: -4,
      dy: -11,
    },
    {
      Icon: ChartNoAxesCombined,
      x: 2,
      y: 82,
      size: 38,
      ink: 5,
      duration: 34,
      delay: -6,
      dx: 6,
      dy: -9,
      compact: true,
    },
    { Icon: Activity, x: 79, y: 88, size: 30, ink: 5, duration: 22, delay: -14, dx: -4, dy: -8 },
    { Icon: Waves, x: 22, y: 30, size: 28, ink: 4, duration: 27, delay: -10, dx: 4, dy: 8 },
    { Icon: Gauge, x: 73, y: 36, size: 32, ink: 4, duration: 30, delay: -2, dx: -5, dy: 9 },
    { Icon: ChartLine, x: 96, y: 40, size: 26, ink: 4, duration: 24, delay: -16, dx: -3, dy: -7 },
  ],
  learn: [
    {
      Icon: GraduationCap,
      x: 5,
      y: 14,
      size: 52,
      ink: 7,
      duration: 28,
      delay: 0,
      dx: 6,
      dy: -12,
      compact: true,
    },
    {
      Icon: BookOpen,
      x: 88,
      y: 16,
      size: 46,
      ink: 6,
      duration: 31,
      delay: -7,
      dx: -5,
      dy: 11,
      compact: true,
    },
    {
      Icon: ChartCandlestick,
      x: 15,
      y: 66,
      size: 38,
      ink: 6,
      duration: 26,
      delay: -3,
      dx: 5,
      dy: 10,
    },
    { Icon: DollarSign, x: 93, y: 60, size: 40, ink: 6, duration: 33, delay: -11, dx: -4, dy: -12 },
    {
      Icon: Lightbulb,
      x: 2,
      y: 82,
      size: 32,
      ink: 5,
      duration: 23,
      delay: -5,
      dx: 6,
      dy: -9,
      compact: true,
    },
    {
      Icon: Compass,
      x: 77,
      y: 86,
      size: 30,
      ink: 5,
      duration: 35,
      delay: -13,
      dx: -4,
      dy: -8,
      spin: 7,
    },
    { Icon: Target, x: 21, y: 32, size: 26, ink: 4, duration: 21, delay: -9, dx: 4, dy: 8 },
    { Icon: Euro, x: 74, y: 40, size: 28, ink: 4, duration: 29, delay: -15, dx: -5, dy: 9 },
  ],
};

/**
 * A drifting field of forex glyphs, for the background of a band.
 *
 * @example
 * <Section className="relative isolate overflow-hidden">
 *   <AmbientMotif variant="chart" />
 *   <Container>…</Container>
 * </Section>
 */
function AmbientMotif({
  variant = "mixed",
  intensity = 1,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  variant?: MotifVariant;
  /**
   * Multiplies every glyph's `ink`. The escape hatch for a band that is
   * already busy — a hero over photography wants ~0.6. Values above 1 are
   * clamped: the arrangement's ceiling is the readability budget, and a
   * call site is not the place to spend past it.
   */
  intensity?: number;
}) {
  const scale = Math.min(Math.max(intensity, 0), 1);

  return (
    <div
      aria-hidden
      data-slot="ambient-motif"
      data-variant={variant}
      className={cn(
        "motif-field pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none",
        className,
      )}
      {...props}
    >
      {MOTIF_ARRANGEMENTS[variant].map((glyph, index) => (
        <span
          // Index is a stable key here in the way it usually isn't: the
          // arrangements are frozen module-level data, never reordered,
          // filtered or appended to at runtime.
          key={index}
          className={cn(
            // `absolute` stays a Tailwind utility rather than moving into
            // `.motif-glyph`: a `position` declared in the utilities layer
            // would OVERRIDE this class, which is the cascade-layer trap
            // `.sheen` and `.pulse-ring` already document in globals.css.
            "motif-glyph absolute hidden md:block",
            glyph.compact && "block",
          )}
          style={
            {
              insetInlineStart: `${glyph.x}%`,
              insetBlockStart: `${glyph.y}%`,
              opacity: (glyph.ink / 100) * scale,
              "--motif-duration": `${glyph.duration}s`,
              "--motif-delay": `${glyph.delay}s`,
              "--motif-drift-x": `${glyph.dx}px`,
              "--motif-drift-y": `${glyph.dy}px`,
              "--motif-spin": `${glyph.spin ?? 0}deg`,
            } as React.CSSProperties
          }
        >
          <glyph.Icon
            size={glyph.size}
            // Thinner than the icon default (2): at this scale a UI-weight
            // stroke reads as a solid shape rather than a drawn line, and
            // the whole effect depends on the glyphs staying line art.
            strokeWidth={1.25}
            // No `aria-hidden` needed per glyph — the field carries it, and
            // aria-hidden is inherited by the whole subtree.
            focusable="false"
          />
        </span>
      ))}
    </div>
  );
}

export { AmbientMotif, MOTIF_ARRANGEMENTS };
