// The account pages' one session gate (ADR-125 §1).
//
// A STAFF session is not a learner (ADR-052): the public header already treats
// it as signed out, and so do these pages. A signed-out reader goes to sign in
// and comes BACK to the page they asked for — and a verification link opened
// on another device keeps its `verified` flag, so sign-in can say so.
import { auth } from "@repo/auth";
import { redirect } from "@repo/i18n/navigation";

export async function requireLearnerSession(
  locale: string,
  returnTo: string,
  options: { verified?: boolean } = {},
): Promise<{ userId: string }> {
  const session = await auth();
  if (!session || session.user.userType !== "LEARNER") {
    const query = new URLSearchParams();
    if (options.verified) query.set("verified", "1");
    query.set("redirect", returnTo);
    return redirect({ href: `/sign-in?${query.toString()}`, locale });
  }
  return { userId: session.user.id };
}
