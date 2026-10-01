// Seed email campaigns (ADR-171, ADR-172).
//
// People → Email campaigns shipped with an empty table, so a fresh install had
// nothing to open in the course announcement editor or the custom email
// editor, and every status tab said "No campaigns". These five cover what the
// screen can show between them:
//
//   * a COURSE announcement DRAFT for each seeded course — the template's own
//     subject (`subject: null`), an optional note, an audience to edit;
//   * a CUSTOM email DRAFT with its words in `EmailCampaignContent`, aimed at
//     subscribers and active learners;
//   * outside production only, a SENT custom email and a CANCELLED course
//     announcement, so the Sent and Cancelled tabs and the counters render.
//
// Rules this file follows, and the reasons:
//
//   * **Nothing here can send.** A seeded campaign is DRAFT, SENT or
//     CANCELLED — never SCHEDULED or SENDING, which `POST
//     /api/cron/announcements` would pick up and mail to every real address in
//     the audience. No `EmailCampaignRecipient` row is written, so there is
//     nothing PENDING for a runner to claim either.
//   * **History is old enough to have no recipients.** The SENT campaign is
//     dated past the 90-day recipient purge, which is exactly the state where
//     only its aggregates survive (schema comment on `recipientCount`).
//     Inventing per-address rows would mean inventing addresses.
//   * **No history in production.** `scripts/deploy.sh` seeds production, and
//     a "Sent to 1,284" row there would be a fabricated record of mail that
//     never went out. Drafts are seeded everywhere: they are starting points.
//   * **A custom draft is NOT marked tested.** `lastTestedAt`/`testedHash`
//     stay null, so ADR-172 #2's "send a test since the last edit" rule
//     applies to it exactly as to an admin's own draft.
//   * **Only the custom-email variables** (`CUSTOM_EMAIL_VARIABLES`): the
//     globals and `unsubscribe.url`. RICH mode, so the shell supplies the
//     logo, the footer and the unsubscribe link.
//   * **The facts stay true.** No copy names a date, a price or a person.
//   * **`create`-only, keyed on a fixed id.** Re-seeding adds what is missing
//     and never touches a campaign an admin has since edited or sent. One an
//     admin DELETED comes back on the next run — the promotions seed's trade.
import type { PrismaClient } from "../src/generated/client/client.ts";

const DAY = 24 * 60 * 60 * 1000;

interface SeedCampaignWords {
  subject: string;
  preheader: string;
  /** Already in the sanitizer's allowed shape. */
  bodyHtml: string;
}

interface SeedCampaignBase {
  id: string;
  name: string;
  audience: { keys: string[]; courseIds?: string[] };
  /** Seeded only outside production — see the file. */
  historyOnly?: boolean;
}

interface SeedCourseCampaign extends SeedCampaignBase {
  kind: "COURSE";
  courseSlug: string;
  message: string | null;
  status: "DRAFT" | "CANCELLED";
}

interface SeedCustomCampaign extends SeedCampaignBase {
  kind: "CUSTOM";
  status: "DRAFT" | "SENT";
  words: SeedCampaignWords;
  /** SENT only: the aggregates that outlive the recipient purge. */
  sent?: { daysAgo: number; recipients: number; failed: number; skipped: number };
}

type SeedCampaign = SeedCourseCampaign | SeedCustomCampaign;

export const SEED_EMAIL_CAMPAIGNS: SeedCampaign[] = [
  {
    id: "seed-campaign-forex-fundamentals",
    kind: "COURSE",
    courseSlug: "forex-fundamentals",
    name: "Forex Fundamentals — launch",
    status: "DRAFT",
    audience: { keys: ["all_learners", "subscribers"] },
    message:
      "Short lessons, from what a pip is to sizing a trade so one loss never costs more than 1% of your account.",
  },
  {
    id: "seed-campaign-crypto-foundations",
    kind: "COURSE",
    courseSlug: "crypto-foundations",
    name: "Crypto Foundations — launch",
    status: "DRAFT",
    audience: { keys: ["active", "subscribers"] },
    message: null,
  },
  {
    id: "seed-campaign-clocks-change",
    kind: "CUSTOM",
    name: "Clocks change — session times",
    status: "DRAFT",
    audience: { keys: ["subscribers", "active"] },
    words: {
      subject: "Forex session times shift by an hour",
      preheader: "Europe and the US change their clocks a week apart.",
      bodyHtml:
        "<p>Hello {{recipient.name}},</p>" +
        "<h2>The clocks are changing</h2>" +
        "<p>Europe ends summer time on the last Sunday of October and the US a week later, on the first Sunday of November. For that week London is four hours ahead of New York instead of five, so the London–New York overlap starts an hour earlier on a London clock.</p>" +
        "<p>Crypto trades around the clock and does not close, but your platform's daily candle and swap times may move — check your broker's server time.</p>" +
        '<p><strong><a href="{{site.url}}/tools/market-hours">See the sessions in your own time zone</a></strong></p>' +
        "<p>Thank you for learning with {{site.name}}.</p>",
    },
  },
  {
    id: "seed-campaign-welcome-tools",
    kind: "CUSTOM",
    name: "New: trading calculators",
    status: "SENT",
    historyOnly: true,
    audience: { keys: ["all_learners"] },
    sent: { daysAgo: 120, recipients: 1284, failed: 6, skipped: 11 },
    words: {
      subject: "Free trading calculators, no sign-up needed",
      preheader: "Pip value, position size, margin and more.",
      bodyHtml:
        "<p>Hello {{recipient.name}},</p>" +
        "<h2>Do the maths before the trade</h2>" +
        "<p>The tools section now has calculators for pip value, position size, margin, profit and loss, and risk to reward. Each one explains what it works out and how to use it.</p>" +
        '<p><strong><a href="{{site.url}}/tools">Open the tools</a></strong></p>',
    },
  },
  {
    id: "seed-campaign-crypto-cancelled",
    kind: "COURSE",
    courseSlug: "crypto-foundations",
    name: "Crypto Foundations — early access (cancelled)",
    status: "CANCELLED",
    historyOnly: true,
    audience: { keys: ["verified"] },
    message: null,
  },
];

async function courseIdBySlug(db: PrismaClient, slug: string): Promise<string | null> {
  const row = await db.courseTranslation.findFirst({
    where: { locale: "en", slug },
    select: { courseId: true },
  });
  return row?.courseId ?? null;
}

/** Returns how many campaigns were created on this run. */
export async function seedEmailCampaigns(
  db: PrismaClient,
  options: { adminId?: string | null; now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const production = process.env.NODE_ENV === "production";
  // `createdById` has no FK; "seed" is the email designs' convention.
  const authorId = options.adminId ?? "seed";
  let created = 0;

  for (const campaign of SEED_EMAIL_CAMPAIGNS) {
    if (campaign.historyOnly && production) continue;
    const found = await db.emailCampaign.findUnique({
      where: { id: campaign.id },
      select: { id: true },
    });
    if (found) continue;

    if (campaign.kind === "COURSE") {
      // A course announcement about a course that is not there would fail
      // validation the moment an admin opened it.
      const courseId = await courseIdBySlug(db, campaign.courseSlug);
      if (!courseId) continue;
      const cancelledAt = campaign.status === "CANCELLED" ? new Date(now.getTime() - 30 * DAY) : null;
      await db.emailCampaign.create({
        data: {
          id: campaign.id,
          kind: "COURSE",
          targetId: courseId,
          name: campaign.name,
          subject: null,
          message: campaign.message,
          audience: campaign.audience,
          status: campaign.status,
          createdById: authorId,
          ...(cancelledAt ? { cancelledById: authorId, finishedAt: cancelledAt } : {}),
        },
      });
    } else {
      const sent = campaign.status === "SENT" ? campaign.sent : undefined;
      const finishedAt = sent ? new Date(now.getTime() - sent.daysAgo * DAY) : null;
      await db.emailCampaign.create({
        data: {
          id: campaign.id,
          kind: "CUSTOM",
          name: campaign.name,
          audience: campaign.audience,
          status: campaign.status,
          createdById: authorId,
          designId: "design_plain_message",
          ...(sent && finishedAt
            ? {
                sentById: authorId,
                snapshotAt: new Date(finishedAt.getTime() - 20 * 60 * 1000),
                startedAt: new Date(finishedAt.getTime() - 20 * 60 * 1000),
                finishedAt,
                recipientCount: sent.recipients,
                sentCount: sent.recipients - sent.failed - sent.skipped,
                failedCount: sent.failed,
                skippedCount: sent.skipped,
                // It went out, so it was tested; the hash is irrelevant once
                // the words are frozen, and only a DRAFT is ever compared.
                lastTestedAt: new Date(finishedAt.getTime() - DAY),
              }
            : {}),
          contents: {
            create: {
              locale: "en",
              subject: campaign.words.subject,
              preheader: campaign.words.preheader || null,
              mode: "RICH",
              bodyHtml: campaign.words.bodyHtml,
            },
          },
        },
      });
    }
    created += 1;
  }
  return created;
}
