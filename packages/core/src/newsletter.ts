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
import type { NewsletterSource, SubscriberFilter, SubscriberExportFilter } from "@repo/contracts";
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
  source: NewsletterSource;
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
  source: NewsletterSource;
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

  return "confirmed";
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
      // A pending row that unsubscribes drops its confirm token too, so the
      // confirmation link in the inbox cannot resurrect it.
      confirmTokenHash: null,
      confirmExpiresAt: null,
    },
  });
  return "unsubscribed";
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
export async function isNewsletterPlacementEnabled(source: NewsletterSource): Promise<boolean> {
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
