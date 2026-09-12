// The newsletter service against real MariaDB (ADR-080 Enforcement).
//
// Five properties, and each one is here because a unit test with a mocked
// Prisma would have passed while the real thing was broken:
//
//   1. **Subscribe answers identically** for a new, pending and active
//      address. The whole anti-enumeration story is that the caller cannot
//      tell them apart, and `void` is only half of it — the other half is
//      that an ACTIVE row is not re-tokenised.
//   2. **Tokens are never stored in plaintext.** Asserted against the actual
//      column, because the mistake this catches is a service that hashes on
//      one path and forgets on another.
//   3. **Confirm is single-use and expiring**, which needs a real unique
//      index to be worth testing — the second click races the first through
//      `updateMany`, and a mock cannot lose that race.
//   4. **A hard-erased user leaves the subscription with a null `userId`.**
//      That is `onDelete: SetNull` in the schema, so only a real FK proves
//      it: mocking Prisma would hide exactly the constraint under test
//      (testing.md — "mocking Prisma hides FK and constraint bugs").
//   5. **CSV cells cannot execute.** A pure function, but asserted through
//      the real export so the guard is proven to be ON the path.
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

/** Every send this suite provokes, so the confirm URL can be inspected. */
const sent: { key: string; to: string; variables: Record<string, string> }[] = [];

// `@repo/email` is faked at the MODULE edge, and only there: this suite is
// about the database, and the sending transport is the network edge testing.md
// allows a fake for. `vi.mock` is hoisted above the imports, so it cannot live
// inside `beforeAll`.
//
// The recorder is also how the plaintext tokens are obtained — they exist
// nowhere else by design, which is the point of the hashing test below.
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
  actor = await makeActor(ctx.db, "newsletter-actor", [
    "newsletter.view",
    "newsletter.manage",
    "newsletter.export",
  ]);
}, 180_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

beforeEach(async () => {
  sent.length = 0;
  await ctx.db.newsletterSubscriber.deleteMany({});
});

const EMAIL = "reader@example.test";

function tokenFrom(url: string): string {
  return new URL(url).searchParams.get("token") ?? "";
}

// ─── Signup ──────────────────────────────────────────────────

describe("subscribe answers identically whatever the address's state (ADR-080 #1)", () => {
  it("creates a PENDING row and sends the confirmation for a new address", async () => {
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });

    const row = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
    expect(row?.status).toBe("PENDING");
    expect(row?.confirmedAt).toBeNull();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.key).toBe("newsletter.confirm");
  });

  it("returns the same void for an ACTIVE address, and does NOT re-tokenise it", async () => {
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    const token = tokenFrom(sent[0]!.variables["confirm.url"]!);
    expect(await service.confirmSubscription(token)).toBe("confirmed");
    sent.length = 0;

    const before = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
    await expect(
      service.subscribe({ email: EMAIL, locale: "en", source: "home" }),
    ).resolves.toBeUndefined();

    const after = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
    // Untouched: no new token, no second welcome, and the source of the
    // original opt-in is preserved rather than overwritten by a re-attempt.
    expect(after?.status).toBe("ACTIVE");
    expect(after?.source).toBe("footer");
    expect(after?.unsubscribeTokenHash).toBe(before?.unsubscribeTokenHash);
    expect(sent).toHaveLength(0);
  });

  it("throttles a resend on the row itself, so a dead Redis cannot mail-bomb", async () => {
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    expect(sent).toHaveLength(1);

    // Immediately again: inside the 10-minute cooldown, so nothing is sent
    // and the caller still gets void. This is the limit that survives the
    // rate limiter's fail-open path.
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    expect(sent).toHaveLength(1);
  });

  it("an UNSUBSCRIBED address opts in again through PENDING, never straight to ACTIVE", async () => {
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    const confirm = tokenFrom(sent[0]!.variables["confirm.url"]!);
    await service.confirmSubscription(confirm);
    const active = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });

    // Unsubscribe through the real token, then age the cooldown out.
    const unsubToken = tokenFrom(sent[1]!.variables["unsubscribe.url"]!);
    expect(await service.unsubscribe(unsubToken)).toBe("unsubscribed");
    await ctx.db.newsletterSubscriber.update({
      where: { id: active!.id },
      data: { lastConfirmSentAt: new Date(Date.now() - 3_600_000) },
    });
    sent.length = 0;

    await service.subscribe({ email: EMAIL, locale: "en", source: "news" });
    const row = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
    expect(row?.status).toBe("PENDING");
    expect(row?.unsubscribedAt).toBeNull();
    expect(sent[0]?.key).toBe("newsletter.confirm");
  });
});

describe("tokens are stored hashed, never in plaintext (ADR-080 #2)", () => {
  it("keeps no plaintext confirm or unsubscribe token in the table", async () => {
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    const confirmToken = tokenFrom(sent[0]!.variables["confirm.url"]!);
    await service.confirmSubscription(confirmToken);
    const unsubToken = tokenFrom(sent[1]!.variables["unsubscribe.url"]!);

    const row = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
    const serialised = JSON.stringify(row);
    // The plaintext went out in the email and is nowhere in the row — which
    // matters because an admin with `newsletter.view` can read this table.
    expect(serialised).not.toContain(confirmToken);
    expect(serialised).not.toContain(unsubToken);
    // A 64-char hex digest, not the 64-char hex token: same shape, different
    // value, which is why comparing lengths would prove nothing.
    expect(row?.unsubscribeTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.unsubscribeTokenHash).not.toBe(unsubToken);
  });
});

// ─── Confirm ─────────────────────────────────────────────────

describe("confirm is single-use and expiring (ADR-080 #2)", () => {
  it("confirms once and refuses the second press", async () => {
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    const token = tokenFrom(sent[0]!.variables["confirm.url"]!);

    expect(await service.confirmSubscription(token)).toBe("confirmed");
    expect(await service.confirmSubscription(token)).toBe("invalid");

    const row = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
    expect(row?.status).toBe("ACTIVE");
    expect(row?.confirmTokenHash).toBeNull();
    expect(row?.confirmedAt).not.toBeNull();
  });

  it("refuses an expired token without distinguishing it from an unknown one", async () => {
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    const token = tokenFrom(sent[0]!.variables["confirm.url"]!);
    await ctx.db.newsletterSubscriber.update({
      where: { email: EMAIL },
      data: { confirmExpiresAt: new Date(Date.now() - 1000) },
    });

    expect(await service.confirmSubscription(token)).toBe("invalid");
    expect(await service.confirmSubscription("0".repeat(64))).toBe("invalid");
  });

  it("sends the welcome with a working unsubscribe URL", async () => {
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    await service.confirmSubscription(tokenFrom(sent[0]!.variables["confirm.url"]!));

    expect(sent[1]?.key).toBe("newsletter.welcome");
    const url = sent[1]!.variables["unsubscribe.url"]!;
    expect(url).toContain("/newsletter/unsubscribe?token=");
    expect(await service.unsubscribe(tokenFrom(url))).toBe("unsubscribed");
  });
});

describe("the account link (ADR-080 #6)", () => {
  it("links a matching LIVE user at confirm time", async () => {
    await ctx.db.user.create({
      data: { id: "live-reader", email: EMAIL, name: "Reader", userType: "LEARNER" },
    });
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    await service.confirmSubscription(tokenFrom(sent[0]!.variables["confirm.url"]!));

    const row = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
    expect(row?.userId).toBe("live-reader");

    await ctx.db.user.delete({ where: { id: "live-reader" } });
  });

  it("does NOT link a soft-deleted user — the link would point at a dead account", async () => {
    await ctx.db.user.create({
      data: {
        id: "gone-reader",
        email: EMAIL,
        name: "Gone",
        userType: "LEARNER",
        deletedAt: new Date(),
      },
    });
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    await service.confirmSubscription(tokenFrom(sent[0]!.variables["confirm.url"]!));

    const row = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
    expect(row?.userId).toBeNull();

    await ctx.db.user.delete({ where: { id: "gone-reader" } });
  });

  it("a HARD erase of the user nulls userId and KEEPS the subscription", async () => {
    await ctx.db.user.create({
      data: { id: "erased-reader", email: EMAIL, name: "Erased", userType: "LEARNER" },
    });
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    await service.confirmSubscription(tokenFrom(sent[0]!.variables["confirm.url"]!));

    // This is the assertion the whole FK exists for: cascade-deleting would
    // read tidy and throw away a consent given independently of the account.
    await ctx.db.user.delete({ where: { id: "erased-reader" } });

    const row = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
    expect(row).not.toBeNull();
    expect(row?.userId).toBeNull();
    expect(row?.status).toBe("ACTIVE");
  });
});

// ─── Unsubscribe ─────────────────────────────────────────────

describe("unsubscribe is idempotent and its token is not consumed (ADR-080 #4)", () => {
  it("says unsubscribed twice, because from the reader's side it worked twice", async () => {
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    await service.confirmSubscription(tokenFrom(sent[0]!.variables["confirm.url"]!));
    const token = tokenFrom(sent[1]!.variables["unsubscribe.url"]!);

    expect(await service.unsubscribe(token)).toBe("unsubscribed");
    // Still valid: one-click unsubscribe has to keep working in every message
    // already sent, so the token is long-lived by design.
    expect(await service.unsubscribe(token)).toBe("unsubscribed");
    expect(await service.unsubscribe("f".repeat(64))).toBe("invalid");
  });

  it("drops a PENDING row's confirm token, so the inbox link cannot revive it", async () => {
    await service.subscribe({ email: EMAIL, locale: "en", source: "footer" });
    const confirmToken = tokenFrom(sent[0]!.variables["confirm.url"]!);
    const row = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });

    // Unsubscribed while still PENDING. The confirmation email is already in
    // the inbox, so the confirm token has to die with the subscription —
    // otherwise the link in that message quietly re-subscribes them.
    await service.adminUnsubscribe(actor, row!.id);

    expect(await service.confirmSubscription(confirmToken)).toBe("invalid");
    const after = await ctx.db.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
    expect(after?.status).toBe("UNSUBSCRIBED");
    expect(after?.confirmTokenHash).toBeNull();
  });
});

// ─── Admin ───────────────────────────────────────────────────

describe("the admin list and its actions (ADR-080 #7)", () => {
  beforeEach(async () => {
    for (const [i, source] of (["footer", "home", "news", "analysis"] as const).entries()) {
      await service.subscribe({ email: `r${i}@example.test`, locale: "en", source });
    }
  });

  it("counts by status and filters by source", async () => {
    const counts = await service.countSubscribers();
    expect(counts.pending).toBe(4);
    expect(counts.active).toBe(0);

    const page = await service.listSubscribers({ limit: 50, source: "news" });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.source).toBe("news");
  });

  it("pages by keyset without repeating or dropping a row", async () => {
    const first = await service.listSubscribers({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await service.listSubscribers({ limit: 2, cursor: first.nextCursor! });
    expect(second.items).toHaveLength(2);
    // Four rows, two pages, no overlap — the property offset paging loses
    // whenever a signup lands while someone is reading.
    const ids = [...first.items, ...second.items].map((row) => row.id);
    expect(new Set(ids).size).toBe(4);
    expect(second.nextCursor).toBeNull();
  });

  it("unsubscribe is reversible-shaped and delete is a hard erase, both audited", async () => {
    const page = await service.listSubscribers({ limit: 50 });
    const [first, second] = page.items;

    await service.adminUnsubscribe(actor, first!.id);
    const unsubscribed = await ctx.db.newsletterSubscriber.findUnique({ where: { id: first!.id } });
    expect(unsubscribed?.status).toBe("UNSUBSCRIBED");
    expect(unsubscribed?.unsubscribedAt).not.toBeNull();

    await service.deleteSubscriber(actor, second!.id);
    expect(await ctx.db.newsletterSubscriber.findUnique({ where: { id: second!.id } })).toBeNull();

    const audits = await ctx.db.auditLog.findMany({
      where: { entityType: "NewsletterSubscriber" },
      orderBy: { createdAt: "asc" },
    });
    const actions = audits.map((row) => row.action);
    expect(actions).toContain("newsletter.unsubscribe");
    // The delete's audit row has to OUTLIVE the row it describes — that is
    // the trail's whole job here, since the subscriber is gone.
    expect(actions).toContain("newsletter.delete");
  });
});

describe("the CSV export cannot execute in a spreadsheet (ADR-080 #7)", () => {
  it("prefixes a formula cell and quotes every field", async () => {
    // An address is validated on the public path, but the export must be safe
    // for a row that reached the table any other way (a seed, a migration, a
    // future import), so the guard is unconditional.
    await ctx.db.newsletterSubscriber.create({
      data: {
        email: '=hyperlink("http://evil.test")@example.test',
        locale: "en",
        source: "footer",
        unsubscribeTokenHash: "a".repeat(64),
      },
    });

    let csv = "";
    for await (const chunk of service.exportSubscribersCsv(actor, {})) csv += chunk;

    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "email,status,source,locale,linkedUserId,createdAt,confirmedAt,unsubscribedAt",
    );
    // A tab moves the cell out of formula position; the value stays readable.
    expect(lines[1]).toContain('"\t=hyperlink');
    expect(csv).not.toContain('"=hyperlink');

    const audits = await ctx.db.auditLog.findMany({ where: { action: "newsletter.export" } });
    expect(audits.length).toBeGreaterThan(0);
  });
});

// ─── Housekeeping ────────────────────────────────────────────

describe("retention (ADR-080 #1, ADR-078 #5)", () => {
  it("purges only PENDING rows older than 7 days", async () => {
    const old = new Date(Date.now() - 8 * 86_400_000);
    await ctx.db.newsletterSubscriber.createMany({
      data: [
        {
          email: "old-pending@example.test",
          locale: "en",
          source: "footer",
          status: "PENDING",
          createdAt: old,
          unsubscribeTokenHash: "b".repeat(64),
        },
        // Confirmed a year ago: never in range. `createdAt` alone as the
        // filter would delete the whole list.
        {
          email: "old-active@example.test",
          locale: "en",
          source: "footer",
          status: "ACTIVE",
          createdAt: old,
          unsubscribeTokenHash: "c".repeat(64),
        },
      ],
    });

    expect(await service.purgeExpiredPending()).toBe(1);
    expect(
      await ctx.db.newsletterSubscriber.findUnique({ where: { email: "old-active@example.test" } }),
    ).not.toBeNull();
  });

  it("purges delivery rows past 90 days, and never sooner", async () => {
    await ctx.db.emailDelivery.createMany({
      data: [
        {
          templateKey: "auth.password_reset",
          to: "a@example.test",
          locale: "en",
          subject: "old",
          status: "SENT",
          createdAt: new Date(Date.now() - 91 * 86_400_000),
        },
        {
          templateKey: "auth.password_reset",
          to: "b@example.test",
          locale: "en",
          subject: "recent",
          status: "SENT",
          createdAt: new Date(Date.now() - 89 * 86_400_000),
        },
      ],
    });

    expect(await service.purgeEmailDeliveries()).toBe(1);
    const left = await ctx.db.emailDelivery.findMany({});
    expect(left.map((row) => row.subject)).toEqual(["recent"]);
    await ctx.db.emailDelivery.deleteMany({});
  });

  it("pins the retention window as a constant nothing may raise (plan Q2)", () => {
    expect(service.DELIVERY_RETENTION_DAYS).toBe(90);
    expect(service.PENDING_PURGE_DAYS).toBe(7);
    expect(service.CONFIRM_TOKEN_TTL_HOURS).toBe(48);
  });
});

// ─── Links ───────────────────────────────────────────────────

describe("newsletterLink is a PUBLIC link in the subscriber's locale", () => {
  it("omits the segment for the default locale and carries it otherwise", () => {
    const origins = { site: "https://example.test/", defaultLocale: "en" };
    expect(service.newsletterLink("confirm", "abc", "en", origins)).toBe(
      "https://example.test/newsletter/confirm?token=abc",
    );
    expect(service.newsletterLink("unsubscribe", "abc", "ar", origins)).toBe(
      "https://example.test/ar/newsletter/unsubscribe?token=abc",
    );
  });

  it("never produces an /admin URL, unlike a password reset", () => {
    // ADR-079 #2 routes a reset by `userType`; a subscription has none, and a
    // staff member who subscribes is a reader like any other.
    const link = service.newsletterLink("unsubscribe", "abc", "en", {
      site: "https://example.test",
    });
    expect(link).not.toContain("/admin");
  });
});
