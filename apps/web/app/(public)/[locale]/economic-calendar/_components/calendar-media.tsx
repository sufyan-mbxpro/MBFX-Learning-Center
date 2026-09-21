// The calendar page's media slot (ADR-050).
//
// Takes a path from `_content/calendar-media.ts`, which is `null` until real
// artwork lands. Rather than render a broken image or a hole in the layout,
// a null falls back to a tinted panel carrying a watermark glyph — the same
// posture `SplitCallout` takes for its own missing media, so the page reads
// as finished rather than unfinished at every stage.
//
// Two surfaces need two panels: the masthead sits on the brand gradient,
// where the only ink guaranteed legible is --primary-foreground (ADR-003),
// while the body callouts sit on --background. Hence `tone`, not one panel
// that is wrong half the time.
import Image from "next/image";
import { CalendarDays, type LucideIcon } from "lucide-react";
import { ImageReveal } from "@repo/ui/components/image-reveal";
import { cn } from "@repo/ui/lib/utils";
import { CALENDAR_MEDIA, type CalendarImage } from "../_content/calendar-media.ts";

/**
 * The masthead's full-bleed backdrop (changes-40) — `NewsBackdrop`'s sibling.
 *
 * NOT `CalendarMedia` with a prop, for the reason `NewsBackdrop` gives: the
 * aspect box, the rounded corners and the entrance wipe `ImageReveal`
 * contributes are all wrong behind a headline. `alt=""` because it is texture
 * under a scrim, not a fact the words leave out.
 */
export function CalendarBackdrop() {
  const src = CALENDAR_MEDIA.banner;
  if (!src) return null;
  return (
    <Image
      src={src}
      alt=""
      fill
      // The LCP candidate on this route.
      priority
      unoptimized={src.endsWith(".svg")}
      sizes="100vw"
      className="object-cover"
    />
  );
}

const PANEL_TONE_CLASS = {
  onBrand: "bg-primary-foreground/10 ring-1 ring-primary-foreground/20",
  onSurface: "bg-gradient-to-br from-primary-subtle to-muted ring-1 ring-foreground/10",
} as const;

const GLYPH_TONE_CLASS = {
  onBrand: "text-primary-foreground/30",
  onSurface: "text-primary/20",
} as const;

export function CalendarMedia({
  src,
  alt,
  ratio = 4 / 3,
  tone = "onSurface",
  icon: Icon = CalendarDays,
  className,
}: {
  src: CalendarImage;
  /** From the catalog — required whenever `src` is set, ignored by the panel. */
  alt: string;
  ratio?: number;
  tone?: keyof typeof PANEL_TONE_CLASS;
  icon?: LucideIcon;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        aria-hidden
        style={{ aspectRatio: ratio }}
        className={cn(
          "flex w-full items-center justify-center rounded-lg",
          PANEL_TONE_CLASS[tone],
          className,
        )}
      >
        <Icon className={cn("size-24", GLYPH_TONE_CLASS[tone])} />
      </div>
    );
  }

  return (
    <ImageReveal ratio={ratio} className={cn("rounded-lg", className)}>
      <Image src={src} alt={alt} fill sizes="(max-width: 1024px) 100vw, 50vw" />
    </ImageReveal>
  );
}
