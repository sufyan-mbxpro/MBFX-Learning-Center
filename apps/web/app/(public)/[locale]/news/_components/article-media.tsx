// An article card's picture — the cover the editor uploaded, or a designed
// panel when there isn't one.
//
// This is ADR-047 §3's media pattern applied to CONTENT rather than to
// chrome, and it is the one place the two differ: the page's own artwork is
// a code registry (`_content/news-media.ts`), while a cover image is data an
// editor owns. What the pattern still guarantees is the same — a missing
// image is a designed state, not a hole. Before this, a card with no cover
// rendered text-only and a grid of mixed cards looked broken rather than
// varied.
//
// The panel is toned by the article's KIND, so the fallbacks read as a set
// (news / analysis / trade idea) instead of as one repeated grey rectangle —
// the same reasoning `HomeMedia` records for the explore carousel, whose
// null branch this mirrors. No asset is committed for it: it is theme tokens
// and one glyph, so it costs nothing to serve and follows dark mode for free.
import Image from "next/image";
import { LineChart, Lightbulb, Newspaper } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ArticleListEntry } from "@repo/core";
import { ImageReveal } from "@repo/ui/components/image-reveal";
import { cn } from "@repo/ui/lib/utils";

// Kind → glyph and wash. Alpha tints over the current surface, never fixed
// shades: that is what makes them correct in both modes (the bug badge.tsx
// documents for `--primary-subtle`).
const KIND_PANEL: Record<string, { icon: LucideIcon; wash: string; ink: string }> = {
  NEWS: { icon: Newspaper, wash: "from-primary/18 via-primary/6", ink: "text-primary-interactive/35" },
  ANALYSIS: { icon: LineChart, wash: "from-info/18 via-info/6", ink: "text-info-interactive/35" },
  TRADE_IDEA: {
    icon: Lightbulb,
    wash: "from-success/18 via-success/6",
    ink: "text-success-interactive/35",
  },
};

const FALLBACK_PANEL = KIND_PANEL.NEWS!;

export function ArticleMedia({
  entry,
  ratio = 16 / 9,
  sizes = "(max-width: 640px) 100vw, 33vw",
  priority = false,
  className,
}: {
  entry: ArticleListEntry;
  ratio?: number;
  sizes?: string;
  /** Set on the spotlight's lead card only; every other cover stays lazy. */
  priority?: boolean;
  className?: string;
}) {
  if (!entry.coverImageUrl) {
    const panel = KIND_PANEL[entry.kind] ?? FALLBACK_PANEL;
    const Glyph = panel.icon;
    return (
      <div
        aria-hidden
        style={{ aspectRatio: ratio }}
        className={cn(
          // `.bg-dot-grid` builds its pattern from `currentcolor`, so the
          // glyph tone on the wrapper tints the dots to match for free.
          "relative flex w-full items-center justify-center overflow-hidden bg-gradient-to-br to-transparent",
          panel.wash,
          panel.ink,
          className,
        )}
      >
        <span className="bg-dot-grid absolute inset-0 opacity-40" />
        {/* Scales with the card's own `group` hover, mirroring what
            `.media-zoom` does to a real cover — a card with artwork and a
            card without behave identically under the pointer. */}
        <Glyph className="relative size-16 transition-transform duration-(--duration-slow) ease-(--ease-out-quint) group-hover:scale-110" />
      </div>
    );
  }

  return (
    <ImageReveal ratio={ratio} className={cn("rounded-none", className)}>
      {/* Cover URLs are admin-entered and arbitrary-host — skip the
          optimizer rather than allowlist the world. */}
      <Image src={entry.coverImageUrl} alt="" fill unoptimized priority={priority} sizes={sizes} />
    </ImageReveal>
  );
}
