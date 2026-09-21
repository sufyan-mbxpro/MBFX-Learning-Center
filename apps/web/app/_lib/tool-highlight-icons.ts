import {
  BookOpen,
  Calculator,
  Check,
  Clock,
  Coins,
  Globe,
  Info,
  Layers,
  Shield,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { TOOL_HIGHLIGHT_ICONS, type ToolHighlightIcon } from "@repo/contracts";

// Highlight glyph name → component (ADR-114 #3).
//
// ADR-048's split, one level down from `TOOL_ICONS`, with one difference that
// decides where the file lives: these names are chosen by an ADMIN in a form
// and rendered on a PUBLIC page, so both surfaces need the map. It sits in
// `app/_lib` rather than under either of them — architecture.md #5 is about
// public code never reaching into admin, and the way to honour that is shared
// code in a shared place, not an admin panel importing a public component's
// sibling through six `..` segments.
//
// `satisfies Record<ToolHighlightIcon, LucideIcon>` is what makes retiring a
// name from `TOOL_HIGHLIGHT_ICONS` without retiring it here a type error, and
// adding one here without declaring it in the contract equally so — the half a
// `Partial` would let through, which would then render as a gap in a row of
// four cards.
export const TOOL_HIGHLIGHT_ICON_COMPONENTS = {
  calculator: Calculator,
  target: Target,
  shield: Shield,
  zap: Zap,
  globe: Globe,
  "book-open": BookOpen,
  clock: Clock,
  "trending-up": TrendingUp,
  layers: Layers,
  coins: Coins,
  info: Info,
  check: Check,
} satisfies Record<ToolHighlightIcon, LucideIcon>;

/** Every contract-declared highlight glyph has a component here. */
export function hasComponentForEveryHighlightIcon(): boolean {
  return TOOL_HIGHLIGHT_ICONS.every((name) => name in TOOL_HIGHLIGHT_ICON_COMPONENTS);
}
