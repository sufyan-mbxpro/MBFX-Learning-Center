// A promotion's face (ADR-167, changes-52): one component for the public
// popup, the home band and the admin editor's preview, so what an editor
// previews is the thing a visitor sees — not a sketch of it.
//
// Presentational only. It holds no strings (every word arrives as a prop, from
// a catalog or from the promotion's own translated fields) and no Next.js: the
// image is a SLOT the caller renders, for the reason `course-card.tsx` gives —
// @repo/ui must not depend on Next (architecture.md #10), and a bare `<img>`
// fallback would quietly opt every promotion out of `next/image`.
//
// `title` is a node, not a string, so the popup can pass its `DialogTitle`
// and the dialog stays labelled by the heading a reader sees (code-style #11).
import type { ReactNode } from "react";
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

/** Badge tones a promotion kind may map to. The mapping lives with the caller. */
export type PromoCardTone = "info" | "success" | "warning" | "secondary" | "default";

export interface PromoCardProps {
  /** The kind's name ("Webinar", "Offer"), already translated. */
  badge?: string | null;
  badgeTone?: PromoCardTone;
  /** The admin's own short label beside the kind ("Ends Friday"). */
  tag?: string | null;
  title: ReactNode;
  /** Rich or plain body, already sanitized upstream when it is HTML. */
  body?: ReactNode;
  /** The picture, rendered by the caller (`next/image` with `fill`). */
  media?: ReactNode;
  /** Event time, countdown, calendar link — the timed kinds' row. */
  meta?: ReactNode;
  /** The call to action and the dismiss control. */
  actions?: ReactNode;
  /** The language of the WORDS, when it differs from the page's (a fallback). */
  lang?: string;
  /**
   * `dialog` runs the picture edge to edge across the top of a modal whose own
   * padding is zero, with the words in their own padding below it (ADR-174
   * #7); `card` is a bordered band card of its own. The words, order and
   * tones are identical.
   */
  layout?: "dialog" | "card";
  className?: string;
}

export function PromoCard({
  badge,
  badgeTone = "secondary",
  tag,
  title,
  body,
  media,
  meta,
  actions,
  lang,
  layout = "card",
  className,
}: PromoCardProps) {
  return (
    <article
      lang={lang}
      data-slot="promo-card"
      data-layout={layout}
      className={cn(
        "flex min-w-0 flex-col",
        layout === "card" &&
          "h-full overflow-hidden rounded-lg border bg-card text-card-foreground",
        // In a dialog the card fits the SCREEN (changes-57): it may be shorter
        // than its content, and the picture gives up the height — never the
        // words or the buttons. Not clipped, so a promotion too long even
        // with the picture at its floor scrolls in the dialog rather than
        // cutting its buttons off.
        layout === "dialog" && "min-h-0",
        className,
      )}
    >
      {media ? (
        <div
          data-slot="promo-card-media"
          className={cn(
            "relative aspect-video w-full bg-muted",
            // The one part allowed to shrink: its words sibling has a basis of
            // zero and so never does. `min-h-28` replaces the aspect ratio's
            // own minimum, which would otherwise hold it at full height.
            layout === "dialog" && "min-h-28 overflow-hidden",
          )}
        >
          {media}
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-3",
          layout === "card" ? "p-5" : "p-5 sm:p-6",
          // With no picture the dialog's corner close sits over the first
          // line, so that line leaves it room.
          layout === "dialog" && !media && "[&>:first-child]:pe-10",
        )}
      >
        {badge || tag ? (
          <div className="flex flex-wrap items-center gap-2">
            {badge ? <Badge variant={badgeTone}>{badge}</Badge> : null}
            {tag ? <Badge variant="outline">{tag}</Badge> : null}
          </div>
        ) : null}

        <div className="text-xl leading-snug font-semibold text-balance">{title}</div>

        {body ? <div className="min-w-0 text-sm text-muted-foreground">{body}</div> : null}

        {meta ? (
          <div
            data-slot="promo-card-meta"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
          >
            {meta}
          </div>
        ) : null}

        {actions ? (
          <div
            data-slot="promo-card-actions"
            className="mt-auto flex flex-wrap items-center gap-2 pt-2"
          >
            {actions}
          </div>
        ) : null}
      </div>
    </article>
  );
}
