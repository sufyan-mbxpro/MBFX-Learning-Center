import { NextResponse } from "next/server";
import { ForbiddenError, UnauthenticatedError } from "@repo/rbac";

/**
 * Shared error → JSON mapping for the upload route handlers (image, media,
 * media replace). A real message (permission-denied or a @repo/core
 * validation failure like wrong MIME/oversized) reaches the client the
 * same way the equivalent server action's thrown message already does via
 * `error.message` — not a bare 500, which the upload-progress UI has
 * nothing useful to show for a retry.
 */
export function handleUploadError(error: unknown): NextResponse {
  if (error instanceof UnauthenticatedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Upload failed" },
    { status: 400 },
  );
}
