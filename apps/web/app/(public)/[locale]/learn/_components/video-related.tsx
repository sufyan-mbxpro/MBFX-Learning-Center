// The detail page's related rail (changes-16 PR 8).
//
// It renders the SAME `VideoShelf` the index does, given a short list, rather
// than a second card component: a topic looks the same wherever it appears,
// and a "related" variant would be a second place for the card's rules
// (ADR-068 §7's no-stretched-link, the play affordance, the guide badge) to
// drift out of step.
//
// `categories` is empty on purpose, which is what suppresses the chip row —
// `VideoShelf` only draws chips when there is more than one, and a filter
// inside a three-card rail would be a control with nothing to do.
//
// Nothing renders at all when there is nothing to relate to. An empty
// "More in this category" heading over a blank strip is worse than the page
// simply ending, and it happens on every school's first published topic.
//
// ─── Why the heading goes THROUGH the shelf (changes-22) ───────────────────
//
// This used to be a muted Section wrapping a heading Container and then the
// shelf. The shelf brings its own Section, and a Section paints a background —
// so the inner default-toned one painted `bg-background` straight over the
// outer tint. The result on screen was a grey strip that stopped at the
// heading, with the cards it introduced sitting on white below it: one section
// that looked like two broken ones. Passing the band and the heading into the
// shelf makes that unrepresentable rather than a thing to remember.
//
// Centred, because this block closes the page and has no column to align to:
// the article above it is a measure-width prose column, and a heading flush to
// the start edge of a full-width band under it reads as a fourth column
// starting rather than as a footer to the three things above.
import { ArrowRight } from "lucide-react";

import type { VideoTopicCardView } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";

import { VideoShelf } from "./video-shelf.tsx";

export function VideoRelated({
  topics,
  basePath,
  heading,
  intro,
  allHref,
  allLabel,
}: {
  topics: VideoTopicCardView[];
  basePath: string;
  heading: string;
  intro: string;
  allHref: string;
  allLabel: string;
}) {
  if (topics.length === 0) return null;

  return (
    <VideoShelf
      topics={topics}
      categories={[]}
      basePath={basePath}
      tone="muted"
      // The index owns `#videos`; a second element with that id on the detail
      // page would make the anchor ambiguous.
      anchorId={null}
      header={
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-semibold text-balance">{heading}</h2>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">{intro}</p>
          {/* A button, not the bare link this had: on a tinted band a text
              link at `text-sm` was the quietest thing in the block while
              being the only thing in it that goes anywhere. */}
          <Button variant="outline" size="sm" shape="pill" render={<Link href={allHref} />}>
            {allLabel}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        </div>
      }
    />
  );
}
