"use client";

// The header's auth chip.
//
// It owned the public surface's session fetch until changes-28 (ADR-094); it
// now consumes `PublicSessionProvider`, which does that fetch once for the
// whole page. The reasoning for reading the session on the CLIENT at all — a
// cached public shell must not carry an uncached `auth()` — moved with it, and
// lives in `public-session.tsx`.
import { useTranslations } from "next-intl";
import { ChevronDown, GraduationCap, LogOut, UserRound } from "lucide-react";
import { ACCOUNT_PATH, ACCOUNT_PROGRESS_PATH } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
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
import { Skeleton, SkeletonButton } from "@repo/ui/components/skeleton";
import { signOut } from "../../../_lib/credentials.ts";
import { rememberSession } from "../../../_lib/session-hint.ts";
import { usePublicSession } from "./public-session.tsx";

export function AuthSlot({
  inMenuBelowXl = false,
}: {
  /**
   * The mobile menu already carries Sign in and Join us (changes-43), so on
   * the widths where that menu is the navigation the header shows the pair a
   * second time for nothing and crowds the logo (changes-45). When true, the
   * anonymous pair — and its loading placeholder — render from `xl` only,
   * where the mobile menu is hidden. A signed-in reader's avatar still shows
   * at every width: that is the account menu, and the sheet has no copy of it.
   */
  inMenuBelowXl?: boolean;
}) {
  const t = useTranslations("nav");
  const state = usePublicSession();
  const anonymousDisplay = inMenuBelowXl ? "hidden xl:flex" : "flex";

  // The anonymous pair's own shape — the link and the 36px pill — because that
  // is what most visitors resolve to, so the header does not shift when the
  // session answers (changes-21 Phase A; it was an ad-hoc pulsing span).
  if (state.status === "loading") {
    return (
      <div aria-hidden className={`${anonymousDisplay} items-center gap-2 sm:gap-3`}>
        <Skeleton className="h-5 w-12" />
        <SkeletonButton size="sm" />
      </div>
    );
  }

  // Both learner entry points (ADR-052). The staff screen at /admin/sign-in
  // is deliberately absent — the public header advertises no way into the
  // admin portal.
  // `whitespace-nowrap` + the narrower phone gap: at 14px (ADR-072 §7) the
  // five header items only just fit a 390px phone, and the link was the one
  // that gave way — "Sign in" broke onto two lines. The 8px gap is what keeps
  // the row inside the page gutter once it stays on one.
  if (state.status === "anonymous") {
    return (
      <div className={`${anonymousDisplay} items-center gap-2 sm:gap-3`}>
        <Link
          href="/sign-in"
          className="text-sm font-medium whitespace-nowrap text-primary-interactive underline-offset-4 hover:underline"
        >
          {t("signIn")}
        </Link>
        <Button size="sm" render={<Link href="/sign-up" />}>
          {t("signUp")}
        </Button>
      </div>
    );
  }

  // ADR-123: the signed-in learner's account menu. It holds the profile page,
  // the progress page (ADR-125) and sign-out.
  //
  // The verify-email nudge is NOT here any more (changes-45, ADR-142 §2). It
  // put a tinted notice box inside a navigation menu, on every page, for as
  // long as the address stayed unverified — and verification blocks nothing
  // (ADR-079 #7). It lives on the profile page alone, in
  // `EmailVerificationPanel`, which already sent through the same
  // rate-limited helper.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-2 px-1.5" aria-label={t("accountMenu")}>
            <Avatar className="size-7">
              {state.image && <AvatarImage src={state.image} alt="" />}
              <AvatarFallback className="text-xs">{initialsOf(state.name)}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-32 truncate text-sm font-medium md:inline">
              {state.name}
            </span>
            <ChevronDown aria-hidden className="hidden size-4 text-muted-foreground md:block" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        {/* Base UI: GroupLabel must live inside a Group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate font-medium">{state.name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {state.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link href={ACCOUNT_PATH}>
              <UserRound aria-hidden /> {t("myAccount")}
            </Link>
          }
        />
        {/* ADR-125: the account's second page. */}
        <DropdownMenuItem
          render={
            <Link href={ACCOUNT_PROGRESS_PATH}>
              <GraduationCap aria-hidden /> {t("myProgress")}
            </Link>
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            await signOut().catch(() => false);
            rememberSession(false);
            // A reload, not a router push: every cached page reads the session
            // on the client, and a reload is how they all re-read it. On the
            // profile page itself, the page sends a signed-out reader to sign in.
            window.location.reload();
          }}
        >
          <LogOut aria-hidden /> {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
