"use client";

// The promotion popup (ADR-167, changes-52 §7.2–7.3).
//
// Mounted ONCE in the public root layout, inside `PublicSessionProvider`, so
// it reads the one session the public surface already makes (ADR-094) for the
// audience rule instead of making a second call.
//
// What it does, in order:
//   1. Fetches `/api/promotions?locale=…` once per language (a shared-cache
//      URL; the page itself stays as cached as it was), through the read it
//      shares with the banner host (ADR-173 #7), and keeps the popups.
//   2. On every page (including client navigations) files the list by PATH
//      (`promotionShowsOnPath` — the excluded pages get nothing), by audience,
//      by the client clock (an open tab never shows an ended offer), and by
//      the frequency rule against what this browser remembers.
//   3. Waits the top promotion's delay — nothing opens on first paint, which
//      is also what keeps it clear of the intrusive-interstitial rule on
//      mobile — then opens ONE dialog, several promotions paging inside it,
//      highest priority first (ADR-167 #5). It never stacks a second dialog.
//
// "Seen" is recorded when the dialog OPENS, per promotion AND version, so an
// edited promotion is news again. Storage is best-effort (private windows):
// when it throws, a module-level set still keeps it to once per page load.
//
// It also reports to the counters (ADR-170 #2): an impression for each page
// of the dialog the reader is shown, a click when they follow one, and, when
// the dialog closes with no click, a dismissal for every promotion they saw.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  promotionAudienceIncludes,
  promotionSeenKey,
  promotionShowsOnPath,
  shouldShowPromotion,
  type PromotionSeen,
} from "@repo/contracts";
import type { PublicPromotion } from "@repo/core";
import { usePathname } from "@repo/i18n/navigation";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { cn } from "@repo/ui/lib/utils";
import { useLivePromotions } from "../_lib/live-promotions.ts";
import { reportPromotionEvent } from "../_lib/promotion-events.ts";
import { usePublicSession } from "./public-session.tsx";
import { PromotionCard } from "./promotion-card.tsx";

/** Most promotions one dialog pages through; the rest wait for another visit. */
const MAX_IN_DIALOG = 3;

/** Shown in this page load — the fallback when storage throws. */
const shownThisLoad = new Set<string>();

function readSeen(promotion: PublicPromotion): PromotionSeen {
  const key = promotionSeenKey(promotion.id, promotion.version);
  let lastShownAt: number | null = null;
  let inThisSession = shownThisLoad.has(key);
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null && Number.isFinite(Number(stored))) lastShownAt = Number(stored);
  } catch {
    /* storage unavailable */
  }
  try {
    inThisSession = inThisSession || window.sessionStorage.getItem(key) === "1";
  } catch {
    /* storage unavailable */
  }
  // Remembered only in memory: treat it as seen this session AND today.
  if (lastShownAt === null && shownThisLoad.has(key)) lastShownAt = Date.now();
  return { lastShownAt, inThisSession };
}

function markSeen(promotions: readonly PublicPromotion[]): void {
  const now = String(Date.now());
  for (const promotion of promotions) {
    const key = promotionSeenKey(promotion.id, promotion.version);
    shownThisLoad.add(key);
    try {
      window.localStorage.setItem(key, now);
    } catch {
      /* storage unavailable — the in-memory set still holds it */
    }
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* storage unavailable */
    }
  }
}

export function PromotionHost() {
  const t = useTranslations("promotions");
  const locale = useLocale();
  const pathname = usePathname();
  const session = usePublicSession();
  const all = useLivePromotions(locale);
  const [queue, setQueue] = useState<PublicPromotion[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // The page the dialog last opened on. Closing it must not re-arm the SAME
  // page (an EVERY_VISIT promotion would reopen under the reader's cursor);
  // a navigation to another page arms it again.
  const openedOn = useRef<string | null>(null);
  // What this opening of the dialog has reported, reset each time it opens.
  const seenInDialog = useRef<Set<string>>(new Set());
  const engaged = useRef(false);

  // 1. The popups among the live list (the same list also carries banners).
  const live = useMemo(() => all?.filter((promotion) => promotion.showAsPopup) ?? null, [all]);

  // 2–3. File by page, audience, clock and frequency; open after the delay.
  const signedIn = session.status === "loading" ? null : session.status === "learner";
  useEffect(() => {
    if (!live || live.length === 0 || openedOn.current === pathname) return;
    const now = new Date();
    const due = live
      .filter(
        (p) =>
          promotionShowsOnPath(p.placements, pathname) &&
          promotionAudienceIncludes(p.audience, signedIn) &&
          new Date(p.endsAt).getTime() > now.getTime() &&
          shouldShowPromotion(p.frequency, readSeen(p), now),
      )
      .slice(0, MAX_IN_DIALOG);
    const first = due[0];
    if (!first) return;

    const timer = window.setTimeout(() => {
      openedOn.current = pathname;
      markSeen(due);
      seenInDialog.current = new Set();
      engaged.current = false;
      setQueue(due);
      setIndex(0);
      setOpen(true);
    }, first.delaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [live, pathname, signedIn]);

  const current = queue[index];

  // An impression for each page of the dialog, once per opening.
  const currentId = open ? current?.id : undefined;
  useEffect(() => {
    if (!currentId || seenInDialog.current.has(currentId)) return;
    seenInDialog.current.add(currentId);
    reportPromotionEvent(locale, { id: currentId, surface: "POPUP", type: "IMPRESSION" });
  }, [currentId, locale]);

  if (!current) return null;

  const onOpenChange = (next: boolean) => {
    if (!next && open && !engaged.current) {
      for (const id of seenInDialog.current) {
        reportPromotionEvent(locale, { id, surface: "POPUP", type: "DISMISS" });
      }
    }
    setOpen(next);
  };
  const close = () => onOpenChange(false);
  const engage = () => {
    engaged.current = true;
    reportPromotionEvent(locale, { id: current.id, surface: "POPUP", type: "CLICK" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Edge to edge (ADR-174 #7): no padding of its own, so the picture
        // fills the top and `PromoCard` pads the words. On a phone it keeps a
        // 1rem margin and its corners rather than touching both edges.
        showCloseButton={false}
        // The popup itself does not scroll; the card inside it does, so the
        // pager is a footer the card's buttons can never slide under. While it
        // pages, every promotion gets the SAME height (changes-57) and the
        // buttons sit at the bottom of it.
        className={cn(
          "w-(--width-dialog-inset) gap-0 overflow-hidden rounded-lg p-0 sm:w-full sm:max-w-lg",
          queue.length > 1 && "h-(--height-promo-dialog)",
        )}
        // Focus the heading, not the button: the reader should meet the
        // message before being offered a place to go.
        initialFocus={titleRef}
      >
        {/* Named by the heading the reader sees; described for assistive
            tech only, because the card's own body is the visible description
            and repeating it would read everything twice. */}
        <DialogDescription className="sr-only">{t("dialogDescription")}</DialogDescription>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <PromotionCard
            key={current.id}
            promotion={current}
            layout="dialog"
            className="flex-1"
            title={
              // Focused on open by script, which `:focus-visible` can match;
              // the global ring would then frame the heading like a field
              // (changes-57). It is a heading, not a control.
              <DialogTitle
                ref={titleRef}
                tabIndex={-1}
                className="text-xl outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                {current.title}
              </DialogTitle>
            }
            onNavigate={close}
            onEngage={engage}
            dismiss={
              <Button variant="ghost" onClick={close}>
                {t("notNow")}
              </Button>
            }
          />
          {/* The close: a round button on a translucent page-ground disc, so
              it reads as a control over any picture (ADR-174 #7). It rides a
              zero-height STICKY anchor in the scrolling card, so it stays in
              the corner while a tall promotion scrolls; last in the DOM and
              drawn first with `order-first`. */}
          <div className="pointer-events-none sticky top-0 z-20 order-first h-0">
            <DialogClose
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="pointer-events-auto absolute end-3 top-3 rounded-full bg-background/90 shadow-md backdrop-blur-sm hover:bg-background"
                />
              }
            >
              <X aria-hidden />
              <span className="sr-only">{t("close")}</span>
            </DialogClose>
          </div>
        </div>
        {queue.length > 1 && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-t px-5 py-3 sm:px-6">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("previous")}
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft aria-hidden className="rtl:rotate-180" />
            </Button>
            <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
              {t("position", { current: index + 1, total: queue.length })}
            </p>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("next")}
              disabled={index === queue.length - 1}
              onClick={() => setIndex((i) => Math.min(queue.length - 1, i + 1))}
            >
              <ChevronRight aria-hidden className="rtl:rotate-180" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
