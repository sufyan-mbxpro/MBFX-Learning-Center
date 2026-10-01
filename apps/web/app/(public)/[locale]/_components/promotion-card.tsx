"use client";

// One public promotion, drawn (ADR-167, changes-52 P4). Shared by the popup
// and the home band, so the two cannot drift: same words, same order, same
// link rules — only the frame and the dismiss control differ. The home
// spotlight (ADR-175) draws its own frame and renders the two parts that carry
// RULES — `PromotionCta` and `PromotionEventMeta` — from here.
//
// Client-side because the event time is formatted in the READER's time zone,
// which only the browser knows. It waits for hydration to print it, so the
// server's markup (no time) is what the browser first matches.
//
// A webinar or event also follows its OWN clock here (changes-52 P5), because
// the list it came from is cached for a minute and the band's page for longer:
// before the start it counts down and offers "Add to calendar", during it says
// it is live, and after the end a recording, when there is one, replaces the
// button. All of it waits for hydration too, so a cached server render can
// never disagree with the reader's clock.
import { useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  Download,
  ExternalLink,
  PlayCircle,
} from "lucide-react";
import {
  promotionCalendarPath,
  promotionCountdown,
  promotionEventPhase,
  type PromotionCountdown,
} from "@repo/contracts";
import type { PublicPromotion } from "@repo/core";
import { getPathname, Link } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { PromoCard } from "@repo/ui/components/promo-card";
import { RichText } from "@repo/ui/components/rich-text";
import {
  formatDateTime,
  formatDurationParts,
  googleCalendarUrl,
  htmlToText,
  outlookCalendarUrl,
} from "@repo/utils";
import { PROMOTION_KIND_TONE } from "../../../_lib/promotion-kind-tone.ts";

/**
 * Every promotion picture is drawn 3% larger than its frame (changes-57).
 * Uploaded art often carries a thin white edge baked into the file (one seen
 * had 13px down the right and 12px across the top of 1920×1080), and
 * `object-cover` faithfully drew it as a line along the card's edge. 1.5% off
 * each side crops a border like that without losing anything a reader would
 * miss. Shared by the popup, the home band and the banners, so no surface
 * shows the line the others hide.
 */
export const PROMOTION_PICTURE_CROP = "scale-103";

const noop = () => () => {};
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * The time, as an external store ticking every 15 s while `active` — often
 * enough that a minute countdown or a phase change is never more than a
 * quarter-minute late, rarely enough to cost nothing. The snapshot is the
 * 15-second BUCKET, a number, so it is stable between ticks as
 * `useSyncExternalStore` requires. `null` on the server and during hydration,
 * like everything clock-derived here.
 */
const TICK_MS = 15_000;
function subscribeClock(onTick: () => void): () => void {
  const timer = window.setInterval(onTick, TICK_MS);
  return () => window.clearInterval(timer);
}
export function useNow(active: boolean): Date | null {
  const bucket = useSyncExternalStore(
    active ? subscribeClock : noop,
    () => Math.floor(Date.now() / TICK_MS),
    () => null,
  );
  return bucket === null ? null : new Date(bucket * TICK_MS);
}

function countdownParts(countdown: PromotionCountdown) {
  switch (countdown.unit) {
    case "days":
      return { days: countdown.days, hours: countdown.hours };
    case "hours":
      return { hours: countdown.hours, minutes: countdown.minutes };
    case "minutes":
      return { minutes: countdown.minutes };
  }
}

/** "2d 4h" — a countdown in the reader's language. */
export function formatCountdown(countdown: PromotionCountdown, locale: string): string {
  return formatDurationParts(countdownParts(countdown), locale);
}

/**
 * A promotion against the reader's clock: where its event stands, the
 * countdown to it, and the recording that replaces the button once it is
 * over. Everything clock-derived is `null` until hydration.
 */
export function usePromotionClock(p: PublicPromotion) {
  const hydrated = useHydrated();
  const now = useNow(Boolean(p.eventStartsAt));
  const phase = now ? promotionEventPhase(p, now) : null;
  const countdown =
    phase === "UPCOMING" && p.eventStartsAt && now
      ? promotionCountdown(p.eventStartsAt, now)
      : null;
  // After the event, the recording replaces the button — the join link has
  // nothing left to join. With no recording the promotion carries on as it
  // was until its window closes (changes-52 §7.5).
  const recording = phase === "ENDED" && p.recordingHref ? p.recordingHref : null;
  return { hydrated, phase, countdown, recording };
}

export type PromotionClock = ReturnType<typeof usePromotionClock>;

/** Whether the promotion has a button at all: a recording, or its own link. */
export function hasPromotionCta(p: PublicPromotion, clock: PromotionClock): boolean {
  return Boolean(clock.recording || p.href);
}

/**
 * The promotion's button: the recording after its event, otherwise its own
 * link. Null when it links nowhere.
 */
export function PromotionCta({
  promotion: p,
  clock,
  size = "default",
  onEngage,
  onNavigate,
}: {
  promotion: PublicPromotion;
  clock: PromotionClock;
  size?: "default" | "sm" | "lg";
  onEngage?: () => void;
  onNavigate?: () => void;
}) {
  const t = useTranslations("promotions");
  const label = p.ctaLabel ?? t("learnMore");
  const follow = () => {
    onEngage?.();
    onNavigate?.();
  };

  if (clock.recording) {
    return (
      <Button size={size} render={<Link href={clock.recording} onClick={follow} />}>
        <PlayCircle aria-hidden data-icon="inline-start" />
        {t("watchRecording")}
      </Button>
    );
  }
  if (!p.href) return null;
  if (p.external) {
    return (
      <Button
        size={size}
        render={<a href={p.href} target="_blank" rel="noopener noreferrer" onClick={follow} />}
      >
        {label}
        <ExternalLink aria-hidden data-icon="inline-end" />
        <span className="sr-only"> — {t("opensInNewTab")}</span>
      </Button>
    );
  }
  return (
    <Button size={size} render={<Link href={p.href} onClick={follow} />}>
      {label}
      <ArrowRight aria-hidden data-icon="inline-end" className="rtl:rotate-180" />
    </Button>
  );
}

/**
 * "Add to calendar" (ADR-176): Google and Outlook open their own new-event
 * screen with the event filled in, and the `.ics` file stays for Apple
 * Calendar and desktop apps, which is the one choice that downloads. Rendered
 * only after hydration (by `PromotionEventMeta`), so `window` is safe here.
 */
function AddToCalendarMenu({
  promotion: p,
  onEngage,
}: {
  promotion: PublicPromotion;
  onEngage?: () => void;
}) {
  const t = useTranslations("promotions");
  const locale = useLocale();
  if (!p.eventStartsAt) return null;

  // A calendar has no page to be relative to, so the link is absolute and in
  // the reader's language — the same rule as the `.ics` route.
  const joinUrl = p.href
    ? p.external
      ? p.href
      : `${window.location.origin}${getPathname({ href: p.href, locale })}`
    : null;
  const event = {
    title: p.title,
    start: new Date(p.eventStartsAt),
    end: p.eventEndsAt ? new Date(p.eventEndsAt) : null,
    details: p.bodyHtml ? htmlToText(p.bodyHtml) : p.summary,
    url: joinUrl,
  };
  const web = [
    { key: "google", label: t("calendar.google"), href: googleCalendarUrl(event) },
    { key: "outlook", label: t("calendar.outlook"), href: outlookCalendarUrl(event) },
    { key: "office", label: t("calendar.office"), href: outlookCalendarUrl(event, "office") },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 font-medium text-primary-interactive underline-offset-4 hover:underline"
          />
        }
      >
        <CalendarPlus aria-hidden className="size-4" />
        {t("addToCalendar")}
        <ChevronDown aria-hidden className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {web.map((item) => (
          <DropdownMenuItem
            key={item.key}
            onClick={onEngage}
            render={<a href={item.href} target="_blank" rel="noopener noreferrer" />}
          >
            <span className="flex-1">{item.label}</span>
            <ExternalLink aria-hidden className="size-3.5 text-muted-foreground" />
            <span className="sr-only">({t("opensInNewTab")})</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onEngage}
          render={<a href={promotionCalendarPath(p.id, locale)} download />}
        >
          <span className="flex-1">{t("calendar.ics")}</span>
          <Download aria-hidden className="size-3.5 text-muted-foreground" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The timed kinds' row: when, live, countdown, "Add to calendar". */
export function PromotionEventMeta({
  promotion: p,
  clock,
  onEngage,
}: {
  promotion: PublicPromotion;
  clock: PromotionClock;
  onEngage?: () => void;
}) {
  const t = useTranslations("promotions");
  const locale = useLocale();
  const { hydrated, phase, countdown } = clock;
  if (!hydrated || !p.eventStartsAt || !phase) return null;
  return (
    <>
      <span className="inline-flex items-center gap-1.5 text-foreground">
        <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
        {t(phase === "ENDED" ? "eventEnded" : "eventTime", {
          date: formatDateTime(p.eventStartsAt, locale),
        })}
      </span>
      {phase === "LIVE" ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          {/* A status dot: its geometry is a circle (ADR-107). */}
          <span aria-hidden className="size-2 rounded-full bg-destructive" />
          {t("liveNow")}
        </span>
      ) : null}
      {countdown ? (
        // `timer` carries an implicit aria-live of OFF: a line that
        // changes every minute must not interrupt a screen reader.
        <span role="timer" className="text-muted-foreground tabular-nums">
          {countdown.unit === "minutes" && countdown.minutes === 0
            ? t("startingNow")
            : t("startsIn", { time: formatCountdown(countdown, locale) })}
        </span>
      ) : null}
      {phase !== "ENDED" ? <AddToCalendarMenu promotion={p} {...(onEngage ? { onEngage } : {})} /> : null}
    </>
  );
}

export function PromotionCard({
  promotion,
  layout,
  title,
  onNavigate,
  onEngage,
  dismiss,
  className,
}: {
  promotion: PublicPromotion;
  layout: "dialog" | "card";
  className?: string;
  /** The popup passes its `DialogTitle` so the dialog is named by the heading. */
  title?: ReactNode;
  /** Called when the button is followed — the popup closes itself. */
  onNavigate?: () => void;
  /**
   * Called when the reader acts on it — the button, the recording or "Add to
   * calendar". The popup and the band count it as a click (ADR-170 #2).
   */
  onEngage?: () => void;
  /** The popup's "Not now". */
  dismiss?: ReactNode;
}) {
  const t = useTranslations("promotions");
  const locale = useLocale();
  const p = promotion;
  const clock = usePromotionClock(p);

  // `lang` only when the words are NOT the page's language — the English
  // fallback on an Arabic page (ADR-167 #6) — so a screen reader switches voice.
  const lang = p.lang !== locale ? p.lang : undefined;
  const engage = onEngage ? { onEngage } : {};
  const cta = hasPromotionCta(p, clock) ? (
    <PromotionCta
      promotion={p}
      clock={clock}
      size={layout === "dialog" ? "default" : "sm"}
      {...engage}
      {...(onNavigate ? { onNavigate } : {})}
    />
  ) : null;

  return (
    <PromoCard
      layout={layout}
      {...(className ? { className } : {})}
      {...(lang ? { lang } : {})}
      badge={t(`kinds.${p.kind}`)}
      badgeTone={PROMOTION_KIND_TONE[p.kind]}
      tag={p.badge}
      title={title ?? p.title}
      body={
        p.bodyHtml ? (
          <RichText html={p.bodyHtml} className="gap-2" />
        ) : p.summary ? (
          <p>{p.summary}</p>
        ) : null
      }
      media={
        p.imageUrl ? (
          <Image
            src={p.imageUrl}
            alt={p.imageAlt}
            fill
            sizes={
              layout === "dialog"
                ? "(min-width: 640px) 32rem, 100vw"
                : "(min-width: 1024px) 24rem, 100vw"
            }
            className={`object-cover ${PROMOTION_PICTURE_CROP}`}
          />
        ) : null
      }
      meta={
        clock.hydrated && p.eventStartsAt && clock.phase ? (
          <PromotionEventMeta promotion={p} clock={clock} {...engage} />
        ) : null
      }
      actions={
        cta || dismiss ? (
          <>
            {cta}
            {dismiss}
          </>
        ) : null
      }
    />
  );
}
