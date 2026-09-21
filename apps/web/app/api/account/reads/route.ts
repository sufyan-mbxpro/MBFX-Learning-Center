import { NextResponse, type NextRequest } from "next/server";
import { auth, rateLimit } from "@repo/auth";
import { articleReadSchema } from "@repo/contracts";
import { ArticleNotReadableError, recordArticleRead } from "@repo/core";

// The read beacon (ADR-123 #2). The article page is cached and reads no
// session (ADR-056 #1), so it cannot know who is reading; a client island
// posts here once the public session says "learner", and THIS is where the
// reader is decided — from `auth()`, never from the body.
//
// In order: session (401 without one, and a STAFF session is not a learner's
// reading history — 204, nothing written), rate limit keyed by user, parse
// through `@repo/contracts` (security.md #6), then `@repo/core`, which applies
// the article's public rule and answers a hidden article as a missing one
// (404, security.md #7).

/** A reader opening a dozen tabs is normal; a loop is not. */
const LIMIT = 60;
const WINDOW_SECONDS = 60;

/** Per-learner data: never in a shared cache (the progress route's reasoning). */
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Sign in to keep a reading history" }, { status: 401 });
  }
  if (session.user.userType !== "LEARNER") {
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  }

  const limited = await rateLimit(`account:reads:${session.user.id}`, LIMIT, WINDOW_SECONDS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = articleReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    await recordArticleRead(session.user.id, parsed.data.articleId);
  } catch (error) {
    if (error instanceof ArticleNotReadableError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw error;
  }
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
