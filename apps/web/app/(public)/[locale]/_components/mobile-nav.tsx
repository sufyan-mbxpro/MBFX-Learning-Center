"use client";

// Mobile companion to the desktop nav (which is hidden below lg): the same
// NavItem data, in the shape a phone can actually use.
//
// This was a dropdown menu; the mega-menu work (ADR-048) moved it to a
// sheet with accordion sections. A dropdown cannot express what a panel
// says — column headings, one-line descriptions, more than a handful of
// rows — and on a phone it opened a scrolling popover over the page rather
// than a surface you can thumb through. The desktop panel's structure is
// preserved: the same columns, in the same order, from the same registry.
import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet";
import { panelForHref, resolveMegaMenuPanel, type MegaResolvableItem } from "../_nav/mega-menu.ts";

export interface MobileNavItem extends MegaResolvableItem {
  children: MegaResolvableItem[];
}

/** One destination row — icon box, label, and the one-line description when there is one. */
function NavRow({
  item,
  icon: Icon,
  onNavigate,
}: {
  item: MegaResolvableItem;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onNavigate: () => void;
}) {
  // Mirrors MegaMenuLink's hover treatment (ADR-051 §6) so the same
  // destination behaves the same way whichever navigation the visitor is in.
  // On touch there is no hover, so :active carries it — a row that gives no
  // feedback until the page changes reads as a dead tap.
  const className =
    "group/row flex items-start gap-3 rounded-xl p-2.5 ring-1 ring-transparent transition-[background-color,box-shadow] duration-(--duration-base) hover:bg-muted hover:ring-primary/25 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:bg-muted";
  const content = (
    <>
      {Icon && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-interactive transition-colors duration-(--duration-base) group-hover/row:bg-primary group-hover/row:text-primary-foreground group-active/row:bg-primary group-active/row:text-primary-foreground">
          <Icon aria-hidden className="size-4" />
        </span>
      )}
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground transition-colors duration-(--duration-base) group-hover/row:text-primary-interactive">
          {item.label}
        </span>
        {item.title && <span className="text-xs text-muted-foreground">{item.title}</span>}
      </span>
    </>
  );

  if (item.isExternal) {
    return (
      <a
        href={item.href}
        className={className}
        onClick={onNavigate}
        {...(item.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      className={className}
      onClick={onNavigate}
      {...(item.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {content}
    </Link>
  );
}

export function MobileNav({ items, menuLabel }: { items: MobileNavItem[]; menuLabel: string }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  if (items.length === 0) return null;

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={menuLabel}>
              <Menu aria-hidden className="size-5" />
            </Button>
          }
        />
        <SheetContent side="start" className="w-[min(22rem,90vw)] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{menuLabel}</SheetTitle>
          </SheetHeader>

          <nav className="flex flex-col gap-1 p-4" aria-label={menuLabel}>
            {items.map((item) => {
              if (item.children.length === 0) {
                return <NavRow key={item.id} item={item} onNavigate={close} />;
              }

              const panel = panelForHref(item.href);
              const resolved = panel ? resolveMegaMenuPanel(panel, item.children) : null;

              return (
                <Accordion key={item.id}>
                  <AccordionItem value={item.id}>
                    <AccordionTrigger className="text-sm font-semibold">
                      {item.label}
                    </AccordionTrigger>
                    {/* AccordionContent underlines every descendant link
                        ([&_a]:underline) — right for the FAQ prose it was built
                        for, wrong for a nav row. Overridden with the important
                        marker because the two selectors tie on specificity. */}
                    <AccordionContent className="[&_a]:no-underline!">
                      <div className="flex flex-col gap-4 pb-2">
                        {resolved
                          ? resolved.columns.map((column) => (
                              <div key={column.key} className="flex flex-col gap-1">
                                <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                  {t(column.titleKey)}
                                </p>
                                {column.items.map(({ item: child, icon }) => (
                                  <NavRow
                                    key={child.id}
                                    item={child}
                                    icon={icon}
                                    onNavigate={close}
                                  />
                                ))}
                              </div>
                            ))
                          : item.children.map((child) => (
                              <NavRow key={child.id} item={child} onNavigate={close} />
                            ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
