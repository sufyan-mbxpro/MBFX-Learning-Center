"use client";

// "Track your progress" — the signed-out reminder on the course and lesson
// pages (changes-46, owner: "when we open the course show the sign-in option
// for the reminder to save the progress", after image-106).
//
// ─── Who sees it ──────────────────────────────────────────────────────────
//
// A reader the public session says is ANONYMOUS (ADR-094's one session read —
// these pages are cached and read no session on the server, ADR-056 #1) AND
// for whom the progress endpoint answered `guest`. The second half is what
// keeps the promise honest: `off` means `courses` or `progress_tracking` is
// switched off for this reader, and offering to unlock a feature that does
// not exist is ADR-056 #3's broken promise. Both reads are already in flight
// on these pages (the provider and ProgressProvider), so this costs no
// request of its own. Until BOTH have answered it renders nothing, so a
// signed-in learner never sees it flash.
//
// ─── The gauge ────────────────────────────────────────────────────────────
//
// Drawn, not a picture: an SVG semicircle whose strokes are theme TOKENS
// (`stroke-muted`, a `--primary` gradient), so it follows the admin's brand
// colour and the reader's mode like everything else, and no blue (ADR-142).
// The count is the course's REAL total with zero done — the meter the reader
// would get, shown locked, never an invented "168 of 456".
import { ArrowRight, Lock, LogIn, UserPlus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useId } from "react";
import { useTranslations } from "next-intl";

import { ROUTE_PATHS } from "@repo/contracts";
import { Link } from "@repo/i18n/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import { usePublicSession } from "../../_components/public-session.tsx";
import { useProgress } from "./progress-provider.tsx";

/** True once both reads agree this is a guest on a page where progress exists. */
function useShowSignInReminder(): boolean {
  const session = usePublicSession();
  const { status } = useProgress();
  return session.status === "anonymous" && status === "guest";
}

/**
 * Sign-in carrying `?redirect=` back to THIS page — the shape
 * `SaveProgressPrompt` uses, and for its reason: `next/navigation`'s pathname
 * keeps the locale prefix the sign-in form `location.assign`s as-is.
 */
function useSignInHref(): string {
  const pathname = usePathname();
  return pathname
    ? `${ROUTE_PATHS["sign-in"]}?${new URLSearchParams({ redirect: pathname }).toString()}`
    : ROUTE_PATHS["sign-in"];
}

function LockedGauge({ total }: { total: number }) {
  const t = useTranslations("learn");
  const gradientId = useId();
  // A semicircle on a 240×132 box: centre (120,120), radius 96.
  const arc = "M 24 120 A 96 96 0 0 1 216 120";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-60 max-w-full">
        <svg viewBox="0 0 240 132" role="img" aria-label={t("progress.trackGaugeLabel")}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: "var(--primary)", stopOpacity: 0.35 }} />
              <stop offset="100%" style={{ stopColor: "var(--primary)", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <path
            d={arc}
            fill="none"
            strokeWidth={22}
            strokeLinecap="round"
            className="stroke-muted"
          />
          {/* The meter the reader would get, shown dimmed: locked, not empty. */}
          <path
            d={arc}
            fill="none"
            strokeWidth={22}
            strokeLinecap="round"
            stroke={`url(#${gradientId})`}
            className="opacity-40"
          />
          {/* The needle rests on zero — the honest reading for a guest. */}
          <line
            x1={120}
            y1={120}
            x2={46}
            y2={112}
            strokeWidth={6}
            strokeLinecap="round"
            className="stroke-foreground"
          />
          <circle cx={120} cy={120} r={13} className="fill-foreground" />
        </svg>
        {/* A circle is this badge's geometry, so `rounded-full` (ADR-107). */}
        <span className="absolute -top-2 end-0 flex size-16 flex-col items-center justify-center gap-0.5 rounded-full bg-primary text-primary-foreground shadow-float ring-4 ring-card">
          <Lock aria-hidden className="size-5" />
          <span className="px-1 text-center text-3xs leading-tight font-semibold">
            {t("progress.trackBadge")}
          </span>
        </span>
      </div>
      <p className="flex items-baseline gap-2 font-display text-4xl font-bold tabular-nums">
        {t("progress.trackCount", { done: 0, total })}
      </p>
      <Badge variant="pill">{t("progress.trackCountLabel")}</Badge>
    </div>
  );
}

/** The course page's band: the locked gauge beside the offer. */
export function TrackProgressBand({
  lessonsTotal,
  className,
}: {
  lessonsTotal: number;
  className?: string;
}) {
  const t = useTranslations("learn");
  const show = useShowSignInReminder();
  const signInHref = useSignInHref();
  if (!show) return null;

  return (
    <aside
      aria-labelledby="track-progress-title"
      className={cn(
        "rise-enter grid grid-cols-1 items-center gap-8 rounded-xl border border-primary/20 bg-primary/5 p-6 sm:p-8 md:grid-cols-(--grid-gauge-copy)",
        className,
      )}
    >
      <LockedGauge total={lessonsTotal} />
      <div className="flex flex-col items-start gap-3">
        <Badge variant="eyebrow">{t("progress.trackEyebrow")}</Badge>
        <h2
          id="track-progress-title"
          className="text-2xl font-semibold tracking-tight text-balance"
        >
          {t("progress.trackTitle")}
        </h2>
        <p className="text-pretty text-muted-foreground">{t("progress.trackBody")}</p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button size="lg" render={<Link href={signInHref} />}>
            <LogIn data-icon="inline-start" aria-hidden />
            {t("progress.trackAction")}
          </Button>
          <Button size="lg" variant="ghost" render={<Link href={ROUTE_PATHS["sign-up"]} />}>
            <UserPlus data-icon="inline-start" aria-hidden />
            {t("progress.trackJoin")}
          </Button>
        </div>
      </div>
    </aside>
  );
}

/** The lesson page's one-line version: the same rule, the same door, no gauge. */
export function ProgressSignInReminder({ className }: { className?: string }) {
  const t = useTranslations("learn");
  const show = useShowSignInReminder();
  const signInHref = useSignInHref();
  if (!show) return null;

  return (
    <aside
      className={cn(
        "rise-enter flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary-interactive"
      >
        <Lock className="size-4" />
      </span>
      <p className="min-w-0 flex-1 text-sm">{t("progress.reminderText")}</p>
      <Button size="sm" render={<Link href={signInHref} />}>
        {t("progress.reminderAction")}
        <ArrowRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
      </Button>
    </aside>
  );
}
