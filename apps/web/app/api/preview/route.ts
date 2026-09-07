import { NextResponse, type NextRequest } from "next/server";
import { draftMode } from "next/headers";
import { resolvePreviewUrl } from "@repo/core";
import { requirePermission } from "@repo/rbac";

// Module 16 Phase 1 (plan v2.2 §8/§12 PR 1.4). Draft mode is a
// gate-and-render toggle, not itself the security boundary — the
// permission check is what makes viewing an unpublished page's real
// content safe (security.md #7: existence of a draft is not public).
export async function GET(request: NextRequest): Promise<NextResponse> {
  await requirePermission("cms.pages.view");

  const pageId = request.nextUrl.searchParams.get("pageId");
  const locale = request.nextUrl.searchParams.get("locale");
  if (!pageId || !locale) {
    return NextResponse.json({ error: "pageId and locale are required" }, { status: 400 });
  }

  const target = await resolvePreviewUrl(pageId, locale);
  if (!target) {
    return NextResponse.json({ error: "No such page in that locale" }, { status: 404 });
  }

  const draft = await draftMode();
  draft.enable();

  return NextResponse.redirect(new URL(target, request.url));
}
