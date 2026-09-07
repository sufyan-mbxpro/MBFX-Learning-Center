// The public breadcrumb trail, shared by the plain listing header and the
// /news masthead (which renders it on a brand-filled band, not on the page
// background).
//
// Extracted from `listing-header.tsx` when the masthead needed the same
// trail: one trail, two surfaces, rather than a second copy that drifts.
// Still not the admin's Breadcrumbs — nothing under app/(public) may import
// from app/(admin) (architecture.md #5), and the public trail is an
// explicit "Home · Section" rather than the admin's path-derived one.
import { getTranslations } from "next-intl/server";

import { Link } from "@repo/i18n/navigation";
import { getSetting } from "@repo/settings";
import { cn } from "@repo/ui/lib/utils";

export interface Crumb {
  label: string;
  /** Omitted for the current page — the last crumb is not a link. */
  href?: string;
}

// `onFill` is opacity off the band's own foreground, never
// `text-muted-foreground`: that token is computed against --background, so on
// PageHero's brand gradient it carries no contrast guarantee. Same reasoning
// PageHero's own eyebrow and lead already follow, and the same `tone="onFill"`
// idiom NewsletterForm uses.
const TONE_CLASS = {
  page: {
    rest: "text-muted-foreground",
    current: "text-foreground",
    hover: "hover:text-foreground",
  },
  onFill: { rest: "opacity-70", current: "opacity-100", hover: "hover:opacity-100" },
} as const;

export async function ListingCrumbs({
  crumbs,
  tone = "page",
  className,
}: {
  crumbs?: Crumb[];
  tone?: keyof typeof TONE_CLASS;
  className?: string;
}) {
  const [t, showBreadcrumbs] = await Promise.all([
    getTranslations("nav"),
    // The setting has existed since Module 08; the public surface honours it
    // here and nowhere else.
    getSetting("layout.showBreadcrumbs"),
  ]);

  const trail: Crumb[] = [{ label: t("home"), href: "/" }, ...(crumbs ?? [])];
  if (showBreadcrumbs === false || trail.length < 2) return null;

  const ink = TONE_CLASS[tone];

  return (
    <nav aria-label={t("breadcrumb")} className={className}>
      <ol className={cn("flex flex-wrap items-center gap-x-2 text-sm", ink.rest)}>
        {trail.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden>·</span>}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className={cn("link-underline transition-opacity", ink.hover)}
              >
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className={ink.current}>
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
