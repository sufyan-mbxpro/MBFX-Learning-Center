import { NextResponse } from "next/server";
import { storeMedia } from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { readUploadCategory } from "../../../_lib/media-upload.ts";
import { handleUploadError } from "../_lib/handle-upload-error.ts";

// XHR-uploadable twin of uploadMediaAction (media-actions.ts) — see
// `api/uploads/image/route.ts`'s header comment for why a route handler,
// not the server action, is what gives the client real progress events.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const subject = await requirePermission("media.upload");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was received" }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await storeMedia(subject.id, {
      bytes,
      fileName: file.name,
      purpose: "content",
      category: readUploadCategory(formData),
    });
    return NextResponse.json(stored);
  } catch (error) {
    return handleUploadError(error);
  }
}
