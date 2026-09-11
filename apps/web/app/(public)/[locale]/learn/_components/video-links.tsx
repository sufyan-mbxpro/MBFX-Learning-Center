// The topic's labelled links (changes-16 PR 8, ADR-068 §5).
//
// A server component: these are anchors and nothing about them is stateful.
//
// **`isExternal` was derived, not stored.** `@repo/core` decided it from which
// column the row filled, so this file only renders the consequence — it never
// re-inspects an href to guess. That matters because the two branches get
// genuinely different markup:
//
//   - An INTERNAL link goes through @repo/i18n's `Link`, which prefixes the
//     reader's locale. The stored path carries no prefix, deliberately, so one
//     editor's link works in every language (ADR-068 §5).
//   - An EXTERNAL link is a plain `<a>` with `target="_blank"` and
//     `rel="noopener noreferrer"` — and an icon with a visible-to-screen-reader
//     label saying it opens elsewhere, because a new tab that arrives
//     unannounced is disorienting for anyone not watching the tab bar.
import { ArrowUpRight, ExternalLink as ExternalIcon } from "lucide-react";

import type { VideoTopicLinkView } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";

export function VideoLinks({
  links,
  labels,
}: {
  links: VideoTopicLinkView[];
  labels: { heading: string; intro: string; external: string };
}) {
  if (links.length === 0) return null;

  return (
    <section aria-labelledby="video-links-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="video-links-heading" className="text-lg font-semibold">
          {labels.heading}
        </h2>
        <p className="text-sm text-muted-foreground">{labels.intro}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {links.map((link, index) => (
          <li key={index}>
            {link.isExternal ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors duration-(--duration-base) hover:border-primary/30 hover:text-primary-interactive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="min-w-0 truncate">{link.label}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                  {/* Announced, not just drawn: `sr-only` text rather than an
                      `aria-label` on the icon, so the link's own name stays
                      the label the reader chose. */}
                  <span className="sr-only">{labels.external}</span>
                  <ExternalIcon aria-hidden className="size-4" />
                </span>
              </a>
            ) : (
              <Link
                href={link.href}
                className="group flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors duration-(--duration-base) hover:border-primary/30 hover:text-primary-interactive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="min-w-0 truncate">{link.label}</span>
                {/* `rtl:rotate-180` — the arrow points along the reading
                    direction, not rightwards (code-style #3). */}
                <ArrowUpRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-base) group-hover:-translate-y-0.5 rtl:rotate-180"
                />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
