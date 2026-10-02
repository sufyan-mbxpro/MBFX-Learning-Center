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

/**
 * The FILLED status language (changes-59): the hue at /10 with its own ink and
 * a leading dot, for a screen whose whole point is where things stand (the
 * campaign list, the template gallery). The outline form stays the default so
 * every other table keeps its current look.
 */
const TONAL: Record<StatusTone, React.ComponentProps<typeof Badge>["variant"]> = {
  success: "success",
  warning: "warning",
  info: "info",
  neutral: "pill",
  destructive: "danger",
};

export function StatusBadge({
  tone,
  appearance = "outline",
  className,
  children,
}: {
  tone: StatusTone;
  appearance?: "outline" | "tonal";
  className?: string;
  children: React.ReactNode;
}) {
  if (appearance === "tonal") {
    return (
      <Badge variant={TONAL[tone]} className={cn("h-6 gap-1.5 px-2.5", className)}>
        {/* A status dot is a circle by geometry (ADR-107). */}
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {children}
      </Badge>
    );
  }
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

/**
 * The FULL content status machine (courses, lessons, glossary), which runs
 * three states wider than the article one: DRAFT → IN_REVIEW → SEO_REVIEW →
 * APPROVED → SCHEDULED/PUBLISHED. Kept separate from ARTICLE_STATUS_TONE
 * rather than merged into it, because the two enums genuinely differ and a
 * union map would silently give an article a tone for a state it can never
 * reach.
 */
export const CONTENT_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  IN_REVIEW: "info",
  SEO_REVIEW: "info",
  APPROVED: "info",
  SCHEDULED: "info",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export const TRANSLATION_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  IN_REVIEW: "info",
  PUBLISHED: "success",
  OUTDATED: "warning",
  // Reviewed by a person, and so indexable on the public site (ADR-159 #2).
  TRANSLATED: "success",
  // changes-29 B3. `info`, not `success`: a machine translation is finished
  // text that nobody has read, which is a different claim from a reviewed one
  // and must not look the same as `TRANSLATED`.
  MACHINE_TRANSLATED: "info",
};

export function statusTone(map: Record<string, StatusTone>, status: string): StatusTone {
  return map[status] ?? "neutral";
}
