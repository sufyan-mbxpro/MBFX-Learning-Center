// Settings sub-sidebar (changes-01, image-4): every settings destination —
// registry groups plus the feature screens the hub fronts — with an
// active-state highlight via the shared SubNav. Entries arrive permission-
// filtered from the server page. Below md the list runs horizontally
// (scrollable) instead of stacking above the content.
import { SubNav } from "../../_components/sub-nav.tsx";

/** One route tab of a tabbed settings section (changes-51). */
export interface SettingsSectionTab {
  href: string;
  label: string;
  exact?: boolean;
}

export interface SettingsNavEntry {
  href: string;
  label: string;
  /**
   * Match by prefix instead of exactly (changes-51). A tabbed section — Email,
   * AI — stays highlighted on every tab under it, where a registry group's
   * entry must not light up for `/keystone/settings/email` while on `general`.
   */
  prefix?: string;
}

export function SettingsNav({
  heading,
  entries,
}: {
  heading: string;
  entries: SettingsNavEntry[];
}) {
  return (
    <div className="flex min-w-0 shrink-0 flex-col gap-1 md:w-52">
      <p className="px-2.5 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {heading}
      </p>
      <SubNav
        aria-label={heading}
        items={entries.map((entry) =>
          entry.prefix
            ? { href: entry.href, label: entry.label, match: entry.prefix }
            : { href: entry.href, label: entry.label, exact: true },
        )}
        orientation="vertical"
        className="flex-row overflow-x-auto md:flex-col md:overflow-x-visible"
      />
    </div>
  );
}
