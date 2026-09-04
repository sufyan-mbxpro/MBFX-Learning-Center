// In-page sub-navigation for the News & Analysis section (Articles /
// Categories / Tags / Settings) — the shared SubNav with its
// longest-prefix active rule; the sidebar stays single-level.
import { SubNav } from "../../_components/sub-nav.tsx";

export interface ArticlesSubnavItem {
  href: string;
  label: string;
}

export function ArticlesSubnav({ items }: { items: ArticlesSubnavItem[] }) {
  return <SubNav items={items} className="border-b pb-3" />;
}
