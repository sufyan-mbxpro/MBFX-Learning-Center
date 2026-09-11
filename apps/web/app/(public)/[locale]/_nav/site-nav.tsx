"use client";

// The desktop primary navigation (ADR-048, changes-09-plan.md PR 3).
//
// A client component for one reason: the panel registry carries icon
// COMPONENTS, which cannot cross the server/client boundary as props. The
// server header still owns the data — it passes plain serializable NavItem
// slices — and this file only decides how they are arranged. Column
// headings come from the catalog through `useTranslations`, which works
// because the public layout already wraps the tree in
// NextIntlClientProvider.
//
// Items WITHOUT a registered panel keep the plain link/dropdown treatment
// they have always had; panels arrive section by section (ADR-042's
// cadence), so this is a superset of the old header, never a replacement
// that leaves an item unrenderable.
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  MegaMenu,
  MegaMenuColumn,
  MegaMenuContent,
  MegaMenuFeature,
  MegaMenuFooter,
  MegaMenuItem,
  MegaMenuLink,
  MegaMenuList,
  MegaMenuPanel,
  MegaMenuStrip,
  MegaMenuTrigger,
  MegaMenuViewport,
} from "@repo/ui/components/mega-menu";
import { NavLink } from "../_components/nav-link.tsx";
import { panelForHref, resolveMegaMenuPanel, type MegaResolvableItem } from "./mega-menu.ts";

export interface SiteNavItem extends MegaResolvableItem {
  children: MegaResolvableItem[];
}

/** One panel link/feature: an internal <Link> unless the row is external. */
function linkRender(item: MegaResolvableItem) {
  const external = item.isExternal || item.openInNewTab;
  const target = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return item.isExternal ? (
    <a href={item.href} {...target} />
  ) : (
    <Link href={item.href} {...target} />
  );
}

export function SiteNav({ items, ariaLabel }: { items: SiteNavItem[]; ariaLabel: string }) {
  const t = useTranslations("nav");

  return (
    <MegaMenu aria-label={ariaLabel} className="hidden lg:block">
      <MegaMenuList>
        {items.map((item) => {
          const panel = item.children.length > 0 ? panelForHref(item.href) : null;

          // 1. A registered panel — the mega treatment.
          if (panel) {
            const resolved = resolveMegaMenuPanel(panel, item.children);
            return (
              <MegaMenuItem key={item.id}>
                <MegaMenuTrigger>{item.label}</MegaMenuTrigger>
                <MegaMenuContent>
                  <MegaMenuPanel
                    // One column and no rail is a LIST, not a grid — the wide
                    // box would leave two thirds of a very large popup empty
                    // (ADR-065 §4).
                    size={
                      resolved.columns.length === 1 && resolved.features.length === 0
                        ? "compact"
                        : "wide"
                    }
                    features={
                      resolved.features.length > 0
                        ? resolved.features.map(({ item: feature, icon }) => (
                            <MegaMenuFeature
                              key={feature.id}
                              icon={icon ?? ChevronDown}
                              title={feature.label}
                              description={feature.title ?? undefined}
                              render={linkRender(feature)}
                            />
                          ))
                        : undefined
                    }
                  >
                    {resolved.columns.map((column) => (
                      <MegaMenuColumn key={column.key} title={t(column.titleKey)}>
                        {column.items.map(({ item: child, icon }) => (
                          <MegaMenuLink
                            key={child.id}
                            icon={icon}
                            title={child.label}
                            description={child.title ?? undefined}
                            render={linkRender(child)}
                          />
                        ))}
                      </MegaMenuColumn>
                    ))}
                  </MegaMenuPanel>

                  {resolved.strip && (
                    <MegaMenuStrip
                      title={t(resolved.strip.titleKey)}
                      description={t(resolved.strip.descriptionKey)}
                    />
                  )}

                  {resolved.viewAll && (
                    <MegaMenuFooter
                      label={item.label}
                      actionLabel={t("mega.viewAll")}
                      render={linkRender(resolved.viewAll)}
                    />
                  )}
                </MegaMenuContent>
              </MegaMenuItem>
            );
          }

          // 2. Children but no panel yet — the plain dropdown, unchanged.
          if (item.children.length > 0) {
            return (
              <MegaMenuItem key={item.id}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                        {item.label}
                        <ChevronDown
                          aria-hidden
                          className="size-3.5 transition-transform duration-(--duration-base) group-aria-expanded/button:rotate-180"
                        />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="start">
                    {item.children.map((child) => (
                      <DropdownMenuItem
                        key={child.id}
                        render={
                          <NavLink
                            href={child.href}
                            isExternal={child.isExternal}
                            openInNewTab={child.openInNewTab}
                          >
                            {child.label}
                          </NavLink>
                        }
                      />
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </MegaMenuItem>
            );
          }

          // 3. A plain destination.
          return (
            <MegaMenuItem key={item.id}>
              <NavLink
                href={item.href}
                isExternal={item.isExternal}
                openInNewTab={item.openInNewTab}
                className="link-underline inline-flex h-9 items-center px-3 py-1"
              >
                {item.label}
              </NavLink>
            </MegaMenuItem>
          );
        })}
      </MegaMenuList>

      <MegaMenuViewport />
    </MegaMenu>
  );
}
