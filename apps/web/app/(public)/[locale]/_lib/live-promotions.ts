// The public promotion list, read once per language per page load and shared
// by the popup and the banner hosts (ADR-173 #7), so two islands never make
// two requests for the same cached body.
//
// A failed read is an empty list: both surfaces are optional chrome.
import { useEffect, useState } from "react";
import type { PublicPromotion } from "@repo/core";

const requests = new Map<string, Promise<PublicPromotion[]>>();

function fetchLivePromotions(locale: string): Promise<PublicPromotion[]> {
  let request = requests.get(locale);
  if (!request) {
    request = fetch(`/api/promotions?locale=${encodeURIComponent(locale)}`, {
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : { promotions: [] }))
      .then((body: { promotions?: PublicPromotion[] }) => body.promotions ?? [])
      .catch(() => []);
    requests.set(locale, request);
  }
  return request;
}

/** The live list for `locale`, highest priority first; null until it arrives. */
export function useLivePromotions(locale: string): PublicPromotion[] | null {
  const [live, setLive] = useState<PublicPromotion[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchLivePromotions(locale).then((promotions) => {
      if (!cancelled) setLive(promotions);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  return live;
}
