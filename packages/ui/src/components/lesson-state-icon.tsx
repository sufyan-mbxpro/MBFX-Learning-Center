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
import { Check, Circle, CircleDot, Lock } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

export type LessonState = "completed" | "in-progress" | "not-started" | "locked";

const GLYPH: Record<LessonState, typeof Check> = {
  completed: Check,
  "in-progress": CircleDot,
  "not-started": Circle,
  locked: Lock,
};

const TONE: Record<LessonState, string> = {
  completed: "border-success/40 bg-success/10 text-success-interactive",
  "in-progress": "border-primary/40 bg-primary/10 text-primary-interactive",
  "not-started": "border-border bg-muted/60 text-muted-foreground",
  locked: "border-border bg-muted/60 text-muted-foreground",
};

export function LessonStateIcon({
  state,
  label,
  className,
}: {
  state: LessonState;
  /**
   * The state in words — required, not optional. This is the text alternative
   * that makes the marker readable without colour, and a default here would be
   * an untranslated English string in a public component (code-style.md #2).
   */
  label: string;
  className?: string;
}) {
  const Glyph = GLYPH[state];
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
        "flex size-5 shrink-0 items-center justify-center rounded-full border",
        TONE[state],
        className,
      )}
    >
      <Glyph aria-hidden className="size-3" />
    </span>
  );
}
