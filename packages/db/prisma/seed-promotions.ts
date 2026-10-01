// Seed promotions (changes-57).
//
// The promotions module (ADR-167, ADR-173) shipped with an empty table, so a
// fresh install showed no popup, no home band and no banner, and nothing to
// open in the editor. These three cover what the module can do between them:
//
//   * a WEBINAR with its own event time — popup + home band, a PATH link;
//   * an OFFER linked to site CONTENT (the seeded crypto course) — home band
//     + a bottom banner, shown everywhere;
//   * an ANNOUNCEMENT on a side banner (inline end, so it mirrors under RTL),
//     a PATH link into a tool, shown once.
//
// Rules this file follows, and the reasons:
//
//   * **The facts are real and stay true.** The jobs report really is
//     published by the US Bureau of Labor Statistics at 8:30 a.m. New York
//     time, usually on the first Friday of the month; Europe really does end
//     summer time on the last Sunday of October and the US on the first
//     Sunday of November. No copy names a date, a price or a person, so a
//     database seeded next year says nothing false. Every figure is an
//     example ("on a $10,000 account").
//   * **The webinar promises nothing it cannot keep.** There is no sign-up
//     flow, so its button opens the economic calendar rather than claiming to
//     book a seat.
//   * **ACTIVE outside production, DRAFT in it.** `scripts/deploy.sh` seeds
//     production, and an ACTIVE promotion is a popup in front of real
//     visitors. A DRAFT is one click from live for whoever wants it.
//   * **No pictures here.** This seed writes rows, never bytes — the article
//     corpus's rule. `pnpm seed:live` attaches the committed photographs
//     (`packages/core/seed-live/media/`) to each of these ids through
//     `storeMedia()` and `savePromotion`, so the upload is sniffed and capped
//     and the `ContentReference` is written exactly as an admin's save writes
//     it (`DEMO_PROMOTION_IMAGES` in `seed-live/content.ts`).
//   * **`create`-only, keyed on a fixed id.** Re-seeding adds what is missing
//     and never touches a promotion an admin has since edited.
import type { PrismaClient } from "../src/generated/client/client.ts";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

interface SeedPromotionWords {
  title: string;
  /** Short rich text — already in the sanitizer's allowed shape. */
  body: string;
  badge: string;
  ctaLabel: string;
}

type SeedLink =
  | { kind: "PATH"; path: string }
  /** Resolved at seed time; a missing course falls back to `fallbackPath`. */
  | { kind: "COURSE"; slug: string; fallbackPath: string };

interface SeedPromotion {
  id: string;
  kind: "WEBINAR" | "OFFER" | "ANNOUNCEMENT";
  placements: string[];
  showAsPopup: boolean;
  showInBand: boolean;
  showAsBar: boolean;
  barPosition: "TOP" | "BOTTOM" | "LEFT" | "RIGHT";
  priority: number;
  frequency: "ONCE" | "PER_SESSION" | "DAILY" | "EVERY_VISIT";
  delaySeconds: number;
  /** Display window, relative to the seed run. */
  startsInDays: number;
  endsInDays: number;
  /** WEBINAR / EVENT only: the event's own time, relative to the seed run. */
  event?: { inDays: number; atUtcHour: number; minutes: number };
  link: SeedLink;
  words: SeedPromotionWords;
}

export const SEED_PROMOTIONS: SeedPromotion[] = [
  // ── Forex: a webinar on the US jobs report ────────────────
  {
    id: "seed-promo-nfp-webinar",
    kind: "WEBINAR",
    placements: ["home", "learn", "news"],
    showAsPopup: true,
    showInBand: true,
    showAsBar: false,
    barPosition: "BOTTOM",
    priority: 300,
    frequency: "PER_SESSION",
    delaySeconds: 6,
    startsInDays: -1,
    endsInDays: 10,
    event: { inDays: 9, atUtcHour: 14, minutes: 60 },
    link: { kind: "PATH", path: "/economic-calendar" },
    words: {
      title: "Live webinar: trading the US jobs report (NFP)",
      badge: "Free · 60 minutes",
      ctaLabel: "Check release times",
      body: [
        "<p>Non-Farm Payrolls is published by the US Bureau of Labor Statistics at 8:30 a.m. New York time, usually on the first Friday of the month — and EUR/USD, USD/JPY and gold can travel further in the first minute than in the hour before it.</p>",
        "<ul>",
        "<li>What the headline number, the unemployment rate and average hourly earnings each tell you</li>",
        "<li>Why spreads widen and stops slip in the seconds around the release</li>",
        "<li>Sizing a trade so a 50-pip spike costs no more than 1% of a $10,000 account</li>",
        "</ul>",
      ].join(""),
    },
  },

  // ── Crypto: the free foundations course ───────────────────
  {
    id: "seed-promo-crypto-foundations",
    kind: "OFFER",
    placements: ["everywhere"],
    showAsPopup: false,
    showInBand: true,
    showAsBar: true,
    barPosition: "BOTTOM",
    priority: 200,
    frequency: "DAILY",
    delaySeconds: 4,
    startsInDays: -1,
    endsInDays: 45,
    link: { kind: "COURSE", slug: "crypto-foundations", fallbackPath: "/learn/crypto" },
    words: {
      title: "Free course: understand Bitcoin and Ethereum before you trade them",
      badge: "Free course",
      ctaLabel: "Start the course",
      body: [
        "<p>Crypto Foundations explains what you are actually holding, with no jargon left undefined.</p>",
        "<ul>",
        "<li>What a blockchain records, and what it cannot tell you</li>",
        "<li>Wallets, private keys and custody: who really controls a balance</li>",
        "<li>Why the same coin shows different prices on different exchanges</li>",
        "<li>Sizing a position in a market that trades 24/7 and can move 10% in a day</li>",
        "</ul>",
      ].join(""),
    },
  },

  // ── Forex + crypto: the clocks change ─────────────────────
  {
    id: "seed-promo-dst-session-shift",
    kind: "ANNOUNCEMENT",
    placements: ["tools", "news", "learn"],
    showAsPopup: false,
    showInBand: false,
    showAsBar: true,
    barPosition: "RIGHT",
    priority: 150,
    frequency: "ONCE",
    delaySeconds: 3,
    startsInDays: -1,
    endsInDays: 40,
    link: { kind: "PATH", path: "/tools/market-hours" },
    words: {
      title: "Clocks go back: forex session times shift by an hour",
      badge: "Schedule change",
      ctaLabel: "See sessions in your time",
      body: [
        "<p>Europe ends summer time on the last Sunday of October and the US a week later, on the first Sunday of November. For that week London is four hours ahead of New York instead of five, so the London–New York overlap starts an hour earlier on a London clock.</p>",
        "<p>Once both have changed, the London and New York sessions open an hour later in UTC. Crypto trades around the clock and does not close, but your platform's daily candle and swap times may move — check your broker's server time.</p>",
      ].join(""),
    },
  },
];

async function resolveLink(db: PrismaClient, link: SeedLink) {
  if (link.kind === "PATH") return { linkKind: "PATH" as const, targetPath: link.path };
  const course = await db.courseTranslation.findFirst({
    where: { locale: "en", slug: link.slug },
    select: { courseId: true },
  });
  return course
    ? { linkKind: "CONTENT" as const, targetType: "COURSE" as const, targetId: course.courseId }
    : { linkKind: "PATH" as const, targetPath: link.fallbackPath };
}

/** Returns how many promotions were created on this run. */
export async function seedPromotions(
  db: PrismaClient,
  options: { adminId?: string | null; now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const status = process.env.NODE_ENV === "production" ? "DRAFT" : "ACTIVE";
  let created = 0;

  for (const promo of SEED_PROMOTIONS) {
    const found = await db.promotion.findUnique({ where: { id: promo.id }, select: { id: true } });
    if (found) continue;

    const link = await resolveLink(db, promo.link);

    let eventStartsAt: Date | null = null;
    let eventEndsAt: Date | null = null;
    if (promo.event) {
      const day = new Date(now.getTime() + promo.event.inDays * DAY);
      day.setUTCHours(promo.event.atUtcHour, 0, 0, 0);
      eventStartsAt = day;
      eventEndsAt = new Date(day.getTime() + promo.event.minutes * 60 * 1000);
    }
    const startsAt = new Date(now.getTime() + promo.startsInDays * DAY);
    // A timed promotion stays up two hours past its event, never less.
    const windowEnd = new Date(now.getTime() + promo.endsInDays * DAY);
    const endsAt =
      eventEndsAt && windowEnd.getTime() < eventEndsAt.getTime() + 2 * HOUR
        ? new Date(eventEndsAt.getTime() + 2 * HOUR)
        : windowEnd;

    await db.promotion.create({
      data: {
        id: promo.id,
        kind: promo.kind,
        status,
        placements: promo.placements,
        showAsPopup: promo.showAsPopup,
        showInBand: promo.showInBand,
        showAsBar: promo.showAsBar,
        barPosition: promo.barPosition,
        priority: promo.priority,
        startsAt,
        endsAt,
        eventStartsAt,
        eventEndsAt,
        frequency: promo.frequency,
        delaySeconds: promo.delaySeconds,
        audience: "ALL",
        untranslated: "HIDE",
        ...link,
        createdById: options.adminId ?? null,
        updatedById: options.adminId ?? null,
        translations: {
          create: {
            locale: "en",
            title: promo.words.title,
            body: promo.words.body,
            badge: promo.words.badge,
            ctaLabel: promo.words.ctaLabel,
            translationStatus: "TRANSLATED",
            translatedBy: options.adminId ?? null,
          },
        },
      },
    });
    created += 1;
  }
  return created;
}
