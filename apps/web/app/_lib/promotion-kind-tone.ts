// Which badge tone a promotion's kind wears (ADR-167). Shared by the admin
// editor's preview and the public popup and band, so the preview cannot
// disagree with the site about what an Offer looks like. App-level rather than
// in @repo/ui: the vocabulary is a contract enum, and the UI package knows
// nothing about promotions beyond the card's shape.
import type { PromotionKindInput } from "@repo/contracts";
import type { PromoCardTone } from "@repo/ui/components/promo-card";

export const PROMOTION_KIND_TONE: Record<PromotionKindInput, PromoCardTone> = {
  WEBINAR: "info",
  EVENT: "success",
  OFFER: "warning",
  NEWS: "secondary",
  ANNOUNCEMENT: "default",
};
