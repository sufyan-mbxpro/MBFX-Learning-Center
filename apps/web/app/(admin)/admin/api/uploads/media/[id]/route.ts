import { NextResponse } from "next/server";
import { replaceMedia } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { handleUploadError } from "../../_lib/handle-upload-error.ts";

// XHR-uploadable twin of replaceMediaAction (media-actions.ts) — a
// replace is a file transfer too, so it gets the same progress treatment
// as the initial upload. See `api/uploads/image/route.ts`'s header
// comment for why a route handler rather than the server action.
export async function POST(
  request: Request,
  { params }: RouteContext<"/admin/api/uploads/media/[id]">,
): Promise<NextResponse> {
  try {
    const subject = await requirePermission("media.update");
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was received" }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await replaceMedia(subject.id, id, { bytes, fileName: file.name });
    return NextResponse.json(stored);
  } catch (error) {
    return handleUploadError(error);
  }
}
