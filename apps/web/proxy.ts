import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 request proxy (the file formerly known as middleware.ts).
 *
 * This single proxy serves both surfaces of the app (ADR-006):
 *   - /admin/*  → STAFF gate. Module 04 wires @repo/auth here so a session
 *                 with userType !== "STAFF" never reaches an admin route.
 *                 This is a GATE, not the security boundary — the admin
 *                 layout and every mutation re-check server-side.
 *   - everything else → next-intl locale routing (Module 06), which must
 *                 not touch /admin, /api, or static assets.
 *
 * Both responsibilities are stubbed until their modules land; the file
 * exists now so the matcher and the ordering are settled in one place.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    // TODO(Module 04): resolve the Better Auth session and redirect to the
    // sign-in route unless session.user.userType === "STAFF".
    return NextResponse.next();
  }

  // TODO(Module 06): delegate to next-intl's middleware for locale routing.
  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals, and anything with a file extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
