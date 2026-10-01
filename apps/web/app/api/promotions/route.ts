import { NextResponse, type NextRequest } from "next/server";

import { publicPromotionsQuerySchema } from "@repo/contracts";
import { getLivePromotions, type PublicPromotion } from "@repo/core";
import { isServableLocale } from "@repo/i18n";

import { unavailablePromotionTargets } from "../../_lib/promotion-flags.ts";

// The popup's read (ADR-167 #3, changes-52 §7.1).
//
// **Why the popup fetches instead of the page carrying it.** A promotion goes
// live at its `startsAt` with no admin action, so nothing revalidates a page at
// that moment. Putting live promotions in the layout's payload would put every
// public page on a one-minute lifetime to notice a clock — architecture.md #6's
// "make the public routes dynamic" in another form. This endpoint is the one
// place the clock is read, and every page stays as cached as it was.
//
// **Read-only and anonymous.** It reads no session (the client applies the
// audience rule against the ONE session read the public surface already makes,
// ADR-094), and it writes nothing, so it is not the third anonymous mutation
// ADR-080/113 count. A shared cache may hold it for a minute: the body is the
// same for every reader of a language, and it names nothing a draft could leak
// through — `PublicPromotion` carries no target id and no status.
//
// Locale only, never the path: one URL per language is what a cache can hold,
// and the client files the list by path itself.

type Body = { promotions: PublicPromotion[] };

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

export async function GET(request: NextRequest): Promise<NextResponse<Body>> {
  const parsed = publicPromotionsQuerySchema.safeParse({
    locale: new URL(request.url).searchParams.get("locale") ?? undefined,
  });
  // A malformed or switched-off language is an empty list, not an error: the
  // popup is optional chrome, and a red console line on every page helps nobody.
  if (!parsed.success || !(await isServableLocale(parsed.data.locale))) {
    return NextResponse.json({ promotions: [] }, { headers: CACHE_HEADERS });
  }

  const unavailable = await unavailablePromotionTargets();
  const live = await getLivePromotions(parsed.data.locale, unavailable);

  return NextResponse.json(
    // Only what the client draws — the popup and the banner (ADR-173 #7); each
    // host filters by its own flag. The band renders on the server from the same read.
    { promotions: live.filter((promotion) => promotion.showAsPopup || promotion.showAsBar) },
    { headers: CACHE_HEADERS },
  );
}
