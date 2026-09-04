"use client";

// Topbar avatar dropdown (changes-01, image-6): name/email header, link to
// the profile page where the signed-in admin edits their own details,
// settings shortcut, sign out.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
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

export function ProfileMenu({
  userName,
  email,
  image,
  labels,
}: {
  userName: string;
  email: string;
  image: string | null;
  labels: { profile: string; settings: string; signOut: string; openMenu: string };
}) {
  const router = useRouter();
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={labels.openMenu}>
            <Avatar className="size-7">
              {image && <AvatarImage src={image} alt="" />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        {/* Base UI: GroupLabel must live inside a Group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate font-medium">{userName}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link href="/admin/profile">
              <UserRound aria-hidden /> {labels.profile}
            </Link>
          }
        />
        <DropdownMenuItem
          render={
            <Link href="/admin/settings">
              <Settings aria-hidden /> {labels.settings}
            </Link>
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            await fetch("/api/auth/sign-out", { method: "POST" });
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut aria-hidden /> {labels.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
