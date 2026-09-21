import { peekSession } from "@repo/auth";
import { sessionStatusResponse } from "./session-status.ts";

// ADR-128: "is this session still alive, and for how long?", asked by the
// admin's idle watcher of a tab nobody is touching. It must NOT count as
// activity — a question that kept the session alive would mean an open tab
// never times out — so it reads through `peekSession`, which neither Better
// Auth's refresh nor the ADR-105 slide touches.
//
// No permission key: any STAFF session may ask about ITSELF, and nothing here
// reads or writes anyone else's data. The STAFF check is in the response
// helper, beneath the proxy's gate (security.md #3).
export async function GET(): Promise<Response> {
  return sessionStatusResponse(await peekSession());
}
