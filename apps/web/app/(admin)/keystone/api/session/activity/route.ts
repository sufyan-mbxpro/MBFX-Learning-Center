import { auth } from "@repo/auth";
import { sessionStatusResponse } from "../session-status.ts";

// ADR-128: the reader typed, clicked or scrolled in the admin. That is
// activity, and ADR-105 defines activity as an authenticated server check —
// so this is exactly one `auth()`, which slides a STAFF session's expiry the
// same way every admin page render, action and route handler already does.
// Without it, an editor who types for longer than the timeout without saving
// is signed out server-side while the page still believes they are there.
//
// A GET for the same reason a page view is one: the only write is the session
// bookkeeping `auth()` performs on every authenticated request. No permission
// key and no input; the STAFF check lives in the response helper.
export async function GET(): Promise<Response> {
  return sessionStatusResponse(await auth());
}
