import {
  ArrowLeftRight,
  Calculator,
  Clock,
  Coins,
  Gauge,
  GitFork,
  Grid3x3,
  Percent,
  type LucideIcon,
} from "lucide-react";
import { TOOL_KEYS, type ToolKey } from "@repo/contracts";

// Registry key → component (ADR-048's split, applied to tools).
//
// `ToolSpec.icon` holds a NAME, because `@repo/contracts` depends only on zod
// and may not import lucide-react. This map is where that name becomes a
// component, and `satisfies Record<ToolKey, LucideIcon>` is what makes a tool
// added without an icon a type error rather than a blank square — a lucide
// name held as a string is a key nothing validates.
export const TOOL_ICONS = {
  "position-size": Calculator,
  "pip-value": Coins,
  "gain-loss": Percent,
  "pivot-points": GitFork,
  "market-hours": Clock,
  "currency-converter": ArrowLeftRight,
  correlation: Grid3x3,
  "risk-sentiment": Gauge,
} satisfies Record<ToolKey, LucideIcon>;

/** Every registry key has an icon here — the type above guarantees it. */
export function hasIconForEveryTool(): boolean {
  return TOOL_KEYS.every((key) => key in TOOL_ICONS);
}
