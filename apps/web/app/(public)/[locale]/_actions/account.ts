"use server";

// The learner profile page's server actions (ADR-123 #4).
//
// Not anonymous, so not the newsletter/support pattern: the first line of each
// action is the SESSION, and a learner has no permission keys for
// `requirePermission()` to check (security.md #1's boundary, stated for this
// subject). What stands in for it is the scope: the only row any of these can
// write is `session.user.id`'s own — no input carries a user id
// (security.md #7) — and a STAFF session is refused outright, because staff
// edit themselves at `/admin/profile` and a second self-service surface for
// them is a second thing to secure.
//
// Password and two-factor are NOT here. They go to Better Auth's own handler
// from the browser (`_lib/account-security.ts` explains why a server action
// would sign the learner out), and are audited by `@repo/auth`'s hooks.
import { auth, rateLimit, refreshSessionUser } from "@repo/auth";
import { AVATAR_MAX_BYTES, learnerProfileSchema } from "@repo/contracts";
import { removeOwnAvatar, setOwnAvatar, updateOwnProfile, UploadRejectedError } from "@repo/core";

export type AccountActionResult =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "rejected" }
  | { status: "limited" }
  | { status: "unauthorized" };

/** Avatar writes per learner per hour — a picture is not changed forty times. */
const AVATAR_LIMIT = 10;
const AVATAR_WINDOW_SECONDS = 3600;

async function learnerId(): Promise<string | null> {
  const session = await auth();
  if (!session || session.user.userType !== "LEARNER") return null;
  return session.user.id;
}

export async function updateAccountProfileAction(input: unknown): Promise<AccountActionResult> {
  const userId = await learnerId();
  if (!userId) return { status: "unauthorized" };

  const parsed = learnerProfileSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };

  // Audited inside (`users.profileUpdate`), the same row the staff profile writes.
  await updateOwnProfile(userId, parsed.data);
  // The header reads `session.user`, which Better Auth serves from its own
  // copies of the row (ADR-125 §3).
  await refreshSessionUser(userId);
  return { status: "ok" };
}

export async function uploadAvatarAction(formData: FormData): Promise<AccountActionResult> {
  const userId = await learnerId();
  if (!userId) return { status: "unauthorized" };

  const limited = await rateLimit(`account:avatar:${userId}`, AVATAR_LIMIT, AVATAR_WINDOW_SECONDS);
  if (!limited.ok) return { status: "limited" };

  const file = formData.get("file");
  // The size is checked again in `setOwnAvatar` on the real bytes; this only
  // saves reading a file the service would refuse anyway.
  if (!(file instanceof File) || file.size === 0 || file.size > AVATAR_MAX_BYTES) {
    return { status: "rejected" };
  }

  try {
    // Bytes enter storage only through `@repo/core` (security.md #9), which
    // sniffs magic bytes and never reads `file.type`.
    await setOwnAvatar(userId, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name,
    });
  } catch (error) {
    if (error instanceof UploadRejectedError) return { status: "rejected" };
    throw error;
  }
  await refreshSessionUser(userId);
  return { status: "ok" };
}

export async function removeAvatarAction(): Promise<AccountActionResult> {
  const userId = await learnerId();
  if (!userId) return { status: "unauthorized" };
  await removeOwnAvatar(userId);
  await refreshSessionUser(userId);
  return { status: "ok" };
}
