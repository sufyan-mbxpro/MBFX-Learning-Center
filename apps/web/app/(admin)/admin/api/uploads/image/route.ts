import { NextResponse } from "next/server";
import { storeImage } from "@repo/core";
import { uploadPurposeSchema } from "@repo/contracts";
import { gateForPurpose, readUploadCategory } from "../../../_lib/media-upload.ts";
import { handleUploadError } from "../_lib/handle-upload-error.ts";

// XHR-uploadable twin of uploadImageAction (media-actions.ts). A Server
// Action's transport gives the browser no upload-progress events — fetch
// exposes no observable request-body progress for a FormData POST — so
// real-time upload percentage (the owner's ask) needs a plain route
// handler the client can POST to with XMLHttpRequest and track via
// `xhr.upload.onprogress`. Same gate order, same @repo/core call (audit
// row included), same purpose-to-permission mapping — just a different
// transport for the same operation. Lives under `/admin/api/*` so the
// proxy's STAFF gate (`pathname.startsWith("/admin")`) covers it too.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const purpose = uploadPurposeSchema.parse(formData.get("purpose"));
    const subject = await gateForPurpose(purpose);

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was received" }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await storeImage(subject.id, {
      bytes,
      fileName: file.name,
      purpose,
      category: readUploadCategory(formData),
    });
    return NextResponse.json(stored);
  } catch (error) {
    return handleUploadError(error);
  }
}
