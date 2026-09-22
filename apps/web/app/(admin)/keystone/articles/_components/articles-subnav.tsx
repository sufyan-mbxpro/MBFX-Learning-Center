// In-page sub-navigation for the News & Analysis section (Articles /
// Categories / Tags) — the shared SubNav with its longest-prefix active
// rule; the sidebar stays single-level.
//
// Rendered by the section LAYOUT since ADR-106, not by each screen, so a tab
// click swaps the content and leaves the strip where it is.
import { SubNav, type SubNavItem } from "../../_components/sub-nav.tsx";

export type ArticlesSubnavItem = SubNavItem;

export function ArticlesSubnav({ items }: { items: ArticlesSubnavItem[] }) {
  // No bottom rule any more — SubNav carries its own tray/border, and the
  // two together read as a box inside a box.
  return <SubNav items={items} />;
}
