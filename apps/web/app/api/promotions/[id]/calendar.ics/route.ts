import { NextResponse, type NextRequest } from "next/server";

import { promotionCalendarQuerySchema, promotionEventPhase } from "@repo/contracts";
import { getLivePromotions } from "@repo/core";
import { isServableLocale } from "@repo/i18n";
import { buildICalendar, htmlToText } from "@repo/utils";

import { unavailablePromotionTargets } from "../../../../_lib/promotion-flags.ts";
import { localizedPath } from "../../../../_lib/seo.ts";
import { siteUrl } from "../../../../_lib/site-url.ts";

// "Add to calendar" for a webinar or event promotion (ADR-167 #8, changes-52
// §7.5, P5).
//
// **The same public rule as the popup, by construction.** It reads the one
// cached live list the popup's endpoint reads and picks the id out of it, so a
// draft, an archived or a deleted promotion, one outside its window, one whose
// language is missing, and one whose target is not public or sits behind a
// switched-off flag are all simply ABSENT — a 404, never a file. There is no
// second query here with its own idea of "public".
//
// Also a 404: a promotion with no event time (nothing to put in a calendar),
// and an event that has already ENDED (an entry in the past is noise).
//
// **Read-only and anonymous**, like `/api/promotions`: it writes nothing, so it
// is not a third anonymous mutation (ADR-080/113).
//
// The UID is the promotion's id alone and the version is the SEQUENCE, so
// downloading again after an edit UPDATES the reader's calendar entry instead
// of adding a second one beside it.

const PRODUCT_ID = "-//MBX Learning Center//Promotions//EN";
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404, headers: CACHE_HEADERS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const parsed = promotionCalendarQuerySchema.safeParse({
    id,
    locale: new URL(request.url).searchParams.get("locale") ?? undefined,
  });
  if (!parsed.success || !(await isServableLocale(parsed.data.locale))) return notFound();
  const { locale } = parsed.data;

  const live = await getLivePromotions(locale, await unavailablePromotionTargets());
  const promotion = live.find((p) => p.id === parsed.data.id);
  if (!promotion?.eventStartsAt) return notFound();
  const now = new Date();
  if (promotionEventPhase(promotion, now) === "ENDED") return notFound();

  const origin = siteUrl();
  // The join link: the promotion's own link. An internal one becomes an
  // absolute URL in the reader's language — a calendar has no page to be
  // relative to.
  const joinUrl = promotion.href
    ? promotion.external
      ? promotion.href
      : `${origin}${localizedPath(locale, promotion.href)}`
    : null;
  const words = promotion.bodyHtml ? htmlToText(promotion.bodyHtml) : promotion.summary;
  // Most calendar applications show DESCRIPTION and ignore URL, so the link
  // is in both.
  const description = [words?.trim(), joinUrl].filter(Boolean).join("\n\n") || null;

  const file = buildICalendar({
    uid: `promotion-${promotion.id}@${new URL(origin).hostname}`,
    sequence: promotion.version,
    start: new Date(promotion.eventStartsAt),
    end: promotion.eventEndsAt ? new Date(promotion.eventEndsAt) : null,
    summary: promotion.title,
    description,
    url: joinUrl,
    stamp: now,
    productId: PRODUCT_ID,
  });

  return new NextResponse(file, {
    headers: {
      ...CACHE_HEADERS,
      "Content-Type": "text/calendar; charset=utf-8",
      // A fixed ASCII name: the title may be any script, and a calendar
      // application reads the title from inside the file anyway.
      "Content-Disposition": `attachment; filename="event-${promotion.id}.ics"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
