"use client";

// Topbar notification bell (changes-01 / ADR-014). Items arrive already
// translated from the server shell (type → catalog string with the detail
// interpolated); this component only renders, marks read, and navigates.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Bell } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "../_actions/notification-actions.ts";

export interface NotificationItem {
  id: string;
  text: string;
  href: string | null;
  read: boolean;
  createdAt: string; // ISO — formatted client-side
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((then - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

export function NotificationBell({
  items,
  unreadCount,
  labels,
}: {
  items: NotificationItem[];
  unreadCount: number;
  labels: { title: string; empty: string; markAllRead: string; openMenu: string };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const markRead = (id: string) =>
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={labels.openMenu} className="relative">
            <Bell className="size-4.5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-0.5 -end-0.5 h-4 min-w-4 px-1 text-[0.625rem]"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        {/* Plain heading, not DropdownMenuLabel — Base UI's GroupLabel
            demands a Menu.Group ancestor, and this header row isn't one. */}
        <div className="flex items-center justify-between gap-2 px-1.5 py-1">
          <span className="text-sm font-medium">{labels.title}</span>
          {unreadCount > 0 && (
            <Button
              variant="link"
              size="xs"
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsReadAction();
                  router.refresh();
                })
              }
            >
              {labels.markAllRead}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-1.5 py-4 text-center text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <DropdownMenuGroup className="max-h-80 overflow-y-auto">
            {items.map((item) => {
              const body = (
                <span className="flex w-full flex-col items-start gap-0.5 py-0.5">
                  <span className={cn("text-sm", !item.read && "font-medium")}>
                    {!item.read && (
                      <span
                        aria-hidden
                        className="mb-0.5 me-1.5 inline-block size-1.5 rounded-full bg-primary"
                      />
                    )}
                    {item.text}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(item.createdAt)}
                  </span>
                </span>
              );
              return item.href ? (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => markRead(item.id)}
                  render={<Link href={item.href}>{body}</Link>}
                />
              ) : (
                <DropdownMenuItem key={item.id} onClick={() => markRead(item.id)}>
                  {body}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
