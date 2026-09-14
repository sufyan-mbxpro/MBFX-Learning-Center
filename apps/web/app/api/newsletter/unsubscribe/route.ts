import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@repo/auth";
import { newsletterTokenSchema } from "@repo/contracts";
import { unsubscribe } from "@repo/core";
import { clientIp } from "../../../_lib/client-ip.ts";

// RFC 8058 one-click unsubscribe (ADR-080 #4).
//
// **This is the ONE exception to "a link in an email never mutates".** Every
// newsletter message carries `List-Unsubscribe: <this url>` and
// `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, and the mail client
// itself POSTs here when the reader presses its own Unsubscribe button. The
// pair of headers is what makes this safe where a GET would not be: a scanner
// follows links, and RFC 8058 requires the POST — so a prefetch cannot reach
// this handler at all, and there is deliberately no GET export.
//
// **There is no subject and no signature**, only the unguessable token, which
// is why it is long-lived and why unsubscribing is the only thing it can do.
// The worst a leaked token permits is stopping mail to the address it belongs
// to; the reader can subscribe again, and the alternative — expiring it — would
// break one-click in every message already sent.
//
// It answers 200 for an unknown token as well as a known one. A mail client
// shows the reader an error on anything else, and "this address is not on the
// list" is not a failure of what they asked for.
//
// **No `export const dynamic`**: a route-level segment config is INCOMPATIBLE with
// `cacheComponents` (ADR-004), and Next refuses to compile the file — which is
// how `publish-due` came to answer 500 to every caller rather than running the
// sweep. It is also unnecessary: a route handler reading `process.env` and the
// request headers is dynamic already. architecture.md #12 bars the sibling
// `export const revalidate` for the same reason.

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = clientIp(request.headers) ?? "anonymous";
  const limited = await rateLimit(`newsletter:oneclick:${ip}`, 20, 600);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds), "cache-control": "no-store" },
      },
    );
  }

  // The token arrives in the query string, because that is what the
  // `List-Unsubscribe` URL carries — the POST body is RFC 8058's fixed
  // `List-Unsubscribe=One-Click`, not ours to use.
  const parsed = newsletterTokenSchema.safeParse(request.nextUrl.searchParams.get("token"));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_token" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const result = await unsubscribe(parsed.data);
  return NextResponse.json(
    { status: result },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
