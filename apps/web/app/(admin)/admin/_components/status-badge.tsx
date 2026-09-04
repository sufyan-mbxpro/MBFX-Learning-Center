// THE status badge for admin screens — one tone scale, mapped per domain
// enum, so "active is green, terminated is red" is decided once instead of
// re-derived as ternaries on every page. Labels are passed in already
// translated (leaf-component convention); raw enum values never render.
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

export type StatusTone = "success" | "neutral" | "warning" | "destructive" | "info";

const TONE: Record<
  StatusTone,
  { variant: React.ComponentProps<typeof Badge>["variant"]; className?: string }
> = {
  success: { variant: "outline", className: "text-success-interactive" },
  warning: { variant: "outline", className: "text-warning-interactive" },
  info: { variant: "outline", className: "text-info-interactive" },
  neutral: { variant: "secondary" },
  destructive: { variant: "destructive" },
};

export function StatusBadge({
  tone,
  className,
  children,
}: {
  tone: StatusTone;
  className?: string;
  children: React.ReactNode;
}) {
  const { variant, className: toneClass } = TONE[tone];
  return (
    <Badge variant={variant} className={cn(toneClass, className)}>
      {children}
    </Badge>
  );
}

// Domain maps — the single source for "which tone does this enum get".
export const USER_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "destructive",
  PENDING_VERIFICATION: "warning",
};

export const EMPLOYEE_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  ON_LEAVE: "warning",
  NOTICE_PERIOD: "warning",
  TERMINATED: "destructive",
  RESIGNED: "neutral",
};

export const ARTICLE_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export const TRANSLATION_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  IN_REVIEW: "info",
  PUBLISHED: "success",
  OUTDATED: "warning",
};

export function statusTone(map: Record<string, StatusTone>, status: string): StatusTone {
  return map[status] ?? "neutral";
}
