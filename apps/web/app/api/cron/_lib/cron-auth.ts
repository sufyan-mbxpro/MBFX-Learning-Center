import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

// The one bearer check every cron route shares (changes-54 N4). It had been
// copied into four routes; a fifth (announcements, ADR-171) is where copying
// stops, because the next fix to one copy would miss the other four.
//
// **Auth is a shared secret, not `requirePermission()`** — a cron call has no
// subject, and inventing a system user to satisfy security.md #1 would put a
// fictional actor in the audit trail.

function noStore(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * The response to send back when the caller is NOT allowed to run the job,
 * or null when it is.
 *
 * - No `CRON_SECRET` → 503 `not_configured`. It FAILS CLOSED: an unset
 *   variable must never mean "anyone may run this".
 * - A missing, malformed or wrong bearer token → 401 `unauthorized`, the same
 *   answer for all three.
 */
export function cronAuthFailure(request: NextRequest | Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return noStore({ error: "not_configured" }, 503);

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";

  // Digests, not the strings: `timingSafeEqual` THROWS on a length mismatch,
  // so comparing raw secrets of different lengths would leak the length
  // through timing. Digests are always 32 bytes.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(presented), digest(secret))) {
    return noStore({ error: "unauthorized" }, 401);
  }
  return null;
}
