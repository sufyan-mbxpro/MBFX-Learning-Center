// "Does anything answer at this public address?" — the proxy's question
// (changes-49, ADR-146).
//
// Asked ONLY for a first segment no coded route owns, which is exactly the set
// of URLs the `[...slug]` catch-all serves. That route cannot return a real
// 404: `[locale]/loading.tsx` wraps it in a Suspense boundary, so the 200 and
// the site chrome are already on the wire when `notFound()` runs (the Next
// docs say so for every Cache Components route, and name the proxy as the
// place a real status has to be decided). The proxy cannot read the database
// (architecture.md #3), so it asks here, and this handler asks `@repo/core`
// the same question the catch-all would — one resolver, two callers, so the
// status and the page cannot disagree.
//
// Read-only and anonymous by design: the answer is what a GET of the address
// itself would reveal anyway. Draft previews never reach it — the proxy skips
// the lookup when the draft cookie is present.
import { publicPathQuerySchema } from "@repo/contracts";
import { resolvePublicPage } from "@repo/core";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = publicPathQuerySchema.safeParse({
    locale: url.searchParams.get("locale"),
    path: url.searchParams.get("path"),
  });
  if (!parsed.success) return Response.json({ kind: "not-found" }, { status: 400 });

  const resolved = await resolvePublicPage(parsed.data.locale, parsed.data.path);
  const body =
    resolved.kind === "redirect"
      ? { kind: "redirect", to: resolved.to }
      : { kind: resolved.kind === "page" ? "page" : "not-found" };
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
