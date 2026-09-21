// Newsletter subscriptions (Module 17, ADR-080, changes-21 F7).
//
// Double opt-in, and the consent outlives the account. Four properties are
// the reason this file reads the way it does:
//
//   1. **`subscribe()` answers identically for every input.** New, pending,
//      active, previously-unsubscribed — all return `void`, and the form says
//      "check your inbox" to all four. An address that already subscribed
//      must not be distinguishable from one that did not, or the form becomes
//      a membership oracle for anybody's mailbox.
//   2. **Tokens are stored HASHED** (ADR-080 #2). The plaintext exists for
//      exactly as long as it takes to put it in a URL; the column holds a
//      SHA-256 hex digest. An admin with `newsletter.view` can read this
//      table, and a plaintext unsubscribe token there is a way to unsubscribe
//      anyone from the admin screen.
//   3. **Confirm is single-use and expiring; unsubscribe is neither.** The
//      unsubscribe token has to keep working in a message sent months ago
//      (RFC 8058 one-click), so it is long-lived by design — and
//      unsubscribing is the safe direction to be wrong in.
//   4. **`userId` is filled at CONFIRM time and nulled by a hard erase**
//      (ADR-080 #6). The consent was given independently of the account.
//
// Sending is fire-and-forget from the caller's point of view: every path here
// returns before delivery matters, and `sendTemplatedEmail` never throws
// (ADR-078 #9). A subscription is not lost because a mail server was down.
import { createHash, randomBytes } from "node:crypto";
import { sendTemplatedEmail } from "@repo/email";
import type {
  NewsletterPlacement,
  SubscriberFilter,
  SubscriberExportFilter,
} from "@repo/contracts";
import { db, SubscriberStatus } from "@repo/db";
import { getSetting } from "@repo/settings";
import { recordAudit } from "./index.ts";

/** ADR-080 #1. A row that never gets confirmed disappears and can try again. */
export const CONFIRM_TOKEN_TTL_HOURS = 48;
export const PENDING_PURGE_DAYS = 7;

/**
 * ADR-078 #5 / plan Q2: **90 days, and never longer.** The log holds no body,
 * but the recipient addresses are PII, so the shorter of "works" and
 * "minimal" wins — support conversations about a missing reset email happen
 * the same week, not the same quarter. One constant, deliberately here beside
 * the sweep that reads it rather than in the route handler.
 */
export const DELIVERY_RETENTION_DAYS = 90;

/** A resend is throttled by the row itself, so no Redis key is needed. */
const CONFIRM_RESEND_COOLDOWN_MINUTES = 10;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 32 bytes of hex — the shape `newsletterTokenSchema` enforces on the way in. */
function newToken(): string {
  return randomBytes(32).toString("hex");
}

// ─── Links ───────────────────────────────────────────────────

export interface NewsletterLinkOrigins {
  site: string;
  /** The unprefixed locale (Module 06 routing). */
  defaultLocale?: string;
}

/**
 * Pure, and exported for its test: a newsletter link is a PUBLIC link in the
 * subscriber's own locale. There is no staff variant — unlike a password reset
 * (ADR-079 #2), a newsletter subscription has no `userType` to route by, and a
 * staff member who subscribes is a reader like any other.
 */
export function newsletterLink(
  action: "confirm" | "unsubscribe",
  token: string,
  locale: string,
  origins: NewsletterLinkOrigins,
): string {
  const defaultLocale = origins.defaultLocale ?? "en";
  const prefix = locale && locale !== defaultLocale ? `/${locale}` : "";
  return `${origins.site.replace(/\/+$/, "")}${prefix}/newsletter/${action}?token=${encodeURIComponent(token)}`;
}

function origins(): NewsletterLinkOrigins {
  return { site: process.env.NEXT_PUBLIC_SITE_URL ?? "" };
}

// ─── Signup ──────────────────────────────────────────────────

export interface SubscribeInput {
  /** Already lower-cased and validated by `newsletterSubscribeSchema`. */
  email: string;
  locale: string;
  source: NewsletterPlacement;
}

/**
 * Create or refresh a PENDING subscription and send the confirmation.
 *
 * Returns `void` for every input by design (ADR-080 #1). The caller has
 * nothing to branch on, which is what makes the form's single success message
 * honest rather than a lie of omission.
 *
 * No audit row: there is no actor, and writing `userId: null` audit rows for
 * anonymous signups would fill the trail that exists to answer "who did
 * this?" with rows that cannot.
 */
export async function subscribe(input: SubscribeInput): Promise<void> {
  const now = new Date();
  const existing = await db.newsletterSubscriber.findUnique({
    where: { email: input.email },
    select: { id: true, status: true, lastConfirmSentAt: true },
  });

  // An ACTIVE address is left exactly as it is — no new token, no second
  // welcome, no `updatedAt` churn — and the caller still gets `void`.
  if (existing?.status === SubscriberStatus.ACTIVE) return;

  // Re-subscribing after unsubscribing is a fresh opt-in, not a revival: it
  // goes back through PENDING and the confirmation email, because the whole
  // point of double opt-in is that nobody is on the list without clicking.
  const cooledDown =
    !existing?.lastConfirmSentAt ||
    now.getTime() - existing.lastConfirmSentAt.getTime() >=
      CONFIRM_RESEND_COOLDOWN_MINUTES * 60 * 1000;

  const token = newToken();
  const confirmExpiresAt = new Date(now.getTime() + CONFIRM_TOKEN_TTL_HOURS * 3_600_000);

  if (existing && !cooledDown) {
    // Inside the cooldown the row is untouched and nothing is sent. The
    // visitor still sees "check your inbox", which is true: one is already
    // there. This is the per-email limit's last line — the action's Redis
    // budget is the first — and it survives a Redis outage, which the
    // limiter's fail-open path does not.
    return;
  }

  // Two submissions of the same address can reach this line together — the
  // per-IP limit allows a burst, and both writes run in `after()`. `upsert`
  // resolves that as a unique-constraint violation on `email`, which is the
  // ONE error here that means "someone else already did what we were about
  // to do": the row exists and its confirmation is on its way, so the
  // outcome the caller asked for has happened. Anything else rethrows.
  try {
    await createOrRefreshPending({ ...input, token, confirmExpiresAt, now });
  } catch (error) {
    if (isUniqueViolation(error)) return;
    throw error;
  }

  await sendTemplatedEmail({
    key: "newsletter.confirm",
    to: input.email,
    locale: input.locale,
    variables: { "confirm.url": newsletterLink("confirm", token, input.locale, origins()) },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function createOrRefreshPending(input: {
  email: string;
  locale: string;
  source: NewsletterPlacement;
  token: string;
  confirmExpiresAt: Date;
  now: Date;
}): Promise<void> {
  const { email, locale, source, token, confirmExpiresAt, now } = input;
  await db.newsletterSubscriber.upsert({
    where: { email },
    create: {
      email,
      locale,
      source,
      status: SubscriberStatus.PENDING,
      confirmTokenHash: hashToken(token),
      confirmExpiresAt,
      // Minted here and rotated at confirm time, so a row that is never
      // confirmed never had an unsubscribe token anybody could hold.
      unsubscribeTokenHash: hashToken(newToken()),
      lastConfirmSentAt: now,
    },
    update: {
      // The locale and source of the LATEST attempt win: the reader is
      // telling us where they are now.
      locale,
      source,
      status: SubscriberStatus.PENDING,
      confirmTokenHash: hashToken(token),
      confirmExpiresAt,
      unsubscribedAt: null,
      unsubscribedVia: null,
      lastConfirmSentAt: now,
    },
  });
}

export type ConfirmResult = "confirmed" | "invalid";

/**
 * Consume a confirm token.
 *
 * "invalid" covers unknown, expired and already-used, deliberately without
 * distinguishing them: the screen offers the same "ask for a new link" either
 * way, and separating them would tell a token-guesser which guesses were
 * close.
 */
export async function confirmSubscription(token: string): Promise<ConfirmResult> {
  const now = new Date();
  const row = await db.newsletterSubscriber.findUnique({
    where: { confirmTokenHash: hashToken(token) },
    select: { id: true, email: true, locale: true, confirmExpiresAt: true },
  });
  if (!row) return "invalid";
  if (!row.confirmExpiresAt || row.confirmExpiresAt <= now) return "invalid";

  // ADR-080 #6: link the account at confirm time, when the address is known
  // to belong to whoever clicked. A soft-deleted user is not "live", so it
  // does not match — and `userId` stays null rather than pointing at a
  // deleted account.
  const user = await db.user.findFirst({
    where: { email: row.email, deletedAt: null },
    select: { id: true },
  });

  const updated = await db.newsletterSubscriber.updateMany({
    // The token is matched AGAIN in the write, so two clicks racing each
    // other (a mail client prefetch and a human, say) cannot both succeed:
    // the second matches nothing, because the first nulled the hash.
    where: { id: row.id, confirmTokenHash: hashToken(token) },
    data: {
      status: SubscriberStatus.ACTIVE,
      confirmedAt: now,
      confirmTokenHash: null,
      confirmExpiresAt: null,
      ...(user ? { userId: user.id } : {}),
    },
  });
  if (updated.count === 0) return "invalid";

  await sendWelcome(row);
  return "confirmed";
}

/**
 * Rotate the unsubscribe token and send the welcome that carries it — the
 * tail every path to ACTIVE shares: a confirm click and a verified account's
 * opt-in (ADR-124).
 */
async function sendWelcome(row: { id: string; email: string; locale: string }): Promise<void> {
  const unsubscribeToken = await rotateUnsubscribeToken(row.id);
  await sendTemplatedEmail({
    key: "newsletter.welcome",
    to: row.email,
    locale: row.locale,
    variables: {
      "unsubscribe.url": newsletterLink("unsubscribe", unsubscribeToken, row.locale, origins()),
    },
    unsubscribe: {
      url: newsletterLink("unsubscribe", unsubscribeToken, row.locale, origins()),
      // The visible word comes from the catalog at the call site; this header
      // is machine-read (RFC 8058) and never displayed.
      label: "Unsubscribe",
    },
  });
}

/**
 * Mint a fresh unsubscribe token and store only its hash.
 *
 * It is rotated at confirm time rather than reused from the create, because
 * the create's token was never in anyone's hands — and this way the plaintext
 * exists exactly once, in the one email that carries it.
 */
async function rotateUnsubscribeToken(id: string): Promise<string> {
  const token = newToken();
  await db.newsletterSubscriber.update({
    where: { id },
    data: { unsubscribeTokenHash: hashToken(token) },
  });
  return token;
}

export type UnsubscribeResult = "unsubscribed" | "invalid";

/**
 * Honour an unsubscribe token. Idempotent — clicking twice says
 * "unsubscribed" twice, because from the reader's point of view it worked
 * both times.
 *
 * The token is NOT consumed: it is the same token in every message already
 * sent, and one-click unsubscribe must keep working (ADR-080 consequences).
 */
export async function unsubscribe(token: string): Promise<UnsubscribeResult> {
  const row = await db.newsletterSubscriber.findUnique({
    where: { unsubscribeTokenHash: hashToken(token) },
    select: { id: true, status: true },
  });
  if (!row) return "invalid";
  if (row.status === SubscriberStatus.UNSUBSCRIBED) return "unsubscribed";

  await db.newsletterSubscriber.update({
    where: { id: row.id },
    data: {
      status: SubscriberStatus.UNSUBSCRIBED,
      unsubscribedAt: new Date(),
      unsubscribedVia: "subscriber",
      // A pending row that unsubscribes drops its confirm token too, so the
      // confirmation link in the inbox cannot resurrect it.
      confirmTokenHash: null,
      confirmExpiresAt: null,
    },
  });
  return "unsubscribed";
}

// ─── Consent given with an account (ADR-124) ─────────────────

export type AccountOptInResult = "pending" | "active" | "unchanged" | "no_account";

/**
 * The sign-up checkbox: subscribe the address on a SIGNED-IN account.
 *
 * The caller passes a user id taken from the session and nothing else — the
 * address is read from the account row, so this can never subscribe a mailbox
 * the caller does not hold an account for.
 *
 * **The ticked box is the consent; the account's email verification is the
 * confirmation.** ADR-080's double opt-in exists so nobody is on the list
 * without proving the mailbox is theirs, and Better Auth is already sending
 * exactly that proof — a second "confirm your subscription" email in the same
 * minute would ask the reader to prove the same thing twice. So:
 *
 * - account not yet verified → a PENDING row with source `signup` and no
 *   confirm token; `activateAccountSubscription` turns it ACTIVE when the
 *   verification link is used (the 7-day pending purge still applies);
 * - account already verified → ACTIVE now, and the welcome is sent.
 *
 * An ACTIVE row is left alone. A PENDING row from a form keeps its confirm
 * token, so either proof confirms it. An UNSUBSCRIBED row opts in again, which
 * is what ticking the box says.
 *
 * No audit row, for `subscribe()`'s reason: the actor IS the subscriber, and
 * the row's own `source` and timestamps are the record.
 */
export async function subscribeAccount(input: {
  userId: string;
  locale: string;
}): Promise<AccountOptInResult> {
  const user = await db.user.findFirst({
    where: { id: input.userId, deletedAt: null },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) return "no_account";

  const email = user.email.trim().toLowerCase();
  const existing = await db.newsletterSubscriber.findUnique({
    where: { email },
    select: { id: true, status: true },
  });
  if (existing?.status === SubscriberStatus.ACTIVE) return "unchanged";

  const pending = {
    locale: input.locale,
    source: "signup",
    status: SubscriberStatus.PENDING,
    unsubscribedAt: null,
    unsubscribedVia: null,
  };

  let id: string;
  try {
    if (existing) {
      await db.newsletterSubscriber.update({ where: { id: existing.id }, data: pending });
      id = existing.id;
    } else {
      const created = await db.newsletterSubscriber.create({
        data: {
          email,
          ...pending,
          // Minted and never handed out; `sendWelcome` rotates it on the way
          // to ACTIVE, exactly as a confirm click does.
          unsubscribeTokenHash: hashToken(newToken()),
        },
        select: { id: true },
      });
      id = created.id;
    }
  } catch (error) {
    // A form submission for the same address landed first. Its row exists
    // and its own confirmation is on the way.
    if (isUniqueViolation(error)) return "pending";
    throw error;
  }

  if (!user.emailVerified) return "pending";
  await activate({ id, email, locale: input.locale }, user.id);
  return "active";
}

/**
 * Called when an account's email is verified: a `signup` subscription waiting
 * on that proof becomes ACTIVE and linked to the account — ADR-080 #6's "link
 * when the address is known to belong to the account", which is now.
 *
 * Only `source: "signup"` rows move. A PENDING row from a public form was
 * asked to confirm through its own email, and verifying an account that
 * shares the address is not a click on that link.
 */
export async function activateAccountSubscription(userId: string): Promise<boolean> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null, emailVerified: true },
    select: { id: true, email: true },
  });
  if (!user) return false;

  const row = await db.newsletterSubscriber.findUnique({
    where: { email: user.email.trim().toLowerCase() },
    select: { id: true, email: true, locale: true, status: true, source: true },
  });
  if (!row || row.status !== SubscriberStatus.PENDING || row.source !== "signup") return false;

  return activate(row, user.id);
}

/** PENDING → ACTIVE, matched on the status so two callers cannot both welcome. */
async function activate(
  row: { id: string; email: string; locale: string },
  userId: string,
): Promise<boolean> {
  const updated = await db.newsletterSubscriber.updateMany({
    where: { id: row.id, status: SubscriberStatus.PENDING },
    data: {
      status: SubscriberStatus.ACTIVE,
      confirmedAt: new Date(),
      confirmTokenHash: null,
      confirmExpiresAt: null,
      userId,
    },
  });
  if (updated.count === 0) return false;
  await sendWelcome(row);
  return true;
}

// ─── Placement ───────────────────────────────────────────────

/**
 * The four placement settings (ADR-080 #5). The FLAG decides whether signup
 * exists at all; this decides where the form is drawn — which is why a
 * placement read never touches the flag, and every render site checks both.
 *
 * **`getSetting`, not `loadSetting`** (architecture.md #11). The footer draws
 * on every public page, so an uncached read here is an uncached read
 * everywhere: Prisma reaches for `Date.now()` while timing a query, Cache
 * Components rejects an unstable value during prerender, and the whole route
 * falls out of ISR. That is not theoretical — writing this with `loadSetting`
 * broke the prerender of `/[locale]/learn/[track]/[course]` outright, and it
 * is the same trap `resolveRecommendations` documents in `public-courses.ts`.
 * `getSetting` carries the frozen `settings:email` tag, so an admin toggling a
 * placement still invalidates it.
 */
export async function isNewsletterPlacementEnabled(source: NewsletterPlacement): Promise<boolean> {
  return (await getSetting(`newsletter.placements.${source}`)) !== false;
}

// ─── Admin ───────────────────────────────────────────────────

export interface SubscriberRow {
  id: string;
  email: string;
  locale: string;
  status: SubscriberStatus;
  source: string;
  userId: string | null;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
}

export interface SubscribersPage {
  items: SubscriberRow[];
  /** Opaque; pass back as `cursor`. Null means this was the last page. */
  nextCursor: string | null;
}

/** `createdAt|id`, base64url — the ADR-067 cursor, as the delivery log uses. */
export function encodeSubscriberCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

export function decodeSubscriberCursor(cursor: string): { createdAt: Date; id: string } | null {
  const [timestamp, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  if (!timestamp || !id) return null;
  const createdAt = new Date(timestamp);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
}

function subscriberWhere(filter: {
  status?: SubscriberStatus | string | undefined;
  source?: string | undefined;
  q?: string | undefined;
}): Record<string, unknown> {
  return {
    ...(filter.status ? { status: filter.status as SubscriberStatus } : {}),
    ...(filter.source ? { source: filter.source } : {}),
    ...(filter.q ? { email: { contains: filter.q } } : {}),
  };
}

/** One page, newest first. Keyset, because signups land under the reader. */
export async function listSubscribers(filter: SubscriberFilter): Promise<SubscribersPage> {
  const cursor = filter.cursor ? decodeSubscriberCursor(filter.cursor) : null;
  const rows = await db.newsletterSubscriber.findMany({
    where: {
      ...subscriberWhere(filter),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: filter.limit + 1, // the extra row answers "is there a next page" without a count
  });

  const hasMore = rows.length > filter.limit;
  const page = hasMore ? rows.slice(0, filter.limit) : rows;
  const last = page.at(-1);

  return {
    items: page.map((row) => ({
      id: row.id,
      email: row.email,
      locale: row.locale,
      status: row.status,
      source: row.source,
      userId: row.userId,
      confirmedAt: row.confirmedAt,
      unsubscribedAt: row.unsubscribedAt,
      createdAt: row.createdAt,
    })),
    nextCursor: hasMore && last ? encodeSubscriberCursor(last) : null,
  };
}

export interface SubscriberCounts {
  active: number;
  pending: number;
  unsubscribed: number;
}

export async function countSubscribers(): Promise<SubscriberCounts> {
  const grouped = await db.newsletterSubscriber.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const at = (status: SubscriberStatus) =>
    grouped.find((row) => row.status === status)?._count._all ?? 0;
  return {
    active: at(SubscriberStatus.ACTIVE),
    pending: at(SubscriberStatus.PENDING),
    unsubscribed: at(SubscriberStatus.UNSUBSCRIBED),
  };
}

/**
 * Neutralise a spreadsheet formula cell (ADR-080 #7).
 *
 * A cell opening with `=`, `+`, `-` or `@` is executed by Excel, Sheets and
 * LibreOffice on open, so `=HYPERLINK(...)` in an address field becomes a
 * phishing link in a file an administrator downloaded from their own admin.
 * Prefixing a tab moves the cell out of formula position while leaving the
 * value readable, which quoting alone does not.
 */
export function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `\t${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

const CSV_COLUMNS = [
  "email",
  "status",
  "source",
  "locale",
  "linkedUserId",
  "createdAt",
  "confirmedAt",
  "unsubscribedAt",
] as const;

/**
 * Stream the matching subscribers as CSV.
 *
 * An async iterable rather than a string: the export is unbounded by design
 * (that is what "export the list" means), and buffering the whole list to
 * build one response body is the one place in this module where the row count
 * could matter. The route pipes it.
 *
 * Audited — an export is a bulk read of PII, and the one action here that
 * leaves the system with a copy of it.
 */
export async function* exportSubscribersCsv(
  actor: { id: string },
  filter: SubscriberExportFilter,
): AsyncIterable<string> {
  await recordAudit({
    userId: actor.id,
    action: "newsletter.export",
    entityType: "NewsletterSubscriber",
    changes: { after: { status: filter.status, source: filter.source, q: filter.q } },
  });

  yield `${CSV_COLUMNS.join(",")}\n`;

  const where = subscriberWhere(filter);
  let cursor: { createdAt: Date; id: string } | null = null;
  const BATCH = 500;

  for (;;) {
    const rows: Awaited<ReturnType<typeof db.newsletterSubscriber.findMany>> =
      await db.newsletterSubscriber.findMany({
        where: {
          ...where,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: BATCH,
      });
    if (rows.length === 0) return;

    for (const row of rows) {
      yield `${[
        csvCell(row.email),
        csvCell(row.status),
        csvCell(row.source),
        csvCell(row.locale),
        csvCell(row.userId ?? ""),
        csvCell(row.createdAt.toISOString()),
        csvCell(row.confirmedAt?.toISOString() ?? ""),
        csvCell(row.unsubscribedAt?.toISOString() ?? ""),
      ].join(",")}\n`;
    }

    if (rows.length < BATCH) return;
    const last = rows.at(-1);
    if (!last) return;
    cursor = { createdAt: last.createdAt, id: last.id };
  }
}

/** The reversible row action: the address stays, the sending stops. */
export async function adminUnsubscribe(actor: { id: string }, id: string): Promise<void> {
  const row = await db.newsletterSubscriber.findUnique({
    where: { id },
    select: { id: true, email: true, status: true },
  });
  if (!row || row.status === SubscriberStatus.UNSUBSCRIBED) return;

  await db.newsletterSubscriber.update({
    where: { id },
    data: {
      status: SubscriberStatus.UNSUBSCRIBED,
      unsubscribedAt: new Date(),
      // ADR-124: recorded so "Resubscribe" knows this stop was the list's
      // own, not the reader's, and may be undone without a fresh opt-in.
      unsubscribedVia: "admin",
      confirmTokenHash: null,
      confirmExpiresAt: null,
    },
  });

  await recordAudit({
    userId: actor.id,
    action: "newsletter.unsubscribe",
    entityType: "NewsletterSubscriber",
    entityId: id,
    changes: { before: { status: row.status }, after: { status: "UNSUBSCRIBED" } },
  });
}

export type AdminResubscribeResult = "restored" | "invited" | "unchanged";

/**
 * "Resubscribe" — the restore beside `adminUnsubscribe` (ADR-124).
 *
 * **Which way it goes depends on who stopped the mail.** An unsubscribe the
 * LIST made (`unsubscribedVia: "admin"`) on a row that had been confirmed is
 * undone outright: the reader's consent and mailbox proof are both still on
 * record, and the admin is reversing their own action — which is why the
 * screen does not confirm it (code-style #7: restore is the undo). Anything
 * else — the reader used their own unsubscribe link, the row predates the
 * column, or it was never confirmed — goes back to PENDING with a fresh
 * confirmation email. An administrator cannot put a reader who withdrew back
 * on the list; only the reader's click can.
 *
 * **The unsubscribe token is kept on a restore**, so the link in every message
 * that reader already holds keeps working (ADR-080 #2). The invitation path
 * rotates it at confirm time, as every confirm does.
 *
 * `userId` is never touched: a link a hard erase nulled stays null.
 */
export async function adminResubscribe(
  actor: { id: string },
  id: string,
): Promise<AdminResubscribeResult> {
  const row = await db.newsletterSubscriber.findUnique({ where: { id }, select: RESTORE_SELECT });
  if (!row || row.status !== SubscriberStatus.UNSUBSCRIBED) return "unchanged";

  const result = await restoreOrInvite(row);
  await recordAudit({
    userId: actor.id,
    action: "newsletter.resubscribe",
    entityType: "NewsletterSubscriber",
    entityId: id,
    changes: {
      before: { status: row.status, unsubscribedVia: row.unsubscribedVia },
      after: { status: result === "restored" ? "ACTIVE" : "PENDING" },
    },
  });
  return result;
}

const RESTORE_SELECT = {
  id: true,
  email: true,
  locale: true,
  status: true,
  confirmedAt: true,
  unsubscribedVia: true,
  lastConfirmSentAt: true,
  confirmTokenHash: true,
  confirmExpiresAt: true,
} as const;

interface RestorableRow {
  id: string;
  email: string;
  locale: string;
  confirmedAt: Date | null;
  unsubscribedVia: string | null;
  lastConfirmSentAt: Date | null;
  confirmTokenHash: string | null;
  confirmExpiresAt: Date | null;
}

async function restoreOrInvite(row: RestorableRow): Promise<"restored" | "invited"> {
  if (row.unsubscribedVia === "admin" && row.confirmedAt) {
    await db.newsletterSubscriber.update({
      where: { id: row.id },
      data: { status: SubscriberStatus.ACTIVE, unsubscribedAt: null, unsubscribedVia: null },
    });
    return "restored";
  }
  await invite(row);
  return "invited";
}

/**
 * Put a row into PENDING with a fresh confirm token and send the confirmation
 * — unless a still-usable one went out inside the cooldown, which is what
 * stops a double-clicked admin button mail-bombing an inbox.
 *
 * "Still usable" matters: a confirmation that was already CLICKED (the token
 * is null) or has expired is no reason to hold back a new one. Holding back on
 * `lastConfirmSentAt` alone would leave a reader who confirmed and then
 * unsubscribed a minute later in PENDING with no link that could ever confirm
 * it.
 */
async function invite(
  row: {
    id: string;
    email: string;
    locale: string;
    lastConfirmSentAt: Date | null;
    confirmTokenHash: string | null;
    confirmExpiresAt: Date | null;
  },
  extra: { source?: string } = {},
): Promise<void> {
  const now = new Date();
  const outstanding = row.confirmTokenHash !== null && (row.confirmExpiresAt ?? now) > now;
  const cooledDown =
    !outstanding ||
    !row.lastConfirmSentAt ||
    now.getTime() - row.lastConfirmSentAt.getTime() >= CONFIRM_RESEND_COOLDOWN_MINUTES * 60 * 1000;
  const token = newToken();

  await db.newsletterSubscriber.update({
    where: { id: row.id },
    data: {
      ...extra,
      locale: row.locale,
      status: SubscriberStatus.PENDING,
      unsubscribedAt: null,
      unsubscribedVia: null,
      ...(cooledDown
        ? {
            confirmTokenHash: hashToken(token),
            confirmExpiresAt: new Date(now.getTime() + CONFIRM_TOKEN_TTL_HOURS * 3_600_000),
            lastConfirmSentAt: now,
          }
        : {}),
    },
  });
  if (!cooledDown) return;

  await sendTemplatedEmail({
    key: "newsletter.confirm",
    to: row.email,
    locale: row.locale,
    variables: { "confirm.url": newsletterLink("confirm", token, row.locale, origins()) },
  });
}

export type AdminAddSubscriberResult = "invited" | "restored" | "already_active";

/**
 * "Add subscriber" (ADR-124). **The address is INVITED, not added**: the row
 * is PENDING, source `admin`, and the reader gets the same confirmation email
 * the public form sends. An administrator typing an address is precisely
 * "someone subscribing a mailbox they do not own" — the case ADR-080 rejected
 * single opt-in for. The admin's word is not the reader's consent, and a
 * sending reputation does not care who typed the address.
 *
 * Not a membership oracle: the caller holds `newsletter.manage` and can read
 * the whole list already, so the result names what happened. An UNSUBSCRIBED
 * address goes through the Resubscribe rule, so "add" cannot route around it.
 */
export async function adminAddSubscriber(
  actor: { id: string },
  input: { email: string; locale: string },
): Promise<AdminAddSubscriberResult> {
  const existing = await db.newsletterSubscriber.findUnique({
    where: { email: input.email },
    select: RESTORE_SELECT,
  });
  if (existing?.status === SubscriberStatus.ACTIVE) return "already_active";

  let id: string;
  let result: AdminAddSubscriberResult;
  if (existing?.status === SubscriberStatus.UNSUBSCRIBED) {
    id = existing.id;
    result = await restoreOrInvite(existing);
  } else if (existing) {
    // PENDING already: invite again (after the cooldown) in the admin's locale.
    id = existing.id;
    await invite({ ...existing, locale: input.locale }, { source: "admin" });
    result = "invited";
  } else {
    try {
      const created = await db.newsletterSubscriber.create({
        data: {
          email: input.email,
          locale: input.locale,
          source: "admin",
          status: SubscriberStatus.PENDING,
          unsubscribeTokenHash: hashToken(newToken()),
        },
        select: {
          id: true,
          email: true,
          locale: true,
          lastConfirmSentAt: true,
          confirmTokenHash: true,
          confirmExpiresAt: true,
        },
      });
      id = created.id;
      await invite(created);
      result = "invited";
    } catch (error) {
      // Raced a public signup for the same address, whose own confirmation
      // is already on its way.
      if (isUniqueViolation(error)) return "invited";
      throw error;
    }
  }

  await recordAudit({
    userId: actor.id,
    action: "newsletter.add",
    entityType: "NewsletterSubscriber",
    entityId: id,
    changes: { after: { email: input.email, result } },
  });
  return result;
}

/**
 * A HARD erase (ADR-080 #7). An erasure request is not satisfied by a
 * `deletedAt`, so this is the one delete in the repo with no soft path — and
 * the reason `adminUnsubscribe` exists beside it as the reversible action.
 *
 * The audit row records the address, because the trail has to survive the row
 * it describes; that is the trail's job, and it is why the screen confirms.
 */
export async function deleteSubscriber(actor: { id: string }, id: string): Promise<void> {
  const row = await db.newsletterSubscriber.findUnique({
    where: { id },
    select: { email: true, status: true },
  });
  if (!row) return;

  await db.newsletterSubscriber.delete({ where: { id } });
  await recordAudit({
    userId: actor.id,
    action: "newsletter.delete",
    entityType: "NewsletterSubscriber",
    entityId: id,
    changes: { before: { email: row.email, status: row.status } },
  });
}

// ─── Housekeeping ────────────────────────────────────────────

/**
 * Drop PENDING rows older than 7 days (ADR-080 #1).
 *
 * `status: PENDING` is checked as well as the age, so a confirmed row created
 * a year ago is never in range — the filter is "never confirmed", and
 * `createdAt` alone would delete the whole list.
 */
export async function purgeExpiredPending(now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - PENDING_PURGE_DAYS * 86_400_000);
  const { count } = await db.newsletterSubscriber.deleteMany({
    where: { status: SubscriberStatus.PENDING, createdAt: { lt: before } },
  });
  return count;
}

/** Delivery-log retention (ADR-078 #5). 90 days, and never raised. */
export async function purgeEmailDeliveries(now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - DELIVERY_RETENTION_DAYS * 86_400_000);
  const { count } = await db.emailDelivery.deleteMany({ where: { createdAt: { lt: before } } });
  return count;
}

// ─── The subscriber record (changes-45) ──────────────────────

export interface SubscriberDetail extends SubscriberRow {
  unsubscribedVia: string | null;
  lastConfirmSentAt: Date | null;
  updatedAt: Date;
  /** The linked account, if any (ADR-080 #6). Rendered as a link only for a
   * viewer who may open user records; the screen decides that. */
  account: { id: string; name: string } | null;
  /** The newest mail sent TO this address, when the caller asks for it. */
  deliveries: {
    id: string;
    templateKey: string;
    subject: string;
    status: string;
    createdAt: Date;
  }[];
}

/**
 * One subscriber for `/admin/newsletter/[id]`. Null when absent (the screen
 * 404s, security.md #7). `withDeliveries` is the caller's `email.log.view`:
 * the delivery log has its own key, and holding `newsletter.view` does not
 * grant a read of it.
 */
export async function loadSubscriberDetail(
  id: string,
  options: { withDeliveries: boolean },
): Promise<SubscriberDetail | null> {
  const row = await db.newsletterSubscriber.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, deletedAt: true } } },
  });
  if (!row) return null;
  const deliveries = options.withDeliveries
    ? await db.emailDelivery.findMany({
        where: { to: row.email },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, templateKey: true, subject: true, status: true, createdAt: true },
      })
    : [];
  return {
    id: row.id,
    email: row.email,
    locale: row.locale,
    status: row.status,
    source: row.source,
    userId: row.userId,
    confirmedAt: row.confirmedAt,
    unsubscribedAt: row.unsubscribedAt,
    createdAt: row.createdAt,
    unsubscribedVia: row.unsubscribedVia,
    lastConfirmSentAt: row.lastConfirmSentAt,
    updatedAt: row.updatedAt,
    account:
      row.user && row.user.deletedAt === null ? { id: row.user.id, name: row.user.name } : null,
    deliveries,
  };
}
