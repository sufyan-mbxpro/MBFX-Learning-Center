// The homepage's media slot — `CalendarMedia`'s sibling (ADR-050), with one
// addition: the fallback panel is TONED, because on the homepage the panels
// sit side by side in a carousel where eight identical tinted rectangles
// would read as eight missing images rather than as a set.
//
// Same contract as every other media slot on the public site: a path from
// `_content/home-media.ts` renders a real image; `null` renders a designed
// panel. The page reads as finished at either stage, which is the whole
// point of the pattern — a hole in a layout is not a placeholder, it is a
// bug that nobody has filed yet.
import Image from "next/image";
import type { LucideIcon } from "lucide-react";

import { ImageReveal } from "@repo/ui/components/image-reveal";
import { cn } from "@repo/ui/lib/utils";
import { HOME_MEDIA_SIZE, type HomeImage } from "../_content/home-media.ts";

/**
 * The semantic tokens a homepage panel may be toned with.
 *
 * Declared here rather than imported from the calendar page's `ACCENT_TONES`
 * (ADR-050): that table lives in `economic-calendar/_components/`, a
 * route-private colocation folder, and reaching across routes into one is how
 * a private folder quietly stops being private. The overlap is a six-name
 * union over tokens `@repo/theme` already owns — cheaper to restate than to
 * couple two unrelated pages through.
 */
export type HomeMediaTone = "primary" | "info" | "success" | "warning" | "destructive" | "muted";

// Tone → the panel's wash and its watermark ink. Drawn from the theme's own
// semantic tokens, exactly as ACCENT_TONES is: no literal, nothing for an
// author to hand-pick, and every value shifts correctly between light and
// dark because each is an alpha tint over the current surface rather than a
// fixed shade (the bug documented on Badge's `eyebrow` variant).
const PANEL_TONE_CLASS = {
  primary: "from-primary/18 via-primary/6",
  info: "from-info/18 via-info/6",
  success: "from-success/18 via-success/6",
  warning: "from-warning/18 via-warning/6",
  destructive: "from-destructive/18 via-destructive/6",
  muted: "from-muted-foreground/18 via-muted-foreground/6",
} as const satisfies Record<HomeMediaTone, string>;

const GLYPH_TONE_CLASS = {
  primary: "text-primary-interactive/35",
  info: "text-info-interactive/35",
  success: "text-success-interactive/35",
  warning: "text-warning-interactive/35",
  destructive: "text-destructive-interactive/35",
  muted: "text-muted-foreground/35",
} as const satisfies Record<HomeMediaTone, string>;

export function HomeMedia({
  src,
  icon: Icon,
  tone = "primary",
  sizes = "(max-width: 640px) 82vw, (max-width: 1024px) 58vw, 30vw",
  className,
}: {
  src: HomeImage;
  icon: LucideIcon;
  tone?: HomeMediaTone;
  sizes?: string;
  className?: string;
}) {
  const ratio = HOME_MEDIA_SIZE.width / HOME_MEDIA_SIZE.height;

  if (!src) {
    return (
      <div
        aria-hidden
        style={{ aspectRatio: ratio }}
        className={cn(
          // `.bg-dot-grid` builds its pattern from `currentcolor`, so setting
          // the glyph tone on the wrapper tints the dots to match the panel
          // for free — one colour decision, two effects.
          "relative flex w-full items-center justify-center overflow-hidden bg-gradient-to-br to-transparent",
          PANEL_TONE_CLASS[tone],
          GLYPH_TONE_CLASS[tone],
          className,
        )}
      >
        <span className="bg-dot-grid absolute inset-0 opacity-40" />
        {/* Scales with the card's own `group` hover, mirroring what
            `.media-zoom` does to a real image — so a card with artwork and a
            card without behave identically under the pointer. */}
        <Icon className="relative size-20 transition-transform duration-(--duration-slow) ease-(--ease-out-quint) group-hover:scale-110" />
      </div>
    );
  }

  return (
    // `wipe={false}`, and this one is not a taste call.
    //
    // `.image-wipe` animates `clip-path` on an `animation-timeline: view()`,
    // and `view()` resolves against the element's NEAREST SCROLLPORT. Inside
    // the carousel that is the track, not the page: `overflow-x: auto` makes
    // the track a scroll container on both axes (a computed `visible` on one
    // axis becomes `auto` when the other is not `visible`), and the track has
    // no block-axis overflow at all. A timeline with a degenerate range never
    // advances, which would leave every card's artwork parked at the wipe's
    // 0% keyframe — `inset(0 0 0 100%)`, i.e. fully clipped and invisible, on
    // exactly the browsers that support the feature.
    //
    // The section already has its entrance: `Explore` wraps the whole track
    // in `<Reveal variant="up">`, whose timeline resolves against the page.
    // The hover zoom is unaffected — `.media-zoom` is a transition, not a
    // scroll-driven animation.
    <ImageReveal ratio={ratio} wipe={false} className={cn("rounded-none", className)}>
      <Image
        src={src}
        // `alt=""`, for the reason `AboutArt` states: these are generated
        // abstract panels, texture beside the copy, never information that
        // exists only in the picture. Inventing a description for abstract
        // artwork adds noise to a screen reader without adding a fact — and
        // the card's own heading already names the destination. If a slot
        // ever holds a photograph that CARRIES meaning it needs a real alt
        // string from the catalog, and this component needs an `alt` prop.
        alt=""
        width={HOME_MEDIA_SIZE.width}
        height={HOME_MEDIA_SIZE.height}
        // `unoptimized`, not `dangerouslyAllowSVG` in next.config: a few KB of
        // hand-generated vector has nothing for the optimizer to win, and the
        // config flag would relax SVG handling for EVERY image the app serves,
        // admin-entered URLs included, to buy that nothing. Same call AboutArt
        // and the article cover images make.
        unoptimized
        sizes={sizes}
      />
    </ImageReveal>
  );
}
