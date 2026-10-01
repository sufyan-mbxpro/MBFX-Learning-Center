// Where the popup and the home band report what a reader saw, followed and
// closed (ADR-170, changes-52 P7) — the THIRD anonymous write in this repo.
//
// `requirePermission()` (security.md #1) cannot be the first line of a write
// with no subject, so five guards take its place, and `promotions-public.test.ts`
// pins every one of them:
//
//   1. **Live only** — `recordPromotionEvents` counts an event only for a
//      promotion in the same cached live list the popup reads, on a surface
//      that promotion uses. A draft, an ended offer or an invented id never
//      gains a row.
//   2. **The schema** — `promotionEventsSchema`, over a capped body.
//   3. **Same origin** — another site cannot make its visitors inflate ours.
//   4. **Per IP** — `promo-events:ip:`.
//   5. **One count per network per day** — `promo-events:once:`, per
//      promotion, surface and event. The IP is a transient Redis key and is
//      never written to the database; the table holds counts only (ADR-170 #1).
//
// Every answer is the same empty 204, counted or refused: a counter owes its
// caller nothing, and a different answer would tell a script which guard it hit.
import { rateLimit } from "@repo/auth";
import { acceptedPromotionEvents, promotionEventsSchema } from "@repo/contracts";
import { getLivePromotions, recordPromotionEvents } from "@repo/core";
import { isServableLocale } from "@repo/i18n";

import { clientIp } from "../../../_lib/client-ip.ts";
import { unavailablePromotionTargets } from "../../../_lib/promotion-flags.ts";
import { isSameOriginRequest } from "../../../_lib/same-origin.ts";
import { siteUrl } from "../../../_lib/site-url.ts";

/** Six small events fit in well under this; anything larger is not ours. */
const MAX_BYTES = 4 * 1024;

/** Per IP: a reader browsing briskly sends a handful a minute, nobody needs sixty. */
const IP_LIMIT = 60;
const IP_WINDOW_SECONDS = 600;

/** One count of each event, per promotion and surface, per network, per day (ADR-170 #3.5). */
const ONCE_WINDOW_SECONDS = 86_400;

function done(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  // 3. Same origin, before the body is read.
  const allowed = [siteUrl(), new URL(request.url).origin];
  if (!isSameOriginRequest(request.headers, allowed)) return done();

  // 2. The schema, over a capped body. Malformed is simply not counted.
  let body: unknown;
  try {
    body = JSON.parse((await request.text()).slice(0, MAX_BYTES));
  } catch {
    return done();
  }
  const parsed = promotionEventsSchema.safeParse(body);
  if (!parsed.success) return done();

  // 4. Per IP. An unidentifiable caller shares one bucket, which throttles the
  //    header-less case harder rather than exempting it (the support form's rule).
  const ip = clientIp(request.headers) ?? "anonymous";
  const byIp = await rateLimit(`promo-events:ip:${ip}`, IP_LIMIT, IP_WINDOW_SECONDS);
  if (!byIp.ok) return done();

  if (!(await isServableLocale(parsed.data.locale))) return done();

  // 1. Live only — filtered here so a dead id spends no rate-limit key, and
  //    again inside `recordPromotionEvents`, so no caller can skip it.
  const live = await getLivePromotions(parsed.data.locale, await unavailablePromotionTargets());
  const candidates = acceptedPromotionEvents(parsed.data.events, live);

  // 5. Once per network per day.
  const fresh = [];
  for (const event of candidates) {
    const once = await rateLimit(
      `promo-events:once:${ip}:${event.id}:${event.surface}:${event.type}`,
      1,
      ONCE_WINDOW_SECONDS,
    );
    if (once.ok) fresh.push(event);
  }

  if (fresh.length > 0) await recordPromotionEvents(fresh, live);
  return done();
}
