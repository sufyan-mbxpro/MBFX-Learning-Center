// The About section's image slots, resolved (ADR-051 §5).
//
// One component stands between the pages and `ABOUT_MEDIA` so that ADR-047
// §3's guarantee is enforced in exactly one place: a `null` entry returns
// `null`, the caller's `media` prop goes undefined, and the primitive falls
// back to its own gradient panel. No page has to remember to check.
//
// `alt=""` on every piece, deliberately. These are backdrops and callout
// panels — texture beside the copy, never information that is only in the
// picture. Inventing a description for abstract artwork adds noise to a
// screen reader without adding a fact, and the generated pieces have no
// subject to describe. If a slot ever holds a photograph that CARRIES
// meaning, it needs a real alt string from the catalog and this component
// needs an `alt` prop; until then the honest value is empty.
import Image from "next/image";

import { ImageReveal } from "@repo/ui/components/image-reveal";
import { cn } from "@repo/ui/lib/utils";
import { ABOUT_MEDIA, ABOUT_MEDIA_SIZE, type AboutMediaKey } from "../_content/about-media.ts";

export function AboutArt({
  slot,
  kind = "callout",
  priority = false,
  wipe = true,
  className,
}: {
  slot: AboutMediaKey;
  /** Picks the intrinsic size; `hero` is 16:9, `callout` 4:3. */
  kind?: keyof typeof ABOUT_MEDIA_SIZE;
  /** Set on the piece above the fold only — everything else stays lazy. */
  priority?: boolean;
  wipe?: boolean;
  className?: string;
}) {
  const src = ABOUT_MEDIA[slot];
  if (!src) return null;

  const { width, height } = ABOUT_MEDIA_SIZE[kind];

  return (
    <ImageReveal ratio={width / height} wipe={wipe} className={className}>
      <Image
        src={src}
        alt=""
        width={width}
        height={height}
        priority={priority}
        // `unoptimized`, not `dangerouslyAllowSVG` in next.config: these are
        // hand-generated vector files a few KB each, so the optimizer has
        // nothing to win, and the config flag would relax SVG handling for
        // EVERY image the app serves — including admin-entered URLs — to buy
        // that nothing. Same reasoning as the article cover images.
        unoptimized
        sizes="(min-width: 1024px) 50vw, 100vw"
      />
    </ImageReveal>
  );
}

/**
 * The hero backdrop: the same artwork, unframed and unclipped, for
 * `PageHero`'s `backdrop` slot. It is not `AboutArt` with a prop because
 * everything ImageReveal contributes — the aspect box, the rounded corners,
 * the entrance wipe — is wrong for a full-bleed background.
 */
export function AboutBackdrop({ slot }: { slot: AboutMediaKey }) {
  const src = ABOUT_MEDIA[slot];
  if (!src) return null;

  return (
    <Image src={src} alt="" fill priority unoptimized sizes="100vw" className="object-cover" />
  );
}

/**
 * The dotted world map behind `HotspotMap`'s pins.
 *
 * Rendered as a CSS MASK over `currentColor` rather than inlined as SVG. The
 * dot matrix is ~27 KB of markup: inlined it is 640 DOM nodes on a public
 * route, where as a mask it is one cached, heavily-compressible asset and the
 * colour still comes from the theme, which is the only reason inlining was
 * ever on the table.
 */
export function AboutWorldMap({ className }: { className?: string }) {
  const mask = "url(/about/world-dots.svg) no-repeat center / contain";
  return (
    <div
      aria-hidden
      // 9/4 is the generated file's own viewBox ratio (720×320); a mismatch
      // here would letterbox the mask and move every pin off its anchor.
      className={cn("aspect-[9/4] w-full bg-current text-foreground/30", className)}
      style={{ WebkitMask: mask, mask }}
    />
  );
}
