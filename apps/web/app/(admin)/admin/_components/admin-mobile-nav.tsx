"use client";

// Mobile stand-in for the admin sidebar (hidden at md+) — a sheet carrying
// the SAME grouped, icon-carrying nav the desktop sidebar renders, instead
// of a flattened dropdown that dropped the group structure. Entries arrive
// permission-filtered from the server shell; the sheet closes itself on
// navigation.
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@repo/ui/components/sheet";
import { AdminSidebarNav, type AdminNavGroup } from "./admin-sidebar-nav.tsx";

export function AdminMobileNav({
  groups,
  menuLabel,
  closeLabel,
}: {
  groups: AdminNavGroup[];
  menuLabel: string;
  closeLabel: string;
}) {
  // Derived open state: the sheet is open only while we're still on the
  // path it was opened on — navigating closes it with no effect needed.
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={(next) => setOpenedAt(next ? pathname : null)}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={menuLabel}>
              <Menu className="size-5" aria-hidden />
            </Button>
          }
        />
        <SheetContent side="start" closeLabel={closeLabel} className="w-[var(--width-sidebar)]">
          <SheetTitle className="px-2.5 text-sm font-semibold">{menuLabel}</SheetTitle>
          <AdminSidebarNav groups={groups} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
