"use client";

// The editor's preview (changes-52 §8): the real `PromoCard` the popup and the
// band render, fed from the editor's unsaved state, so what an editor checks
// is the component a visitor gets — not a mock-up that drifts from it.
//
// It borrows exactly as the public read does: an empty title or message on a
// promotion linked to content shows that content's title and summary.
import { useSyncExternalStore } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { CalendarClock, X } from "lucide-react";
import type { PromotionBarPositionInput, PromotionKindInput } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { PromoCard } from "@repo/ui/components/promo-card";
import { formatDateTime, htmlLead } from "@repo/utils";
import { RichText } from "@repo/ui/components/rich-text";
import { PROMOTION_KIND_TONE } from "../../../../_lib/promotion-kind-tone.ts";

export interface PromotionPreviewProps {
  kind: PromotionKindInput;
  lang: string;
  title: string;
  bodyHtml: string;
  badge: string;
  ctaLabel: string;
  hasLink: boolean;
  imageUrl: string | null;
  imageAlt: string;
  /** ISO instant, or "" — formatted only after hydration (the zone is the browser's). */
  eventStartsAt: string;
  showInBand: boolean;
  showAsBar: boolean;
  barPosition: PromotionBarPositionInput;
}

const noop = () => () => {};

/** True after hydration. The server has no reader's time zone to format in. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function PromotionPreview(props: PromotionPreviewProps) {
  const t = useTranslations("admin.promotions");
  const hydrated = useHydrated();

  if (!props.title) {
    return <p className="text-sm text-muted-foreground">{t("previewEmpty")}</p>;
  }

  // The site's one date format (@repo/utils), in the browser's zone — which is
  // why it waits for hydration.
  const eventLabel = hydrated && props.eventStartsAt ? formatDateTime(props.eventStartsAt) : null;

  const card = (layout: "dialog" | "card") => (
    <PromoCard
      layout={layout}
      lang={props.lang}
      badge={t(`kinds.${props.kind}`)}
      badgeTone={PROMOTION_KIND_TONE[props.kind]}
      tag={props.badge || null}
      title={props.title}
      body={props.bodyHtml ? <RichText html={props.bodyHtml} className="gap-2" /> : null}
      media={
        props.imageUrl ? (
          <Image
            src={props.imageUrl}
            alt={props.imageAlt}
            fill
            sizes="(min-width: 1024px) 28rem, 100vw"
            className="object-cover"
          />
        ) : null
      }
      meta={
        eventLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
            {eventLabel}
          </span>
        ) : null
      }
      actions={
        <>
          {props.hasLink && props.ctaLabel ? (
            <Button size="sm" tabIndex={-1}>
              {props.ctaLabel}
            </Button>
          ) : null}
          {layout === "dialog" ? (
            <Button size="sm" variant="ghost" tabIndex={-1}>
              {t("previewDismiss")}
            </Button>
          ) : null}
        </>
      }
    />
  );

  // `inert` on each FRAME, not the whole block: the cards are pictures of
  // controls, so nothing in them may take focus or be announced as a button,
  // while the captions naming each picture stay readable.
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <figure className="flex flex-col gap-2">
        <figcaption className="text-xs font-medium text-muted-foreground">
          {t("previewPopup")}
        </figcaption>
        {/* No padding: the popup is edge to edge and the card pads its own
            words (ADR-174 #7). */}
        <div className="overflow-hidden rounded-lg border bg-background shadow-sm" inert>
          {card("dialog")}
        </div>
      </figure>
      {props.showAsBar && (
        <figure className="flex flex-col gap-2">
          <figcaption className="text-xs font-medium text-muted-foreground">
            {t("previewBanner", { position: t(`barPositions.${props.barPosition}`) })}
          </figcaption>
          <div inert>
            <BannerPicture {...props} badgeText={props.badge || t(`kinds.${props.kind}`)} />
          </div>
        </figure>
      )}
      {props.showInBand && (
        <figure className="flex flex-col gap-2">
          <figcaption className="text-xs font-medium text-muted-foreground">
            {t("previewBand")}
          </figcaption>
          <div inert>{card("card")}</div>
        </figure>
      )}
    </div>
  );
}

/**
 * A picture of the public banner (ADR-173) — the strip for TOP and BOTTOM, the
 * side card for LEFT and RIGHT, in the same tokens `promotion-bars.tsx` uses.
 * A picture rather than the component: the public one is a fixed-position
 * island that reads the session and reports counters.
 */
function BannerPicture(props: PromotionPreviewProps & { badgeText: string }) {
  const summary = props.bodyHtml ? htmlLead(props.bodyHtml, 160) : "";
  const cta =
    props.hasLink && props.ctaLabel ? (
      <Button size="sm" tabIndex={-1} className="shrink-0">
        {props.ctaLabel}
      </Button>
    ) : null;

  if (props.barPosition === "LEFT" || props.barPosition === "RIGHT") {
    return (
      <div className="relative flex w-56 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
        {props.imageUrl && (
          <div className="relative aspect-video w-full">
            <Image
              src={props.imageUrl}
              alt={props.imageAlt}
              fill
              sizes="14rem"
              className="object-cover"
            />
          </div>
        )}
        <div className="flex flex-col gap-2 p-4" lang={props.lang}>
          <span className="pe-8 text-2xs font-semibold tracking-caps text-muted-foreground uppercase">
            {props.badgeText}
          </span>
          <p className="text-sm leading-snug font-semibold">{props.title}</p>
          {summary && <p className="line-clamp-3 text-xs text-muted-foreground">{summary}</p>}
          {cta}
        </div>
        <span className="absolute end-2 top-2 inline-flex size-8 items-center justify-center rounded-full border bg-background/90 shadow-md">
          <X aria-hidden className="size-4" />
        </span>
      </div>
    );
  }

  const bottom = props.barPosition === "BOTTOM";
  return (
    <div className="flex flex-col">
      {bottom && (
        // The bottom strip's close is a tab above its end (ADR-174 #5).
        <span className="relative z-10 -mb-px inline-flex h-8 w-10 items-center justify-center self-end rounded-t-md border border-b-0 border-secondary-foreground/15 bg-secondary text-secondary-foreground me-4">
          <X aria-hidden className="size-4" />
        </span>
      )}
      <div
        lang={props.lang}
        className="flex items-center gap-3 rounded-lg bg-secondary px-4 py-2.5 text-secondary-foreground"
      >
        {props.imageUrl && (
          <div className="relative size-11 shrink-0 overflow-hidden rounded-md">
            <Image
              src={props.imageUrl}
              alt={props.imageAlt}
              fill
              sizes="44px"
              className="object-cover"
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-2xs font-semibold tracking-caps text-secondary-foreground/80 uppercase">
            {props.badgeText}
          </span>
          <p className="min-w-0 truncate text-sm">
            <span className="font-semibold">{props.title}</span>
            {summary && <span> — {summary}</span>}
          </p>
        </div>
        {cta}
        {!bottom && <X aria-hidden className="size-4 shrink-0" />}
      </div>
    </div>
  );
}
