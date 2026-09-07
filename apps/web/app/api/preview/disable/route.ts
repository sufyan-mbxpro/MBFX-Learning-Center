import { NextResponse, type NextRequest } from "next/server";
import { draftMode } from "next/headers";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const draft = await draftMode();
  draft.disable();
  return NextResponse.redirect(new URL("/", request.url));
}
