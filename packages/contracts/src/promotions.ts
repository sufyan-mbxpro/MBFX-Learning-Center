// Promotions (ADR-167, changes-52): time-boxed webinars, events, offers, news
// items and announcements shown as a popup on chosen pages and, optionally,
// in the home band.
//
// Two registries live here and nowhere else: the PLACEMENTS a promotion may
// name, and the paths a popup may never cover. Both are code, not admin
// options (ADR-167 #1) — where a slot exists is composition, and ADR-042
// settled that composition is code.
import { z } from "zod";
import { externalUrlSchema } from "./learn.ts";
import { internalPathSchema } from "./videos.ts";

const idSchema = z.string().min(1).max(64);
const localeSchema = z.string().min(2).max(10);

// ─── Vocabulary (mirrors the Prisma enums) ───────────────────

export const PROMOTION_KINDS = ["WEBINAR", "EVENT", "OFFER", "NEWS", "ANNOUNCEMENT"] as const;
export const promotionKindSchema = z.enum(PROMOTION_KINDS);
export type PromotionKindInput = z.infer<typeof promotionKindSchema>;

/** The kinds that carry their own event time (and may carry a recording). */
export const TIMED_PROMOTION_KINDS = [
  "WEBINAR",
  "EVENT",
] as const satisfies readonly PromotionKindInput[];

export const PROMOTION_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const promotionStatusSchema = z.enum(PROMOTION_STATUSES);
export type PromotionStatusInput = z.infer<typeof promotionStatusSchema>;

export const PROMOTION_FREQUENCIES = ["ONCE", "PER_SESSION", "DAILY", "EVERY_VISIT"] as const;
export const promotionFrequencySchema = z.enum(PROMOTION_FREQUENCIES);
export type PromotionFrequencyInput = z.infer<typeof promotionFrequencySchema>;

export const PROMOTION_AUDIENCES = ["ALL", "GUESTS", "LEARNERS"] as const;
export const promotionAudienceSchema = z.enum(PROMOTION_AUDIENCES);
export type PromotionAudienceInput = z.infer<typeof promotionAudienceSchema>;

export const PROMOTION_UNTRANSLATED = ["HIDE", "SHOW_DEFAULT"] as const;
export const promotionUntranslatedSchema = z.enum(PROMOTION_UNTRANSLATED);
export type PromotionUntranslatedInput = z.infer<typeof promotionUntranslatedSchema>;

export const PROMOTION_TARGET_TYPES = [
  "COURSE",
  "LESSON",
  "QUIZ",
  "ARTICLE",
  "VIDEO_TOPIC",
  "GLOSSARY_TERM",
  "TOOL",
] as const;
export const promotionTargetTypeSchema = z.enum(PROMOTION_TARGET_TYPES);
export type PromotionTargetTypeInput = z.infer<typeof promotionTargetTypeSchema>;

// ─── Banner positions (ADR-173) ──────────────────────────────

/**
 * Where a promotion's banner sits. A closed set, like the placements: an admin
 * picks one, never types one. `LEFT` and `RIGHT` render at the inline start
 * and end, so they mirror on a right-to-left page (ADR-173 #3).
 */
export const PROMOTION_BAR_POSITIONS = ["TOP", "BOTTOM", "LEFT", "RIGHT"] as const;
export const promotionBarPositionSchema = z.enum(PROMOTION_BAR_POSITIONS);
export type PromotionBarPositionInput = z.infer<typeof promotionBarPositionSchema>;

// ─── Placements (ADR-167 #1) ─────────────────────────────────

/**
 * Where a promotion may appear. `everywhere` means every public page a popup
 * is allowed on, and is exclusive: naming it beside another placement says
 * nothing more and reads as though it did.
 *
 * Adding a placement is an entry here, a rule in `placementsForPath`, and an
 * `admin.promotions.placements.*` catalog key.
 */
export const PROMOTION_PLACEMENTS = [
  "home",
  "learn",
  "news",
  "glossary",
  "tools",
  "support",
  "everywhere",
] as const;
export const promotionPlacementSchema = z.enum(PROMOTION_PLACEMENTS);
export type PromotionPlacement = z.infer<typeof promotionPlacementSchema>;

/**
 * The only placements the home BAND reads. The band exists on the home page
 * alone in v1 (changes-52 §4), so `showInBand` on a promotion placed nowhere
 * near home would be a switch that does nothing — code-style.md #28.
 */
export const HOME_BAND_PLACEMENTS = [
  "home",
  "everywhere",
] as const satisfies readonly PromotionPlacement[];

/**
 * Paths a popup never covers, whatever a promotion says. A popup over a
 * password form, a legal document, a newsletter confirmation, a staff preview
 * or a quiz mid-attempt is always wrong, so this is not an admin option.
 * Locale-less, matched by whole segments (`/news` does not cover
 * `/newsletter`).
 */
export const PROMOTION_EXCLUDED_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/newsletter",
  "/legal",
  "/news/preview",
  "/keystone",
  "/admin",
  "/api",
] as const;

/** `/learn/{track}/quizzes/{quiz}` — the runner, where an attempt happens. */
const QUIZ_RUNNER = /^\/learn\/[^/]+\/quizzes\/[^/]+$/;
/** `/learn/{track}/glossary` — a track's view onto the glossary. */
const TRACK_GLOSSARY = /^\/learn\/[^/]+\/glossary$/;

function normalizePath(pathname: string): string {
  const bare = pathname.split(/[?#]/, 1)[0] ?? "";
  const trimmed = bare.length > 1 ? bare.replace(/\/+$/, "") : bare;
  return trimmed === "" ? "/" : trimmed;
}

/** True when `path` is `prefix` or lies under it, by whole segments. */
function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isPromotionExcludedPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return PROMOTION_EXCLUDED_PATHS.some((prefix) => under(path, prefix)) || QUIZ_RUNNER.test(path);
}

/**
 * The placements a LOCALE-LESS public path belongs to, in registry order.
 * An excluded path belongs to none — not even `everywhere`. Every other path
 * belongs to `everywhere` plus whichever sections it sits in.
 */
export function placementsForPath(pathname: string): PromotionPlacement[] {
  const path = normalizePath(pathname);
  if (isPromotionExcludedPath(path)) return [];

  const matched = new Set<PromotionPlacement>(["everywhere"]);
  if (path === "/") matched.add("home");
  if (under(path, "/learn")) matched.add("learn");
  if (under(path, "/news") || under(path, "/analysis")) matched.add("news");
  if (under(path, "/glossary") || TRACK_GLOSSARY.test(path)) matched.add("glossary");
  if (under(path, "/tools") || under(path, "/economic-calendar")) matched.add("tools");
  if (under(path, "/support")) matched.add("support");

  return PROMOTION_PLACEMENTS.filter((placement) => matched.has(placement));
}

/** Does a promotion placed at `placements` appear on `pathname`? */
export function promotionShowsOnPath(
  placements: readonly PromotionPlacement[],
  pathname: string,
): boolean {
  const here = placementsForPath(pathname);
  return placements.some((placement) => here.includes(placement));
}

export const promotionPlacementsSchema = z
  .array(promotionPlacementSchema)
  .min(1, "choose at least one placement")
  .max(PROMOTION_PLACEMENTS.length)
  .refine((list) => new Set(list).size === list.length, {
    message: "a placement is listed twice",
  })
  .refine((list) => !list.includes("everywhere") || list.length === 1, {
    message: "everywhere cannot be combined with another placement",
  });

// ─── Link (ADR-167 #4) ───────────────────────────────────────

/**
 * Exactly one destination, as a discriminated union: which branch is present
 * IS the link kind, so a stored `linkKind` and a stray `targetUrl` beside a
 * CONTENT link cannot disagree. `NONE` is a standalone notice.
 */
export const promotionLinkSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("CONTENT"),
    targetType: promotionTargetTypeSchema,
    targetId: idSchema,
  }),
  z.object({ kind: z.literal("PATH"), path: internalPathSchema }),
  z.object({ kind: z.literal("EXTERNAL"), url: externalUrlSchema }),
  z.object({ kind: z.literal("NONE") }),
]);
export type PromotionLinkInput = z.infer<typeof promotionLinkSchema>;

// ─── Words (one locale) ──────────────────────────────────────

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/**
 * One locale's words. Every field is optional here because a promotion LINKED
 * to site content borrows the target's title; the save schema below requires
 * a title when there is nothing to borrow from.
 *
 * `body` is rich text and is sanitized server-side on save (security.md #8).
 */
export const promotionTranslationSchema = z.object({
  locale: localeSchema,
  title: optionalText(160),
  body: optionalText(5000),
  badge: optionalText(40),
  ctaLabel: optionalText(60),
  imageAlt: optionalText(250),
});
export type PromotionTranslationInput = z.infer<typeof promotionTranslationSchema>;

// ─── Save ────────────────────────────────────────────────────

export const PROMOTION_MAX_PRIORITY = 1000;
export const PROMOTION_MAX_DELAY_SECONDS = 60;

export const promotionSaveSchema = z
  .object({
    /** Absent on create. */
    id: idSchema.optional(),
    kind: promotionKindSchema,
    placements: promotionPlacementsSchema,
    showAsPopup: z.boolean(),
    showInBand: z.boolean(),
    showAsBar: z.boolean(),
    barPosition: promotionBarPositionSchema,
    priority: z.int().min(0).max(PROMOTION_MAX_PRIORITY),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    eventStartsAt: z.coerce.date().nullable().optional(),
    eventEndsAt: z.coerce.date().nullable().optional(),
    frequency: promotionFrequencySchema,
    delaySeconds: z.int().min(0).max(PROMOTION_MAX_DELAY_SECONDS),
    audience: promotionAudienceSchema,
    untranslated: promotionUntranslatedSchema,
    imageAssetId: idSchema.nullable().optional(),
    link: promotionLinkSchema,
    recordingTopicId: idSchema.nullable().optional(),
    /** The default locale's words; other locales save through their own tab. */
    translation: promotionTranslationSchema,
  })
  .superRefine((value, ctx) => {
    if (value.endsAt.getTime() <= value.startsAt.getTime()) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "must be after the start" });
    }

    if (!value.showAsPopup && !value.showInBand && !value.showAsBar) {
      ctx.addIssue({
        code: "custom",
        path: ["showAsPopup"],
        message: "show it as a popup, in the home band, as a banner, or any of them",
      });
    }

    if (
      value.showInBand &&
      !value.placements.some((p) => (HOME_BAND_PLACEMENTS as readonly string[]).includes(p))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["showInBand"],
        message: "the band is on the home page, so the placements must include home",
      });
    }

    const timed = (TIMED_PROMOTION_KINDS as readonly string[]).includes(value.kind);
    if (value.eventStartsAt || value.eventEndsAt || value.recordingTopicId) {
      if (!timed) {
        ctx.addIssue({
          code: "custom",
          path: ["eventStartsAt"],
          message: "only a webinar or an event has its own time",
        });
      }
    }
    if (value.eventEndsAt && !value.eventStartsAt) {
      ctx.addIssue({ code: "custom", path: ["eventStartsAt"], message: "required with an end" });
    }
    if (
      value.eventStartsAt &&
      value.eventEndsAt &&
      value.eventEndsAt.getTime() <= value.eventStartsAt.getTime()
    ) {
      ctx.addIssue({ code: "custom", path: ["eventEndsAt"], message: "must be after the start" });
    }
    // The END, not just the start (changes-52 P5): the recording replaces the
    // button once the event has ended, and an event with no end never has.
    if (value.recordingTopicId && !value.eventEndsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["recordingTopicId"],
        message: "a recording needs the event's end, to know when it has ended",
      });
    }

    // A standalone promotion has nothing to borrow a title from.
    if (value.link.kind !== "CONTENT" && !value.translation.title) {
      ctx.addIssue({
        code: "custom",
        path: ["translation", "title"],
        message: "required unless the promotion links to site content",
      });
    }
    // A button with no destination is a button that does nothing.
    if (value.link.kind === "NONE" && value.translation.ctaLabel) {
      ctx.addIssue({
        code: "custom",
        path: ["translation", "ctaLabel"],
        message: "a button label needs a link",
      });
    }
  });
export type PromotionSaveInput = z.infer<typeof promotionSaveSchema>;

/** One non-default locale's words, saved from its own tab (ADR-164). */
export const promotionTranslationSaveSchema = promotionTranslationSchema.extend({
  promotionId: idSchema,
  /** A "Translate with Google" prefill nobody has edited since (changes-52 P6). */
  machineTranslated: z.boolean().optional(),
});
export type PromotionTranslationSaveInput = z.infer<typeof promotionTranslationSaveSchema>;

export const promotionStatusChangeSchema = z.object({
  id: idSchema,
  status: promotionStatusSchema,
});
export type PromotionStatusChangeInput = z.infer<typeof promotionStatusChangeSchema>;

// ─── Derived status (ADR-167 #2) ─────────────────────────────

/**
 * What an admin sees in the list. Only DRAFT and ARCHIVED are stored as
 * such; an ACTIVE row is Scheduled, Live or Ended by the clock. The window is
 * `startsAt` inclusive, `endsAt` exclusive — the same bounds the public read
 * uses, so the list and the site cannot disagree about a boundary instant.
 */
export type PromotionPhase = "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED" | "ARCHIVED";

export function promotionPhase(
  row: { status: PromotionStatusInput; startsAt: Date; endsAt: Date },
  now: Date,
): PromotionPhase {
  if (row.status !== "ACTIVE") return row.status;
  const t = now.getTime();
  if (t < row.startsAt.getTime()) return "SCHEDULED";
  if (t >= row.endsAt.getTime()) return "ENDED";
  return "LIVE";
}

// ─── How often a visitor sees it (ADR-167, changes-52 §7.2) ──

/** What the popup host remembers about one promotion, in this browser. */
export interface PromotionSeen {
  /** Epoch ms of the last time it was SHOWN (localStorage), or null. */
  lastShownAt: number | null;
  /** Shown already in this browsing session (sessionStorage). */
  inThisSession: boolean;
}

/**
 * The storage key for one promotion's "seen" record. The VERSION is part of
 * it: an edited promotion is news again, so a visitor who dismissed version 3
 * sees version 4. Old keys are simply never read again.
 */
export function promotionSeenKey(id: string, version: number): string {
  return `promo:seen:${id}:v${version}`;
}

/**
 * The storage key for a BANNER's "closed" record (ADR-173 #5). Separate from
 * the popup's, so closing the banner never hides the popup, nor the reverse.
 */
export function promotionBarSeenKey(id: string, version: number): string {
  return `promo:bar:${id}:v${version}`;
}

/** Same calendar day in the READER's time zone — "once a day" is their day. */
function sameLocalDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

/**
 * Should the popup open for this promotion now? The banner asks the same
 * question with `seen` recording when it was CLOSED (ADR-173 #5), so the
 * frequency says when a closed banner comes back. Pure, so the rule is tested
 * here rather than through a browser, and a future native app reuses it.
 * "Shown" is recorded when the popup OPENS, not when it is dismissed: a
 * visitor who navigates away mid-popup has still seen it.
 */
export function shouldShowPromotion(
  frequency: PromotionFrequencyInput,
  seen: PromotionSeen,
  now: Date,
): boolean {
  switch (frequency) {
    case "ONCE":
      return seen.lastShownAt === null;
    case "PER_SESSION":
      return !seen.inThisSession;
    case "DAILY":
      return seen.lastShownAt === null || !sameLocalDay(seen.lastShownAt, now.getTime());
    case "EVERY_VISIT":
      return true;
  }
}

/** Does the promotion's audience include this reader? `null` = session unknown yet. */
export function promotionAudienceIncludes(
  audience: PromotionAudienceInput,
  signedIn: boolean | null,
): boolean {
  if (audience === "ALL") return true;
  // Unknown is NOT a guess: a guest-only offer must not flash at a learner
  // while their session loads, nor the reverse.
  if (signedIn === null) return false;
  return audience === "LEARNERS" ? signedIn : !signedIn;
}

// ─── A timed promotion's own clock (changes-52 P5) ───────────

/**
 * Where a webinar or event stands against its OWN time — not the display
 * window, which opens a week earlier and may close a day later.
 *
 * `UPCOMING` counts down and offers "Add to calendar"; `LIVE` says so;
 * `ENDED` hands over to the recording when there is one. An event with no end
 * never reaches `ENDED` (the save schema refuses a recording without one).
 * `null` means the promotion has no event time at all.
 */
export type PromotionEventPhase = "UPCOMING" | "LIVE" | "ENDED";

export function promotionEventPhase(
  event: { eventStartsAt: Date | string | null; eventEndsAt: Date | string | null },
  now: Date,
): PromotionEventPhase | null {
  if (!event.eventStartsAt) return null;
  const t = now.getTime();
  if (t < new Date(event.eventStartsAt).getTime()) return "UPCOMING";
  if (event.eventEndsAt && t >= new Date(event.eventEndsAt).getTime()) return "ENDED";
  return "LIVE";
}

/**
 * "Starts in 2 d 4 h" as numbers, two units at most, so the words stay in the
 * catalog. Rounded DOWN to the minute: a countdown that says "0 min" a minute
 * early reads as late, and one that rounds up promises a start that has not
 * come. Under a minute is `{ minutes: 0 }` — the caller says "starting now".
 */
export type PromotionCountdown =
  | { unit: "days"; days: number; hours: number }
  | { unit: "hours"; hours: number; minutes: number }
  | { unit: "minutes"; minutes: number };

export function promotionCountdown(until: Date | string, now: Date): PromotionCountdown | null {
  const ms = new Date(until).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return { unit: "days", days, hours };
  if (hours > 0) return { unit: "hours", hours, minutes };
  return { unit: "minutes", minutes };
}

/** The public "Add to calendar" address — one place, so the card and the route agree. */
export function promotionCalendarPath(id: string, locale: string): string {
  return `/api/promotions/${encodeURIComponent(id)}/calendar.ics?locale=${encodeURIComponent(locale)}`;
}

/** `GET /api/promotions/[id]/calendar.ics` — the id from the path, the words' language from the query. */
export const promotionCalendarQuerySchema = z.object({
  id: idSchema,
  locale: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$/, "must be a locale code"),
});

/**
 * `GET /api/promotions` — the popup's one read. Locale only, never the path:
 * one URL per language is what a shared cache can hold, and the client files
 * the result by path itself (`promotionShowsOnPath`).
 */
export const publicPromotionsQuerySchema = z.object({
  locale: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$/, "must be a locale code"),
});

// ─── Counters (ADR-170, changes-52 P7) ───────────────────────

export const PROMOTION_SURFACES = ["POPUP", "BAND", "BAR"] as const;
export const promotionSurfaceSchema = z.enum(PROMOTION_SURFACES);
export type PromotionSurfaceInput = z.infer<typeof promotionSurfaceSchema>;

export const PROMOTION_EVENT_TYPES = ["IMPRESSION", "CLICK", "DISMISS"] as const;
export const promotionEventTypeSchema = z.enum(PROMOTION_EVENT_TYPES);
export type PromotionEventType = z.infer<typeof promotionEventTypeSchema>;

/** Most events one report may carry: a three-promotion dialog seen, then closed. */
export const PROMOTION_EVENTS_MAX = 6;

/** Where the popup, the band and the banner report. One place, so the client and the route agree. */
export const PROMOTION_EVENTS_PATH = "/api/promotions/events";

export const promotionEventSchema = z
  .object({
    id: idSchema,
    surface: promotionSurfaceSchema,
    type: promotionEventTypeSchema,
  })
  // The band has no dismiss control, so a band dismissal is a forged report.
  .refine((event) => event.type !== "DISMISS" || event.surface !== "BAND", {
    message: "only the popup and the banner can be dismissed",
    path: ["type"],
  });
export type PromotionEvent = z.infer<typeof promotionEventSchema>;

/** `POST /api/promotions/events` (ADR-170 #3). */
export const promotionEventsSchema = z.object({
  locale: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$/, "must be a locale code"),
  events: z.array(promotionEventSchema).min(1).max(PROMOTION_EVENTS_MAX),
});
export type PromotionEventsInput = z.infer<typeof promotionEventsSchema>;

/** Which surfaces a live promotion uses — all the counters need to know about it. */
export interface PromotionSurfaceFlags {
  id: string;
  showAsPopup: boolean;
  showInBand: boolean;
  showAsBar: boolean;
}

function usesSurface(promotion: PromotionSurfaceFlags, surface: PromotionSurfaceInput): boolean {
  switch (surface) {
    case "POPUP":
      return promotion.showAsPopup;
    case "BAND":
      return promotion.showInBand;
    case "BAR":
      return promotion.showAsBar;
  }
}

/**
 * ADR-170 #3.1: keep only events for a promotion that is LIVE, on a surface
 * it actually uses, once each. `live` is the cached public list the popup
 * itself read, so a draft, an ended promotion or an invented id can never
 * gain a counter row. Pure, so the rule is tested without a database.
 */
export function acceptedPromotionEvents(
  events: readonly PromotionEvent[],
  live: readonly PromotionSurfaceFlags[],
): PromotionEvent[] {
  const byId = new Map(live.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const accepted: PromotionEvent[] = [];
  for (const event of events) {
    const promotion = byId.get(event.id);
    if (!promotion) continue;
    if (!usesSurface(promotion, event.surface)) continue;
    const key = `${event.id}:${event.surface}:${event.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push(event);
  }
  return accepted;
}

/** Clicks as a share of impressions, 0–100 with one decimal; null with no impressions. */
export function promotionClickRate(impressions: number, clicks: number): number | null {
  if (impressions <= 0) return null;
  return Math.round((Math.min(clicks, impressions) / impressions) * 1000) / 10;
}
