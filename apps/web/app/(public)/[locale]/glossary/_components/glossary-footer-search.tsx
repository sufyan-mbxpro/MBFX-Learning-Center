// "Search the Glossary" — the closing block on a term page (ADR-069).
//
// The reference screen puts an A–Z rail and a Popular-terms rail at the foot
// of every definition, and the reason it works is that a reader who just
// looked up one term is usually looking up a second. Before this the term page
// ended with the definition and a single "All terms" link.
//
// A SERVER component, and it carries no search input. The reference block does
// not have one either, and adding one here would mean either a second search
// implementation or a query parameter that `GlossaryBrowser` — which is
// explicit that "nothing here touches the URL" — does not read. The chips are
// the way in; the search lives on `/glossary`, one click away.
//
// The chips are LINKS, not anchors. On `/glossary` the letter headings exist
// and `GlossaryBrowser`'s bar jumps to them; here they point at
// `/glossary#glossary-<letter>`, because a jump link to a heading that is not
// on this page is a broken control.
import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";

/** `#` first, then A–Z — the same set `GlossaryBrowser` renders. */
const ALPHABET = ["#", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];

export function GlossaryFooterSearch({
  popular,
  labels,
}: {
  popular: { termId: string; term: string; slug: string }[];
  labels: {
    title: string;
    lead: string;
    alphabetLabel: string;
    popularTerms: string;
  };
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-semibold tracking-tight">{labels.title}</h2>
          <p className="text-muted-foreground">{labels.lead}</p>
        </div>

        <nav aria-label={labels.alphabetLabel} className="flex flex-wrap gap-1.5">
          {ALPHABET.map((letter) => (
            <Link
              key={letter}
              href={`${ROUTE_PATHS.glossary}#glossary-${letter === "#" ? "hash" : letter}`}
              className="flex size-9 items-center justify-center rounded-md border text-sm font-medium text-muted-foreground transition-colors duration-(--duration-fast) hover:border-primary/30 hover:bg-primary/10 hover:text-primary-interactive"
            >
              {letter}
            </Link>
          ))}
        </nav>
      </div>

      {/* Absent, not empty: on a glossary with one term there is nothing
          popular to show and the column simply does not render. */}
      {popular.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{labels.popularTerms}</h2>
          <ul className="flex flex-wrap gap-2">
            {popular.map((entry) => (
              <li key={entry.termId}>
                <Link
                  href={`${ROUTE_PATHS.glossary}/${entry.slug}`}
                  className="inline-flex items-center rounded-md border px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors duration-(--duration-fast) hover:border-primary/30 hover:bg-primary/10 hover:text-primary-interactive"
                >
                  {entry.term}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
