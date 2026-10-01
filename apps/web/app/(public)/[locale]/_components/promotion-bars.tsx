"use client";

// Promotion banners (ADR-173, ADR-174): a small strip or side card the reader
// can close.
//
// Mounted TWICE in the public root layout, both inside `PublicSessionProvider`
// for the audience rule:
//   - `slot="top"` sits IN FLOW above the header, so it scrolls away and never
//     covers the sticky navigation (ADR-173 #4);
//   - `slot="fixed"` draws the bottom strip and the two side cards, fixed to
//     the viewport.
// Both read the one shared list (`useLivePromotions`), so this is no extra
// request.
//
// Every live banner filed to a position shows there, ONE AT A TIME, highest
// priority first, and the banner moves to the next on its own (ADR-174 #1–2).
// Below `xl` a side card would sit on top of the page, so the fixed slot draws
// ONE strip at the bottom that rotates through the bottom and both side
// positions' banners together (ADR-173 #3). Which set is drawn is decided in
// JS, not by a `hidden` class, so a banner hidden by the breakpoint is never
// counted as seen.
//
// The cross closes the whole banner. Every promotion the reader was SHOWN is
// remembered as closed, per promotion AND version, and its `frequency` says
// when it comes back (ADR-173 #5); one they never reached comes back on the
// next page (ADR-174 #3).
//
// The bottom strip publishes its height, close tab included, as
// `--promotion-bar-height`, which the body pads by and the back-to-top button
// rises by, so the strip covers neither the footer's last line nor that
// button (ADR-174 #5).
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
} from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ExternalLink, X } from "lucide-react";
import {
  promotionAudienceIncludes,
  promotionBarSeenKey,
  promotionShowsOnPath,
  shouldShowPromotion,
  type PromotionBarPositionInput,
  type PromotionSeen,
} from "@repo/contracts";
import type { PublicPromotion } from "@repo/core";
import { Link, usePathname } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { htmlLead } from "@repo/utils";
import { REDUCED_MOTION_QUERY, useMediaQuery, usePageVisible } from "../_lib/document-state.ts";
import { useLivePromotions } from "../_lib/live-promotions.ts";
import { reportPromotionEvent } from "../_lib/promotion-events.ts";
import { PROMOTION_PICTURE_CROP } from "./promotion-card.tsx";
import { usePublicSession } from "./public-session.tsx";

type Slot = "top" | "fixed";

const SLOT_POSITIONS: Record<Slot, readonly PromotionBarPositionInput[]> = {
  top: ["TOP"],
  fixed: ["BOTTOM", "LEFT", "RIGHT"],
};

/** How long each banner stays before the next (ADR-174 #2). */
const ROTATE_MS = 7000;

/** Tailwind's `xl`: the width from which side cards have room beside the page. */
const WIDE_QUERY = "(min-width: 80rem)";

/** Closed in this page load — the fallback when storage throws. */
const closedThisLoad = new Set<string>();
/** Impressions already reported in this page load. */
const reported = new Set<string>();

function readClosed(promotion: PublicPromotion): PromotionSeen {
  const key = promotionBarSeenKey(promotion.id, promotion.version);
  let lastShownAt: number | null = null;
  let inThisSession = false;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null && Number.isFinite(Number(stored))) lastShownAt = Number(stored);
  } catch {
    /* storage unavailable */
  }
  try {
    inThisSession = window.sessionStorage.getItem(key) === "1";
  } catch {
    /* storage unavailable */
  }
  return { lastShownAt, inThisSession };
}

function rememberClosed(promotion: PublicPromotion): void {
  const key = promotionBarSeenKey(promotion.id, promotion.version);
  closedThisLoad.add(key);
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    /* storage unavailable — the in-memory set still holds it */
  }
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* storage unavailable */
  }
}

function summaryOf(promotion: PublicPromotion): string | null {
  const text = promotion.bodyHtml ? htmlLead(promotion.bodyHtml, 160) : promotion.summary;
  return text ? text : null;
}

// `useMediaQuery`'s server snapshot is `false`, and the banners render nothing
// until the promotion list arrives after hydration, so the two snapshots never
// disagree on screen.

/** A banner closed on THIS page: the path, and whether the reader saw it. */
interface ClosedHere {
  path: string;
  seen: boolean;
}

export function PromotionBars({ slot }: { slot: Slot }) {
  const locale = useLocale();
  const pathname = usePathname();
  const session = usePublicSession();
  const live = useLivePromotions(locale);
  const wide = useMediaQuery(WIDE_QUERY);
  // Closed in this page load, by seen-key. A SEEN banner stays closed on
  // every page unless it is EVERY_VISIT; an unseen one only on this page.
  const [closed, setClosed] = useState<ReadonlyMap<string, ClosedHere>>(new Map());
  const stripRef = useRef<HTMLDivElement>(null);

  const signedIn = session.status === "loading" ? null : session.status === "learner";
  // Every banner that may show, by position, in the list's priority order.
  const byPosition = useMemo(() => {
    const lists = new Map<PromotionBarPositionInput, PublicPromotion[]>();
    if (!live) return lists;
    const now = new Date();
    for (const p of live) {
      if (!p.showAsBar || !SLOT_POSITIONS[slot].includes(p.barPosition)) continue;
      const key = promotionBarSeenKey(p.id, p.version);
      const here = closed.get(key);
      if (here && ((here.seen && p.frequency !== "EVERY_VISIT") || here.path === pathname)) {
        continue;
      }
      if (p.frequency !== "EVERY_VISIT" && closedThisLoad.has(key)) continue;
      if (
        promotionShowsOnPath(p.placements, pathname) &&
        promotionAudienceIncludes(p.audience, signedIn) &&
        new Date(p.endsAt).getTime() > now.getTime() &&
        shouldShowPromotion(p.frequency, readClosed(p), now)
      ) {
        lists.set(p.barPosition, [...(lists.get(p.barPosition) ?? []), p]);
      }
    }
    return lists;
  }, [live, slot, pathname, signedIn, closed]);

  const top = byPosition.get("TOP") ?? [];
  const start = wide ? (byPosition.get("LEFT") ?? []) : [];
  const end = wide ? (byPosition.get("RIGHT") ?? []) : [];
  // Wide: the bottom position's own banners. Narrow: the ONE strip, rotating
  // through all three fixed positions' banners in priority order.
  const bottom = wide
    ? (byPosition.get("BOTTOM") ?? [])
    : (live ?? []).filter((p) =>
        (["BOTTOM", "LEFT", "RIGHT"] as const).some((position) =>
          byPosition.get(position)?.includes(p),
        ),
      );

  const hasStrip = slot === "fixed" && bottom.length > 0;
  // The bottom strip's height, for the body's padding and the back-to-top button.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!hasStrip || !strip) return;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty("--promotion-bar-height", `${strip.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(strip);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--promotion-bar-height");
    };
  }, [hasStrip]);

  const close = (shown: readonly PublicPromotion[], all: readonly PublicPromotion[]) => {
    const seenIds = new Set(shown.map((p) => p.id));
    for (const promotion of shown) {
      rememberClosed(promotion);
      reportPromotionEvent(locale, { id: promotion.id, surface: "BAR", type: "DISMISS" });
    }
    setClosed((current) => {
      const next = new Map(current);
      for (const promotion of all) {
        next.set(promotionBarSeenKey(promotion.id, promotion.version), {
          path: pathname,
          seen: seenIds.has(promotion.id),
        });
      }
      return next;
    });
  };
  const engage = (promotion: PublicPromotion) =>
    reportPromotionEvent(locale, { id: promotion.id, surface: "BAR", type: "CLICK" });

  if (slot === "top") {
    return top.length > 0 ? (
      <Strip promotions={top} slot="top" onClose={close} onEngage={engage} />
    ) : null;
  }
  if (bottom.length === 0 && start.length === 0 && end.length === 0) return null;

  return (
    <>
      {/* In the page's own stacking order, beneath a dialog (z-50). */}
      {hasStrip && (
        <div ref={stripRef} className="fixed inset-x-0 bottom-0 z-40">
          <Strip promotions={bottom} slot="fixed" onClose={close} onEngage={engage} />
        </div>
      )}
      {start.length > 0 && (
        <SideCard promotions={start} side="start" onClose={close} onEngage={engage} />
      )}
      {end.length > 0 && <SideCard promotions={end} side="end" onClose={close} onEngage={engage} />}
    </>
  );
}

type CloseHandler = (shown: readonly PublicPromotion[], all: readonly PublicPromotion[]) => void;

/**
 * One banner's rotation (ADR-174 #2): which promotion is showing, and the
 * timer that moves it on. It holds still under reduced motion, while the
 * pointer is over it or focus is inside it, and while the tab is hidden. Each promotion reports its impression the first time
 * it is shown, and the set shown is what the cross records as closed.
 */
function useRotation(promotions: readonly PublicPromotion[]) {
  const locale = useLocale();
  const count = promotions.length;
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const pageVisible = usePageVisible();
  const shown = useRef<Map<string, PublicPromotion>>(new Map());

  // The list can shrink under the index (a promotion ends, or the audience
  // read lands); wrap rather than point past the end.
  const current = count === 0 ? 0 : index % count;
  const promotion = promotions[current];
  const playing =
    count > 1 && !hovering && !focusWithin && !reducedMotion && pageVisible;

  // A timeout re-armed on every change of slide, not an interval: a reader who
  // picks a slide by hand gets the full time on it before it moves.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setIndex((current + 1) % count), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [playing, current, count]);

  useEffect(() => {
    if (!promotion) return;
    shown.current.set(promotion.id, promotion);
    if (reported.has(promotion.id)) return;
    reported.add(promotion.id);
    reportPromotionEvent(locale, { id: promotion.id, surface: "BAR", type: "IMPRESSION" });
  }, [promotion, locale]);

  return {
    promotion,
    index: current,
    count,
    playing,
    goTo: setIndex,
    shown: () => [...shown.current.values()],
    bind: {
      onPointerEnter: () => setHovering(true),
      onPointerLeave: () => setHovering(false),
      onFocus: () => setFocusWithin(true),
      onBlur: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocusWithin(false);
        }
      },
    },
  };
}

type Rotation = ReturnType<typeof useRotation>;

// One dot per promotion, each a jump control. No pause button (owner,
// changes-56): hovering or focusing the banner holds it. Absent for a single
// banner, which does not move.
function Pager({
  rotation,
  tone,
  className,
}: {
  rotation: Rotation;
  tone: "inverted" | "default";
  className?: string;
}) {
  const t = useTranslations("promotions");
  if (rotation.count < 2) return null;
  const inverted = tone === "inverted";
  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)}>
      <ul className="flex items-center">
        {Array.from({ length: rotation.count }, (_, index) => (
          <li key={index} className="contents">
            <button
              type="button"
              aria-label={t("slideLabel", { current: index + 1, total: rotation.count })}
              aria-current={index === rotation.index ? "true" : undefined}
              onClick={() => rotation.goTo(index)}
              className="group/dot flex h-6 items-center px-1 outline-none"
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-all duration-(--duration-base) ease-(--ease-out-quint) group-focus-visible/dot:outline-2 group-focus-visible/dot:outline-offset-2 group-focus-visible/dot:outline-ring",
                  index === rotation.index ? "w-5" : "w-1.5",
                  inverted
                    ? index === rotation.index
                      ? "bg-secondary-foreground"
                      : "bg-secondary-foreground/35 group-hover/dot:bg-secondary-foreground/60"
                    : index === rotation.index
                      ? "bg-primary-interactive"
                      : "bg-border group-hover/dot:bg-primary-interactive/60",
                )}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// One strip, at the top of the page or pinned to the bottom.
function Strip({
  promotions,
  slot,
  onClose,
  onEngage,
}: {
  promotions: readonly PublicPromotion[];
  slot: Slot;
  onClose: CloseHandler;
  onEngage: (p: PublicPromotion) => void;
}) {
  const t = useTranslations("promotions");
  const locale = useLocale();
  const rotation = useRotation(promotions);
  const p = rotation.promotion;
  if (!p) return null;
  const summary = summaryOf(p);
  const closeStrip = () => onClose(rotation.shown(), promotions);
  const bottom = slot === "fixed";

  return (
    <aside aria-label={t("bannerLabel")} {...rotation.bind}>
      {bottom && (
        // The close as a TAB above the strip's inline end, in the strip's own
        // colour and joined to it (ADR-174 #5). The row is part of the
        // measured height but lets every click outside the tab through.
        <div className="pointer-events-none container-page flex justify-end">
          <button
            type="button"
            aria-label={t("closeBanner")}
            onClick={closeStrip}
            className="pointer-events-auto relative z-10 -mb-px inline-flex h-8 w-10 items-center justify-center rounded-t-md border border-b-0 border-secondary-foreground/15 bg-secondary text-secondary-foreground/80 transition-colors outline-none hover:text-secondary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}
      <div
        className={cn(
          "border-secondary-foreground/15 bg-secondary text-secondary-foreground",
          bottom ? "border-t shadow-float" : "border-b",
        )}
      >
        <div className="container-page flex items-center gap-3 py-2.5 sm:gap-4">
          {/* A stable live region around a child keyed by promotion, so each
              one fades in as it arrives; the words are announced only once
              the rotation has stopped (a region that speaks every few seconds
              is noise over whatever else the reader is doing). */}
          <div
            aria-live={rotation.count > 1 && !rotation.playing ? "polite" : "off"}
            className="flex min-w-0 flex-1"
          >
            <div
              key={p.id}
              {...(p.lang !== locale ? { lang: p.lang } : {})}
              className="flex min-w-0 flex-1 animate-in items-center gap-3 duration-500 fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none sm:gap-4"
            >
              {p.imageUrl && (
                <div className="relative hidden size-11 shrink-0 overflow-hidden rounded-md sm:block">
                  <Image
                    src={p.imageUrl}
                    alt={p.imageAlt}
                    fill
                    sizes="44px"
                    className={`object-cover ${PROMOTION_PICTURE_CROP}`}
                  />
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="shrink-0 text-2xs font-semibold tracking-caps text-secondary-foreground/80 uppercase">
                  {p.badge ?? t(`kinds.${p.kind}`)}
                </span>
                <p className="line-clamp-2 min-w-0 text-sm leading-snug">
                  <span className="font-semibold">{p.title}</span>
                  {summary && <span className="hidden md:inline"> — {summary}</span>}
                </p>
              </div>
            </div>
          </div>
          <Pager rotation={rotation} tone="inverted" className="hidden sm:flex" />
          <BannerCta promotion={p} onEngage={onEngage} size="sm" />
          {!bottom && (
            // The top strip keeps its cross inline: a tab hanging below it
            // would cover the sticky header (ADR-174 #5).
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("closeBanner")}
              onClick={closeStrip}
              className="shrink-0 text-secondary-foreground/80 hover:bg-secondary-foreground/10 hover:text-secondary-foreground"
            >
              <X aria-hidden />
            </Button>
          )}
        </div>
        {/* On a phone the dots get their own row rather than squeezing the
            words beside the button. */}
        {rotation.count > 1 && (
          <div className="container-page flex justify-center pb-1.5 sm:hidden">
            <Pager rotation={rotation} tone="inverted" />
          </div>
        )}
      </div>
    </aside>
  );
}

// A card at the inline start or end of the viewport, xl and wider.
function SideCard({
  promotions,
  side,
  onClose,
  onEngage,
}: {
  promotions: readonly PublicPromotion[];
  side: "start" | "end";
  onClose: CloseHandler;
  onEngage: (p: PublicPromotion) => void;
}) {
  const t = useTranslations("promotions");
  const locale = useLocale();
  const rotation = useRotation(promotions);
  const p = rotation.promotion;
  if (!p) return null;
  const summary = summaryOf(p);
  return (
    <aside
      aria-label={t("bannerLabel")}
      {...rotation.bind}
      className={cn(
        "fixed top-1/2 z-40 flex w-56 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-float",
        side === "start" ? "start-4" : "end-4",
      )}
    >
      <div aria-live={rotation.count > 1 && !rotation.playing ? "polite" : "off"}>
        <div
          key={p.id}
          {...(p.lang !== locale ? { lang: p.lang } : {})}
          className="flex animate-in flex-col duration-500 fade-in-0 motion-reduce:animate-none"
        >
          {p.imageUrl && (
            <div className="relative aspect-video w-full">
              <Image
                src={p.imageUrl}
                alt={p.imageAlt}
                fill
                sizes="14rem"
                className={`object-cover ${PROMOTION_PICTURE_CROP}`}
              />
            </div>
          )}
          <div className="flex flex-col gap-2 p-4">
            <span className="pe-8 text-2xs font-semibold tracking-caps text-muted-foreground uppercase">
              {p.badge ?? t(`kinds.${p.kind}`)}
            </span>
            <p className="text-sm leading-snug font-semibold">{p.title}</p>
            {summary && <p className="line-clamp-3 text-xs text-muted-foreground">{summary}</p>}
            <BannerCta promotion={p} onEngage={onEngage} size="sm" className="mt-1 w-full" />
          </div>
        </div>
      </div>
      <Pager rotation={rotation} tone="default" className="justify-center pb-3" />
      {/* The same round control the popup uses, readable over any picture. */}
      <Button
        variant="outline"
        size="icon-xs"
        aria-label={t("closeBanner")}
        onClick={() => onClose(rotation.shown(), promotions)}
        className="absolute end-2 top-2 rounded-full bg-background/90 shadow-md backdrop-blur-sm hover:bg-background"
      >
        <X aria-hidden />
      </Button>
    </aside>
  );
}

function BannerCta({
  promotion: p,
  onEngage,
  size,
  className,
}: {
  promotion: PublicPromotion;
  onEngage: (p: PublicPromotion) => void;
  size: "sm";
  className?: string;
}) {
  const t = useTranslations("promotions");
  if (!p.href) return null;
  const label = p.ctaLabel ?? t("learnMore");
  return p.external ? (
    <Button
      size={size}
      className={cn("shrink-0", className)}
      render={
        <a href={p.href} target="_blank" rel="noopener noreferrer" onClick={() => onEngage(p)} />
      }
    >
      {label}
      <ExternalLink aria-hidden data-icon="inline-end" />
      <span className="sr-only"> — {t("opensInNewTab")}</span>
    </Button>
  ) : (
    <Button
      size={size}
      className={cn("shrink-0", className)}
      render={<Link href={p.href} onClick={() => onEngage(p)} />}
    >
      {label}
      <ArrowRight aria-hidden data-icon="inline-end" className="rtl:rotate-180" />
    </Button>
  );
}
