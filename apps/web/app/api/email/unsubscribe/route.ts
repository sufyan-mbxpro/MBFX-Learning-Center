import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@repo/auth";
import { announcementUnsubscribeOpSchema, unsubscribeTokenSchema } from "@repo/contracts";
import {
  resubscribeToAnnouncements,
  unsubscribeFromAnnouncements,
  unsubscribeNewsletterByAnnouncementToken,
} from "@repo/core";
import { clientIp } from "../../../_lib/client-ip.ts";

// The announcement unsubscribe (ADR-171 #9) — the repo's FOURTH anonymous
// write, after newsletter signup, the /support form and the promotion
// counters. Two callers:
//
//   - a mail client's own Unsubscribe button: RFC 8058 one-click, the URL in
//     every announcement's `List-Unsubscribe` header, POSTed with the fixed
//     body `List-Unsubscribe=One-Click` (ours to ignore);
//   - the `/email/unsubscribe` page's island, which adds `op=undo` or
//     `op=newsletter` for its second and third buttons.
//
// `requirePermission()` (security.md #1) cannot be the first line of a write
// with no subject, so five guards take its place:
//
//   1. **The HMAC token** is the credential. Signed with `EMAIL_LINK_SECRET`
//      (verified in `@repo/core` through `@repo/email`'s `links.ts`), it names
//      one account or subscription, and all it can do is stop — or undo
//      stopping — mail to that one address.
//   2. **The schema** — `unsubscribeTokenSchema` over the token, and a closed
//      `op` that falls back to the unsubscribe, the safe direction.
//   3. **Per IP** — 20 per ten minutes, the newsletter one-click's limit.
//   4. **Idempotent writes** — an upsert on `[email, scope]`, so a repeat or a
//      replay changes nothing.
//   5. **One answer for every token** — valid, unknown, malformed or already
//      suppressed all answer 200 `{ ok: true }`. `newsletter` is true only
//      for a real token whose address is also an ACTIVE subscriber, which is
//      what the page needs to offer its second button; an unknown token is
//      indistinguishable from a real one with no subscription.
//
// **No GET export.** A mail scanner fetches every link in a message, so a GET
// here would unsubscribe readers who never asked; RFC 8058 requires the POST
// (ADR-080 #4). A GET answers 405.
//
// **No `export const dynamic`** — incompatible with `cacheComponents`
// (ADR-004); a route handler reading headers is dynamic already.

const IP_LIMIT = 20;
const IP_WINDOW_SECONDS = 600;

function answer(newsletter = false): NextResponse {
  return NextResponse.json(
    { ok: true, newsletter },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 3. Per IP. An unidentifiable caller shares one bucket.
  const ip = clientIp(request.headers) ?? "anonymous";
  const limited = await rateLimit(`announce:unsub:${ip}`, IP_LIMIT, IP_WINDOW_SECONDS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds), "cache-control": "no-store" },
      },
    );
  }

  // 2. The schema. The token rides in the query string because that is what
  //    the `List-Unsubscribe` URL carries.
  const parsed = unsubscribeTokenSchema.safeParse(request.nextUrl.searchParams.get("t"));
  if (!parsed.success) return answer();
  const op = announcementUnsubscribeOpSchema.parse(request.nextUrl.searchParams.get("op"));

  // 1 + 4. The token is verified inside the service; every write is idempotent.
  if (op === "undo") {
    await resubscribeToAnnouncements(parsed.data);
    return answer();
  }
  if (op === "newsletter") {
    await unsubscribeNewsletterByAnnouncementToken(parsed.data);
    return answer();
  }
  const state = await unsubscribeFromAnnouncements(parsed.data);
  // 5. The same answer whatever happened.
  return answer(state?.newsletterActive ?? false);
}
