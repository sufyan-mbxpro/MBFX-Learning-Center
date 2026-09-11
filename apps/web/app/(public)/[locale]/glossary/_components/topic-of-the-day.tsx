// The glossary masthead's featured TOPIC — `TermOfTheDay`'s pair (ADR-069).
//
// That component's header said this card was deliberately absent because a
// tile fed by `GlossaryTerm.category` free text would render a raw identifier
// with no page behind it. D27 made `GlossaryTopic` a real model with slugs,
// translations and two routes, so the card now has somewhere to go — and this
// is the first surface that actually uses it.
//
// Server component. The rotation is `getTopicOfTheDay`, a cached loader on a
// daily `cacheLife` — no cron, no `featuredOn` column, no admin screen, and
// nothing here reads the clock.
//
// Kept visually distinct from `TermOfTheDay` rather than being one component
// with a variant: they carry different tones and different verbs ("read the
// explanation" vs "start exploring"), because one is a definition and the
// other is a way in to a set of them.
import { Compass } from "lucide-react";
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";

export function TopicOfTheDay({
  name,
  slug,
  description,
  labels,
}: {
  name: string;
  slug: string;
  description: string | null;
  /** `count` arrives PRE-PLURALISED: it is an ICU plural over a number, so it
   * resolves in the page that loaded the topic, not here. */
  labels: { eyebrow: string; explore: string; count: string };
}) {
  const href = `${ROUTE_PATHS.glossary}/topics/${slug}`;

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-info/20 bg-info/5 p-5">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-info-interactive uppercase">
        <Compass aria-hidden className="size-3.5" />
        {labels.eyebrow}
      </p>
      <h2 className="text-lg font-semibold">
        <Link
          href={href}
          className="transition-colors duration-(--duration-fast) hover:text-info-interactive"
        >
          {name}
        </Link>
      </h2>
      {/* A topic without a description renders without one rather than with a
          filler line — the same rule the topics grid applies. */}
      {description && <p className="line-clamp-3 text-sm text-muted-foreground">{description}</p>}
      <p className="text-xs text-muted-foreground tabular-nums">{labels.count}</p>
      <Link href={href} className="link-underline w-fit text-sm font-medium text-info-interactive">
        {labels.explore}
      </Link>
    </article>
  );
}
