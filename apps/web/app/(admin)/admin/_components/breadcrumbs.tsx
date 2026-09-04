"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { useTranslations } from "next-intl";

/** Catalog keys for the static admin segments; dynamic ids fall through. */
const SEGMENT_KEYS: Record<string, string> = {
  admin: "dashboard",
  users: "users",
  roles: "roles",
  employees: "employees",
  glossary: "glossary",
  settings: "settings",
  features: "features",
  navigation: "navigation",
  social: "social",
  theme: "theme",
  profile: "profile",
  articles: "articles",
  categories: "articleCategories",
  tags: "articleTags",
};

/** Path-derived breadcrumbs with translated labels for known segments;
 * dynamic ids (cuids) render truncated — detail pages carry the real name
 * in their own heading. */
export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations("admin");
  const segments = pathname.split("/").filter(Boolean);

  const labelFor = (segment: string) => {
    const key = SEGMENT_KEYS[segment];
    if (key) return t(key);
    return segment.length > 12 ? `${segment.slice(0, 12)}…` : segment;
  };

  return (
    <nav
      aria-label={t("breadcrumbLabel")}
      className="flex items-center gap-1.5 overflow-x-auto text-sm whitespace-nowrap text-muted-foreground"
    >
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        return (
          <Fragment key={href}>
            {index > 0 && <span aria-hidden>/</span>}
            {isLast ? (
              <span aria-current="page" className="font-medium text-foreground">
                {labelFor(segment)}
              </span>
            ) : (
              <Link href={href} className="hover:text-foreground">
                {labelFor(segment)}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
