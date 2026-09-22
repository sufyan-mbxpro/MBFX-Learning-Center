// The one 404 design (changes-49), used by both not-found surfaces:
//
//   - `(public)/[locale]/not-found.tsx` — inside the site chrome, for a record
//     a real route could not find (an article slug that does not exist);
//   - `global-not-found.tsx` — the whole document, for an address nothing
//     answers, which the proxy now sends there with a REAL 404 status
//     (ADR-146).
//
// The owner asked for a "coming soon" page rather than a dead end: most
// addresses a reader guesses at are sections they expected the site to have.
// So the page says the part is on its way, keeps the 404 number as the
// honest status, and offers four real destinations — never a promise about a
// specific page, because it cannot know which one the reader wanted.
//
// Server-only and link-agnostic: the caller passes the anchor it can render
// (the locale-aware `Link` inside the site, a plain `<a>` outside it), so this
// file imports nothing from `@repo/i18n`'s navigation or from next/link.
import { ArrowRight, Calculator, GraduationCap, LifeBuoy, Newspaper } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Container } from "@repo/ui/components/container";

export interface NotFoundLabels {
  eyebrow: string;
  title: string;
  description: string;
  backHome: string;
  exploreTitle: string;
  destinations: Record<NotFoundDestinationKey, { title: string; body: string }>;
}

type NotFoundDestinationKey = "learn" | "tools" | "news" | "support";

const DESTINATIONS: { key: NotFoundDestinationKey; href: string; icon: typeof GraduationCap }[] = [
  { key: "learn", href: "/learn", icon: GraduationCap },
  { key: "tools", href: "/tools", icon: Calculator },
  { key: "news", href: "/news", icon: Newspaper },
  { key: "support", href: "/support", icon: LifeBuoy },
];

export function NotFoundView({
  labels,
  brand,
  renderLink,
}: {
  labels: NotFoundLabels;
  /** The logo, where the page has no header of its own to carry it. */
  brand?: React.ReactNode;
  renderLink: (href: string) => React.ReactElement;
}) {
  return (
    <main className="relative isolate flex flex-1 items-center overflow-clip bg-muted/40 py-16 sm:py-24">
      {/* The status, large and quiet behind the copy: honest about what
          happened without making it the headline. */}
      <p
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 -translate-y-1/2 text-center font-display text-display-numeral font-bold tracking-tight text-foreground/5 select-none"
      >
        404
      </p>
      <Container className="flex flex-col items-center gap-10 text-center">
        {brand}
        <div className="flex max-w-2xl flex-col items-center gap-4">
          <Badge variant="eyebrow" className="uppercase">
            {labels.eyebrow}
          </Badge>
          <h1 className="font-display text-display-sm font-bold tracking-tight text-balance sm:text-display-md">
            {labels.title}
          </h1>
          <p className="text-lg text-pretty text-muted-foreground">{labels.description}</p>
          <Button size="lg" className="mt-2" render={renderLink("/")}>
            {labels.backHome}
            <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
          </Button>
        </div>

        <section aria-labelledby="not-found-explore" className="flex w-full flex-col gap-4">
          <h2
            id="not-found-explore"
            className="text-sm font-semibold tracking-caps text-muted-foreground uppercase"
          >
            {labels.exploreTitle}
          </h2>
          <ul className="grid grid-cols-1 gap-4 text-start sm:grid-cols-2 lg:grid-cols-4">
            {DESTINATIONS.map(({ key, href, icon: Icon }) => (
              <li key={key}>
                <Button
                  variant="outline"
                  className="flex h-full w-full flex-col items-start justify-start gap-2 rounded-lg bg-card p-5 text-start whitespace-normal"
                  render={renderLink(href)}
                >
                  <Icon aria-hidden className="size-5 text-primary-interactive" />
                  <span className="font-semibold">{labels.destinations[key].title}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {labels.destinations[key].body}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </main>
  );
}

/** Resolves the labels from the `notFound` catalog namespace. */
export function notFoundLabels(t: (key: string) => string): NotFoundLabels {
  return {
    eyebrow: t("eyebrow"),
    title: t("comingTitle"),
    description: t("comingDescription"),
    backHome: t("backHome"),
    exploreTitle: t("exploreTitle"),
    destinations: {
      learn: { title: t("learnTitle"), body: t("learnBody") },
      tools: { title: t("toolsTitle"), body: t("toolsBody") },
      news: { title: t("newsTitle"), body: t("newsBody") },
      support: { title: t("supportTitle"), body: t("supportBody") },
    },
  };
}
