import { NextResponse } from "next/server";
import type { Session } from "@repo/auth";
import { adminSessionTimeoutMs } from "@repo/contracts";
import { getSetting } from "@repo/settings";
import type { SessionStatus } from "../../_components/idle-timing.ts";

/**
 * The one answer both session routes give (ADR-128). A missing or non-STAFF
 * session is a 401 — the watcher's cue to leave — never a redirect, which a
 * `fetch` would follow to the sign-in page's HTML and read as success.
 *
 * `remainingMs` is RELATIVE on purpose: the watcher adds it to its own clock,
 * so a browser whose clock is off by minutes still warns on time.
 */
export async function sessionStatusResponse(session: Session | null): Promise<NextResponse> {
  const headers = { "Cache-Control": "private, no-store" };
  if (session?.user.userType !== "STAFF") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  const setting = await getSetting("security.adminSessionTimeout");
  const body: SessionStatus = {
    remainingMs: Math.max(0, new Date(session.session.expiresAt).getTime() - Date.now()),
    timeoutMs: setting === null ? null : adminSessionTimeoutMs(setting),
  };
  return NextResponse.json(body, { headers });
}
