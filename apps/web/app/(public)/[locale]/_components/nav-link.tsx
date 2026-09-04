"use client";

import { usePathname, Link } from "@repo/i18n/navigation";
import { cn } from "@repo/ui/lib/utils";

/** Client wrapper purely so the active item gets aria-current — the layout-rendered header can't know the pathname under PPR. */
export function NavLink({
  href,
  isExternal,
  openInNewTab,
  className,
  children,
}: {
  href: string;
  isExternal: boolean;
  openInNewTab: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive =
    !isExternal && (pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)));
  const external = isExternal || openInNewTab;

  const classes = cn(
    "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground",
    className,
  );

  if (isExternal) {
    return (
      <a
        href={href}
        className={classes}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={classes}
      aria-current={isActive ? "page" : undefined}
      {...(openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}
