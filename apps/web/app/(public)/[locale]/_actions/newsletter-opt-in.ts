"use server";

// The sign-up checkbox's newsletter opt-in (ADR-124).
//
// **Not an anonymous mutation**, and that is the point of it being a separate
// file from `newsletter.ts`: the sign-up form calls this AFTER Better Auth has
// created the account and set its session cookie, so there IS a subject — the
// learner who just ticked the box. `requirePermission()` does not fit (a
// learner holds no permission keys, the way `/api/learn/progress` records), so
// the session itself is the first line, then the flag, a per-account limit and
// the schema, then the core service.
//
// **The address is never an input.** `subscribeAccount` reads it from the
// account row by the session's user id, so this can only ever subscribe the
// caller's own mailbox — there is nobody else's address to point it at, and
// nothing to learn about anyone else from what it returns.
import { auth, rateLimit } from "@repo/auth";
import { newsletterAccountOptInSchema } from "@repo/contracts";
import { subscribeAccount } from "@repo/core";
import { isFeatureVisible } from "@repo/settings";

export type NewsletterOptInResult = "ok" | "failed";

/** One account ticks this box once; ten an hour is already generous. */
const ACCOUNT_LIMIT = 10;
const ACCOUNT_WINDOW_SECONDS = 3600;

export async function optInToNewsletterAction(input: unknown): Promise<NewsletterOptInResult> {
  const session = await auth();
  if (!session) return "failed";

  if (!(await isFeatureVisible("newsletter", null))) return "failed";

  const limit = await rateLimit(
    `newsletter:account:${session.user.id}`,
    ACCOUNT_LIMIT,
    ACCOUNT_WINDOW_SECONDS,
  );
  if (!limit.ok) return "failed";

  const parsed = newsletterAccountOptInSchema.safeParse(input);
  if (!parsed.success) return "failed";

  const result = await subscribeAccount({
    userId: session.user.id,
    locale: parsed.data.locale,
  });
  return result === "no_account" ? "failed" : "ok";
}
