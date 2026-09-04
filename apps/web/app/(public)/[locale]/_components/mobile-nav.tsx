"use client";

// Mobile companion to the desktop nav (which is hidden below md): the
// same NavItem data rendered as a menu behind a hamburger trigger.
import { Menu } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { NavLink } from "./nav-link.tsx";

export interface MobileNavItem {
  id: string;
  label: string;
  href: string;
  isExternal: boolean;
  openInNewTab: boolean;
  children: MobileNavItem[];
}

export function MobileNav({ items, menuLabel }: { items: MobileNavItem[]; menuLabel: string }) {
  if (items.length === 0) return null;

  return (
    <div className="lg:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={menuLabel}>
              <Menu aria-hidden className="size-5" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-48">
          {items.map((item) => (
            <div key={item.id}>
              {item.children.length > 0 ? (
                <>
                  {/* Base UI: GroupLabel must live inside a Group. */}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
                    {item.children.map((child) => (
                      <DropdownMenuItem
                        key={child.id}
                        render={
                          <NavLink
                            href={child.href}
                            isExternal={child.isExternal}
                            openInNewTab={child.openInNewTab}
                            className="ps-4"
                          >
                            {child.label}
                          </NavLink>
                        }
                      />
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              ) : (
                <DropdownMenuItem
                  render={
                    <NavLink
                      href={item.href}
                      isExternal={item.isExternal}
                      openInNewTab={item.openInNewTab}
                    >
                      {item.label}
                    </NavLink>
                  }
                />
              )}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
