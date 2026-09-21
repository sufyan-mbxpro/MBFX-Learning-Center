// ADR-124 against real MariaDB: consent at sign-up, Resubscribe, Add subscriber.
//
// A sibling of `newsletter.integration.test.ts` rather than more of it, because
// these are three new ways onto the list and each has a rule about CONSENT
// that the original suite never had to state:
//
//   1. **A ticked sign-up box is consent; verification is the proof.** The row
//      waits PENDING until the account's email is verified, and only a
//      `signup` row is moved by that — a form row keeps needing its own click.
//   2. **An admin can undo only their OWN unsubscribe.** A reader who used
//      their unsubscribe link is invited back through a confirmation email,
//      never put back on the list by somebody else.
//   3. **An admin-added address is invited, not added.** PENDING, with the
//      same confirmation the public form sends.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as NewsletterModule from "./newsletter.ts";
import {
  startCmsTestDb,
  stopCmsTestDb,
  makeActor,
  type CmsTestContext,
} from "./test-utils/cms-container.ts";

let ctx: CmsTestContext;
let service: typeof NewsletterModule;
let actor: Awaited<ReturnType<typeof makeActor>>;

const sent: { key: string; to: string; variables: Record<string, string> }[] = [];

// The transport is the network edge testing.md allows a fake for; the
// recorder is also the only place a plaintext token exists.
vi.mock("@repo/email", () => ({
  sendTemplatedEmail: async (input: {
    key: string;
    to: string;
    variables?: Record<string, string>;
  }) => {
    sent.push({ key: input.key, to: input.to, variables: input.variables ?? {} });
    return { status: "SENT" as const, deliveryId: "test" };
  },
}));

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
  ctx = await startCmsTestDb();
  service = await import("./newsletter.ts");
  actor = await makeActor(ctx.db, "newsletter-consent-actor", [
    "newsletter.view",
    "newsletter.manage",
  ]);
}, 180_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

const EMAIL = "learner@example.test";
const USER_ID = "consent-learner";

beforeEach(async () => {
  sent.length = 0;
  await ctx.db.newsletterSubscriber.deleteMany({});
  await ctx.db.user.deleteMany({ where: { id: USER_ID } });
  await ctx.db.auditLog.deleteMany({ where: { entityType: "NewsletterSubscriber" } });
});

function tokenFrom(url: string): string {
  return new URL(url).searchParams.get("token") ?? "";
}

async function makeLearner(emailVerified = false) {
  await ctx.db.user.create({
    data: { id: USER_ID, email: EMAIL, name: "Learner", userType: "LEARNER", emailVerified },
  });
}

const row = () => ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });

// ─── 1. Sign-up opt-in ───────────────────────────────────────

describe("the sign-up checkbox (ADR-124 §1)", () => {
  it("creates a PENDING signup row for an unverified account, sends nothing, links nobody", async () => {
    await makeLearner(false);
    expect(await service.subscribeAccount({ userId: USER_ID, locale: "en" })).toBe("pending");

    const subscriber = await row();
    expect(subscriber?.status).toBe("PENDING");
    expect(subscriber?.source).toBe("signup");
    // No second "confirm" email: Better Auth's verification mail is the proof.
    expect(subscriber?.confirmTokenHash).toBeNull();
    expect(subscriber?.userId).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it("verification turns it ACTIVE, links the account and sends the welcome", async () => {
    await makeLearner(false);
    await service.subscribeAccount({ userId: USER_ID, locale: "en" });

    // Not yet verified: nothing moves.
    expect(await service.activateAccountSubscription(USER_ID)).toBe(false);

    await ctx.db.user.update({ where: { id: USER_ID }, data: { emailVerified: true } });
    expect(await service.activateAccountSubscription(USER_ID)).toBe(true);

    const subscriber = await row();
    expect(subscriber?.status).toBe("ACTIVE");
    expect(subscriber?.userId).toBe(USER_ID);
    expect(subscriber?.confirmedAt).not.toBeNull();
    expect(sent.map((s) => s.key)).toEqual(["newsletter.welcome"]);

    // A second verification event welcomes nobody twice.
    expect(await service.activateAccountSubscription(USER_ID)).toBe(false);
    expect(sent).toHaveLength(1);
  });

  it("an already-verified account is ACTIVE at once", async () => {
    await makeLearner(true);
    expect(await service.subscribeAccount({ userId: USER_ID, locale: "en" })).toBe("active");
    expect((await row())?.status).toBe("ACTIVE");
    expect(sent.map((s) => s.key)).toEqual(["newsletter.welcome"]);
  });

  it("leaves an ACTIVE subscription untouched", async () => {
    await makeLearner(true);
    await service.subscribeAccount({ userId: USER_ID, locale: "en" });
    const before = await row();
    sent.length = 0;

    expect(await service.subscribeAccount({ userId: USER_ID, locale: "en" })).toBe("unchanged");
    const after = await row();
    expect(after?.unsubscribeTokenHash).toBe(before?.unsubscribeTokenHash);
    expect(sent).toHaveLength(0);
  });

  it("verification does NOT confirm a pending row that came from a public form", async () => {
    await makeLearner(false);
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    await ctx.db.user.update({ where: { id: USER_ID }, data: { emailVerified: true } });

    expect(await service.activateAccountSubscription(USER_ID)).toBe(false);
    expect((await row())?.status).toBe("PENDING");
  });

  it("refuses an unknown or soft-deleted account", async () => {
    expect(await service.subscribeAccount({ userId: "nobody", locale: "en" })).toBe("no_account");
    await ctx.db.user.create({
      data: {
        id: USER_ID,
        email: EMAIL,
        name: "Gone",
        userType: "LEARNER",
        deletedAt: new Date(),
      },
    });
    expect(await service.subscribeAccount({ userId: USER_ID, locale: "en" })).toBe("no_account");
    expect(await row()).toBeNull();
  });
});

// ─── 2. Resubscribe ──────────────────────────────────────────

async function activeFromForm(): Promise<{ id: string; unsubscribeToken: string }> {
  await service.subscribe({ email: EMAIL, locale: "en", source: "news" });
  await service.confirmSubscription(tokenFrom(sent[0]!.variables["confirm.url"]!));
  const welcome = sent.find((s) => s.key === "newsletter.welcome")!;
  sent.length = 0;
  const subscriber = await row();
  return { id: subscriber!.id, unsubscribeToken: tokenFrom(welcome.variables["unsubscribe.url"]!) };
}

describe("Resubscribe (ADR-124 §2)", () => {
  it("undoes an ADMIN's unsubscribe outright, and the old unsubscribe link still works", async () => {
    const { id, unsubscribeToken } = await activeFromForm();
    await service.adminUnsubscribe(actor, id);
    expect((await row())?.unsubscribedVia).toBe("admin");

    expect(await service.adminResubscribe(actor, id)).toBe("restored");
    const restored = await row();
    expect(restored?.status).toBe("ACTIVE");
    expect(restored?.unsubscribedAt).toBeNull();
    expect(restored?.unsubscribedVia).toBeNull();
    expect(sent).toHaveLength(0);

    // The token in the welcome the reader already holds was not rotated.
    expect(await service.unsubscribe(unsubscribeToken)).toBe("unsubscribed");
  });

  it("never re-lists a reader who unsubscribed THEMSELVES — it sends a confirmation instead", async () => {
    const { id, unsubscribeToken } = await activeFromForm();
    await service.unsubscribe(unsubscribeToken);
    expect((await row())?.unsubscribedVia).toBe("subscriber");

    expect(await service.adminResubscribe(actor, id)).toBe("invited");
    const invited = await row();
    expect(invited?.status).toBe("PENDING");
    expect(sent.map((s) => s.key)).toEqual(["newsletter.confirm"]);

    // Only the reader's click finishes it.
    expect(await service.confirmSubscription(tokenFrom(sent[0]!.variables["confirm.url"]!))).toBe(
      "confirmed",
    );
    expect((await row())?.status).toBe("ACTIVE");
  });

  it("treats a row unsubscribed before the column existed as the reader's own", async () => {
    const { id } = await activeFromForm();
    await ctx.db.newsletterSubscriber.update({
      where: { id },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date(), unsubscribedVia: null },
    });
    expect(await service.adminResubscribe(actor, id)).toBe("invited");
    expect((await row())?.status).toBe("PENDING");
  });

  it("does not bring back an account link a hard erase removed", async () => {
    await ctx.db.user.create({
      data: { id: USER_ID, email: EMAIL, name: "Erased", userType: "LEARNER" },
    });
    const { id } = await activeFromForm();
    expect((await row())?.userId).toBe(USER_ID);

    await service.adminUnsubscribe(actor, id);
    await ctx.db.user.delete({ where: { id: USER_ID } });
    await service.adminResubscribe(actor, id);

    const restored = await row();
    expect(restored?.status).toBe("ACTIVE");
    expect(restored?.userId).toBeNull();
  });

  it("is a no-op on a row that is not unsubscribed, and audits what it does", async () => {
    const { id } = await activeFromForm();
    expect(await service.adminResubscribe(actor, id)).toBe("unchanged");

    await service.adminUnsubscribe(actor, id);
    await service.adminResubscribe(actor, id);
    const actions = (
      await ctx.db.auditLog.findMany({
        where: { entityType: "NewsletterSubscriber", entityId: id },
      })
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(["newsletter.unsubscribe", "newsletter.resubscribe"]),
    );
  });
});

// ─── 3. Add subscriber ───────────────────────────────────────

describe("Add subscriber (ADR-124 §3)", () => {
  it("invites a new address: PENDING, source admin, one confirmation, audited", async () => {
    expect(await service.adminAddSubscriber(actor, { email: EMAIL, locale: "en" })).toBe("invited");

    const subscriber = await row();
    expect(subscriber?.status).toBe("PENDING");
    expect(subscriber?.source).toBe("admin");
    expect(subscriber?.confirmTokenHash).not.toBeNull();
    expect(sent.map((s) => s.key)).toEqual(["newsletter.confirm"]);

    const audit = await ctx.db.auditLog.findFirst({ where: { action: "newsletter.add" } });
    expect(audit?.entityId).toBe(subscriber?.id);

    // The confirmation it sent is a real one.
    await service.confirmSubscription(tokenFrom(sent[0]!.variables["confirm.url"]!));
    expect((await row())?.status).toBe("ACTIVE");
  });

  it("says so for an address that is already active, and changes nothing", async () => {
    await activeFromForm();
    expect(await service.adminAddSubscriber(actor, { email: EMAIL, locale: "en" })).toBe(
      "already_active",
    );
    expect(sent).toHaveLength(0);
    expect((await row())?.source).toBe("news");
  });

  it("does not mail-bomb: a second add inside the cooldown sends nothing more", async () => {
    await service.adminAddSubscriber(actor, { email: EMAIL, locale: "en" });
    await service.adminAddSubscriber(actor, { email: EMAIL, locale: "en" });
    expect(sent).toHaveLength(1);
  });

  it("cannot route around Resubscribe: a self-unsubscribed address is only invited", async () => {
    const { unsubscribeToken } = await activeFromForm();
    await service.unsubscribe(unsubscribeToken);

    expect(await service.adminAddSubscriber(actor, { email: EMAIL, locale: "en" })).toBe("invited");
    expect((await row())?.status).toBe("PENDING");
  });
});
