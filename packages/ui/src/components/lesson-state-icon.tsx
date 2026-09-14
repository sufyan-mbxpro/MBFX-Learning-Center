// The four states a lesson can be in for a reader (changes-11 §9.2).
//
// **Never colour alone** (plan §10, a11y): each state carries a distinct GLYPH
// and a text alternative, so the marker survives greyscale, colour-blindness
// and a screen reader. The tone is reinforcement, not the signal.
//
// It renders "not started" on the server for every lesson and the progress
// island swaps in real state on hydrate (ADR-056 #1). That is why the size is
// fixed here rather than inherited: the marker must occupy its space from
// first paint or the whole curriculum shifts when the island lands.
//
// **`not-started` is a play mark, not an empty circle** (changes-24, ADR-082
// #1). It was the one state whose glyph said nothing — an empty ring is the
// ABSENCE of a mark, so three states carried meaning and the fourth carried a
// hole. A play triangle says "start here", which is exactly what not-started
// means, and the four glyphs stay mutually distinct in greyscale:
// check / dot / triangle / padlock. The `aria-label` is unchanged.
import { Check, CircleDot, Lock, Play } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

export type LessonState = "completed" | "in-progress" | "not-started" | "locked";

const GLYPH: Record<LessonState, typeof Check> = {
  completed: Check,
  "in-progress": CircleDot,
  "not-started": Play,
  locked: Lock,
};

const TONE: Record<LessonState, string> = {
  completed: "border-success/40 bg-success/10 text-success-interactive",
  "in-progress": "border-primary/40 bg-primary/10 text-primary-interactive",
  "not-started": "border-border bg-muted/60 text-muted-foreground",
  locked: "border-border bg-muted/60 text-muted-foreground",
};

/**
 * `sm` is the list marker (rail, compact card expansion); `lg` is the course
 * outline's timeline node, where the marker is also the row's play affordance
 * and has to be big enough to read as one (ADR-082 #1).
 */
const SIZE = {
  sm: { ring: "size-5", glyph: "size-3" },
  lg: { ring: "size-9 border-2", glyph: "size-4" },
} as const;

export function LessonStateIcon({
  state,
  label,
  size = "sm",
  className,
}: {
  state: LessonState;
  /**
   * The state in words — required, not optional. This is the text alternative
   * that makes the marker readable without colour, and a default here would be
   * an untranslated English string in a public component (code-style.md #2).
   */
  label: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const Glyph = GLYPH[state];
  const scale = SIZE[size];
  return (
    <span
      // `role="img"` + `aria-label` rather than a visually-hidden span: the
      // marker is one indivisible piece of information, and a screen reader
      // should announce "completed", not read a decorative glyph and then a
      // stray word.
      role="img"
      aria-label={label}
      data-state={state}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border",
        scale.ring,
        TONE[state],
        className,
      )}
    >
      <Glyph
        aria-hidden
        className={cn(
          scale.glyph,
          // A stroked triangle at 12px is a sliver; filled, it reads as a play
          // mark. `ms-px` is the optical centring a triangle needs in a
          // circle, and `rtl:rotate-180` points it along the reading direction
          // the way every other directional glyph here does.
          state === "not-started" && "ms-px fill-current rtl:rotate-180",
        )}
      />
    </span>
  );
}
