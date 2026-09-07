// In-page sub-navigation for the News & Analysis section (Articles /
// Categories / Tags / Settings) — the shared SubNav with its
// longest-prefix active rule; the sidebar stays single-level.
import { SubNav } from "../../_components/sub-nav.tsx";

export interface ArticlesSubnavItem {
  href: string;
  label: string;
}

export function ArticlesSubnav({ items }: { items: ArticlesSubnavItem[] }) {
  // No bottom rule any more — SubNav carries its own tray/border, and the
  // two together read as a box inside a box.
  return <SubNav items={items} />;
}
