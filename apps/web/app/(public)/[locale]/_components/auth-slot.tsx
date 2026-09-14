"use client";

// The header's auth chip.
//
// It owned the public surface's session fetch until changes-28 (ADR-094); it
// now consumes `PublicSessionProvider`, which does that fetch once for the
// whole page. The reasoning for reading the session on the CLIENT at all — a
// cached public shell must not carry an uncached `auth()` — moved with it, and
// lives in `public-session.tsx`.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { resendVerification } from "../../../_lib/credentials.ts";
import { Skeleton, SkeletonButton } from "@repo/ui/components/skeleton";
import { usePublicSession } from "./public-session.tsx";

export function AuthSlot({ verifiedHref }: { verifiedHref: string }) {
  const t = useTranslations("nav");
  const state = usePublicSession();
  const [resent, setResent] = useState<"idle" | "sent" | "failed">("idle");
  const [resending, startResend] = useTransition();

  // The anonymous pair's own shape — the link and the 36px pill — because that
  // is what most visitors resolve to, so the header does not shift when the
  // session answers (changes-21 Phase A; it was an ad-hoc pulsing span).
  if (state.status === "loading") {
    return (
      <div aria-hidden className="flex items-center gap-2 sm:gap-3">
        <Skeleton className="h-5 w-12" />
        <SkeletonButton size="sm" shape="pill" />
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
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/sign-in"
          className="text-sm font-medium whitespace-nowrap text-primary-interactive underline-offset-4 hover:underline"
        >
          {t("signIn")}
        </Link>
        <Button size="sm" shape="pill" render={<Link href="/sign-up" />}>
          {t("signUp")}
        </Button>
      </div>
    );
  }

  // The account menu proper lands with the user-facing account area
  // (Module 12); until then the chip reflects auth state, plus the one thing
  // an unverified learner can act on.
  //
  // ADR-079 #7 asked for this in an account MENU. There is no menu yet, so it
  // renders beside the chip instead of waiting for one — the nudge is the
  // whole point of sending verification without blocking sign-in, and a nudge
  // deferred to a later module is a verification email nobody ever acts on.
  return (
    <div className="flex items-center gap-2">
      {!state.emailVerified && state.email && (
        <span className="flex items-center gap-1.5">
          {resent === "sent" ? (
            <span role="status" className="text-xs text-success-interactive">
              {t("verifySent")}
            </span>
          ) : (
            <Button
              size="2xs"
              variant="outline"
              loading={resending}
              className="text-warning-interactive"
              onClick={() =>
                startResend(async () => {
                  const ok = await resendVerification(state.email, verifiedHref);
                  setResent(ok ? "sent" : "failed");
                })
              }
            >
              {resent === "failed" ? t("verifyRetry") : t("verifyEmail")}
            </Button>
          )}
        </span>
      )}
      <span className="max-w-32 truncate text-sm text-muted-foreground">{state.name}</span>
    </div>
  );
}
