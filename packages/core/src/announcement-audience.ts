// Who an announcement reaches (ADR-171 #2, #4, #6; changes-54 §4).
//
// One builder produces the SQL for every use — a card's count, the footer's
// unique total, and the snapshot that inserts recipient rows — so the number
// an admin confirms is the number queued. Counting runs in SQL
// (`COUNT(DISTINCT email)`), never by loading rows into Node.
//
// **Dedupe is the database's job as well as this file's.** Learners are
// inserted before subscribers, both with `INSERT IGNORE` against
// `@@unique([campaignId, email])`: the account row wins (its name and
// language), and a bug in the union — or a double-pressed Send — still cannot
// write a second row for one address.
//
// Every value reaches MariaDB as a `?` parameter. The only text interpolated
// into the statements is fixed SQL from this file.
import type { AnnouncementAudience, AnnouncementAudienceKey } from "@repo/contracts";
import { db } from "@repo/db";

/** An announcement's audiences are about the ANNOUNCEMENTS suppression scope. */
const SUPPRESSION_SCOPE = "ANNOUNCEMENTS";

const LEARNER_KEYS: readonly AnnouncementAudienceKey[] = [
  "all_learners",
  "active",
  "verified",
  "inactive",
  "course_learners",
  "custom",
];

interface Fragment {
  sql: string;
  params: unknown[];
}

export interface AudienceContext {
  /**
   * The course being announced: its enrolled learners already have it. Null
   * for a custom email, which is about no course (ADR-172).
   */
  targetCourseId: string | null;
  /** `lastLoginAt` before this (or never) is "inactive". */
  inactiveBefore: Date;
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(", ");
}

/** The eligible-learner base (plan §4): live, unbanned, unsuspended LEARNERS. */
const LEARNER_BASE =
  "u.userType = 'LEARNER' AND u.deletedAt IS NULL AND (u.banned IS NULL OR u.banned = 0)" +
  " AND u.status <> 'SUSPENDED'";

function learnerCondition(
  key: AnnouncementAudienceKey,
  audience: AnnouncementAudience,
  context: AudienceContext,
): Fragment | null {
  switch (key) {
    case "all_learners":
      return { sql: "1 = 1", params: [] };
    case "active":
      return { sql: "u.status = 'ACTIVE'", params: [] };
    case "verified":
      return { sql: "u.emailVerified = 1", params: [] };
    case "inactive":
      return {
        sql: "(u.lastLoginAt IS NULL OR u.lastLoginAt < ?)",
        params: [context.inactiveBefore],
      };
    case "course_learners": {
      const ids = audience.courseIds ?? [];
      if (ids.length === 0) return null;
      return {
        sql: `EXISTS (SELECT 1 FROM course_enrollments e WHERE e.userId = u.id AND e.courseId IN (${placeholders(ids)}))`,
        params: [...ids],
      };
    }
    case "custom": {
      const ids = audience.userIds ?? [];
      if (ids.length === 0) return null;
      return { sql: `u.id IN (${placeholders(ids)})`, params: [...ids] };
    }
    case "subscribers":
    case "staff":
      return null;
  }
}

function suppressionClause(emailExpression: string): string {
  return (
    `NOT EXISTS (SELECT 1 FROM email_suppressions x WHERE x.scope = '${SUPPRESSION_SCOPE}'` +
    ` AND x.email = ${emailExpression})`
  );
}

/**
 * The learner half: one SELECT over `user` whose WHERE is the base AND the OR
 * of the chosen learner cards. Null when no learner card is chosen.
 */
function learnerSelect(
  keys: readonly AnnouncementAudienceKey[],
  audience: AnnouncementAudience,
  context: AudienceContext,
  applySuppression: boolean,
): Fragment | null {
  const conditions = keys
    .filter((key) => LEARNER_KEYS.includes(key))
    .map((key) => learnerCondition(key, audience, context))
    .filter((fragment): fragment is Fragment => fragment !== null);
  if (conditions.length === 0) return null;

  const email = "LOWER(TRIM(u.email))";
  const target = context.targetCourseId;
  const parts = [
    LEARNER_BASE,
    `(${conditions.map((fragment) => fragment.sql).join(" OR ")})`,
    // Enrolled in THIS course already: they have it (plan §4).
    ...(target
      ? [
          "NOT EXISTS (SELECT 1 FROM course_enrollments te WHERE te.userId = u.id AND te.courseId = ?)",
        ]
      : []),
    ...(applySuppression ? [suppressionClause(email)] : []),
  ];
  return {
    sql:
      `SELECT ${email} AS email, u.id AS userId, NULL AS subscriberId,` +
      ` u.name AS name, u.locale AS locale FROM \`user\` u WHERE ${parts.join(" AND ")}`,
    params: [...conditions.flatMap((fragment) => fragment.params), ...(target ? [target] : [])],
  };
}

/**
 * The subscriber half: ACTIVE subscribers only (owner, D1) — an unsubscribed
 * one is never sent to — including those with no account. A subscriber whose
 * address belongs to an account already enrolled in the course is left out
 * for the same reason the account is.
 */
function subscriberSelect(context: AudienceContext, applySuppression: boolean): Fragment {
  const email = "LOWER(TRIM(s.email))";
  const target = context.targetCourseId;
  const parts = [
    "s.status = 'ACTIVE'",
    ...(target
      ? [
          "NOT EXISTS (SELECT 1 FROM `user` tu JOIN course_enrollments te ON te.userId = tu.id" +
            ` WHERE LOWER(TRIM(tu.email)) = ${email} AND te.courseId = ?)`,
        ]
      : []),
    ...(applySuppression ? [suppressionClause(email)] : []),
  ];
  return {
    sql:
      `SELECT ${email} AS email, s.userId AS userId, s.id AS subscriberId,` +
      ` NULL AS name, s.locale AS locale FROM newsletter_subscribers s WHERE ${parts.join(" AND ")}`,
    params: target ? [target] : [],
  };
}

/**
 * The staff half (ADR-172 #5): every live, unbanned, unsuspended STAFF
 * account, for a custom email only — `audiencesForKind` never offers the card
 * to a course announcement, and the save schemas refuse it there.
 */
function staffSelect(applySuppression: boolean): Fragment {
  const email = "LOWER(TRIM(u.email))";
  const parts = [
    "u.userType = 'STAFF' AND u.deletedAt IS NULL AND (u.banned IS NULL OR u.banned = 0)" +
      " AND u.status <> 'SUSPENDED'",
    ...(applySuppression ? [suppressionClause(email)] : []),
  ];
  return {
    sql:
      `SELECT ${email} AS email, u.id AS userId, NULL AS subscriberId,` +
      ` u.name AS name, u.locale AS locale FROM \`user\` u WHERE ${parts.join(" AND ")}`,
    params: [],
  };
}

function selectsFor(
  keys: readonly AnnouncementAudienceKey[],
  audience: AnnouncementAudience,
  context: AudienceContext,
  applySuppression: boolean,
): Fragment[] {
  const selects: Fragment[] = [];
  const learners = learnerSelect(keys, audience, context, applySuppression);
  if (learners) selects.push(learners);
  // Accounts before subscriptions, so an address that is both keeps the
  // ACCOUNT's name and language (ADR-171 #2).
  if (keys.includes("staff")) selects.push(staffSelect(applySuppression));
  if (keys.includes("subscribers")) selects.push(subscriberSelect(context, applySuppression));
  return selects;
}

async function countDistinct(selects: Fragment[]): Promise<number> {
  if (selects.length === 0) return 0;
  const rows = await db.$queryRawUnsafe<{ total: bigint | number }[]>(
    `SELECT COUNT(DISTINCT t.email) AS total FROM (${selects.map((s) => s.sql).join(" UNION ALL ")}) t`,
    ...selects.flatMap((s) => s.params),
  );
  return Number(rows[0]?.total ?? 0);
}

export interface AudienceCounts {
  /** Each chosen card on its own, after suppression. */
  perCard: Partial<Record<AnnouncementAudienceKey, number>>;
  /** What the send would queue: distinct addresses, after suppression. */
  unique: number;
  /** People counted by more than one card, removed by the dedupe. */
  duplicates: number;
  /** Addresses that matched but have unsubscribed (or were suppressed). */
  suppressed: number;
}

/** The Audience step's live numbers (plan §10.3). */
export async function countAudience(
  audience: AnnouncementAudience,
  context: AudienceContext,
): Promise<AudienceCounts> {
  const perCard: Partial<Record<AnnouncementAudienceKey, number>> = {};
  for (const key of audience.keys) {
    perCard[key] = await countDistinct(selectsFor([key], audience, context, true));
  }
  const [unique, unsuppressed] = await Promise.all([
    countDistinct(selectsFor(audience.keys, audience, context, true)),
    countDistinct(selectsFor(audience.keys, audience, context, false)),
  ]);
  const sumOfCards = Object.values(perCard).reduce((total, count) => total + (count ?? 0), 0);
  return {
    perCard,
    unique,
    duplicates: Math.max(0, sumOfCards - unique),
    suppressed: Math.max(0, unsuppressed - unique),
  };
}

/** Every card's count on its own, for the cards the admin has not picked yet. */
export async function countEachCard(
  audience: Pick<AnnouncementAudience, "courseIds" | "userIds">,
  context: AudienceContext,
  keys: readonly AnnouncementAudienceKey[],
): Promise<Partial<Record<AnnouncementAudienceKey, number>>> {
  const counts: Partial<Record<AnnouncementAudienceKey, number>> = {};
  for (const key of keys) {
    counts[key] = await countDistinct(
      selectsFor([key], { keys: [key], ...audience }, context, true),
    );
  }
  return counts;
}

type Executor = Pick<typeof db, "$executeRawUnsafe">;

/**
 * Insert one recipient row per address (ADR-171 #2). Learners first, so an
 * address that is both an account and a subscription keeps the ACCOUNT's name
 * and language. Returns how many rows the campaign now has.
 */
export async function snapshotRecipients(
  client: Executor,
  campaignId: string,
  audience: AnnouncementAudience,
  context: AudienceContext,
): Promise<void> {
  for (const select of selectsFor(audience.keys, audience, context, true)) {
    await client.$executeRawUnsafe(
      "INSERT IGNORE INTO email_campaign_recipients" +
        " (id, campaignId, email, userId, subscriberId, name, locale, status, attempts, runAfter)" +
        " SELECT CONCAT('r', REPLACE(UUID(), '-', '')), ?, t.email, t.userId, t.subscriberId," +
        " LEFT(t.name, 255), LEFT(t.locale, 10), 'PENDING', 0, NOW(3)" +
        ` FROM (${select.sql}) t WHERE t.email <> ''`,
      campaignId,
      ...select.params,
    );
  }
}
