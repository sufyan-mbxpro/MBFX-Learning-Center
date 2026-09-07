import {
  BarChart,
  BookOpen,
  DollarSign,
  Globe,
  Shield,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { IconCard } from "@repo/ui/components/icon-card";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type IconCardProps } from "./definition.ts";

const ICON_COMPONENT: Record<IconCardProps["icon"], LucideIcon> = {
  "trending-up": TrendingUp,
  shield: Shield,
  users: Users,
  zap: Zap,
  globe: Globe,
  "book-open": BookOpen,
  "bar-chart": BarChart,
  "dollar-sign": DollarSign,
};

function IconCardBlock({ props, resolvedLinks }: BlockComponentProps<IconCardProps>) {
  const link = resolvedLinks?.link;
  const href = link && link.state === "ok" ? (link.href ?? undefined) : undefined;
  return (
    <IconCard
      icon={ICON_COMPONENT[props.icon]}
      title={props.title}
      render={href ? <a href={href} /> : undefined}
    >
      {props.body || undefined}
    </IconCard>
  );
}

registerBlock(definition, IconCardBlock);

export { IconCardBlock };
