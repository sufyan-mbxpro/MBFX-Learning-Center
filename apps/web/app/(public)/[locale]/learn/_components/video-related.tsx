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
import type { VideoTopicCardView } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";

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
    <Section spacing="md" tone="muted">
      <Container className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">{heading}</h2>
            <p className="text-sm text-muted-foreground">{intro}</p>
          </div>
          <Link
            href={allHref}
            className="text-sm font-medium text-primary-interactive underline-offset-4 hover:underline"
          >
            {allLabel}
          </Link>
        </div>
      </Container>

      {/* The shelf brings its own Section and Container. Nested Sections are
          how every other rail on the site composes (the homepage video rail
          does the same), and the outer one supplies only the tone. */}
      <VideoShelf topics={topics} categories={[]} basePath={basePath} />
    </Section>
  );
}
