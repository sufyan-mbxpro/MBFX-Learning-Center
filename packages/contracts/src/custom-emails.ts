// Custom and direct emails (ADR-172, changes-55): a free-form email to chosen
// audiences, a free-form email to one person, and the reusable designs both
// start from.
//
// The words are the author's, so the rules that a fixed template gave for free
// are enforced here instead: a closed set of variables, the unsubscribe link an
// HTML document must carry because it replaces the shell's footer, and a size
// cap. The server sanitises every body as well (security.md #8); these schemas
// refuse what sanitising cannot repair.
//
// No words live here (code-style #2): refusals are codes the catalog names.
import { z } from "zod";
import { announcementAudienceSchema } from "./announcements.ts";
import {
  EMAIL_BODY_MODES,
  GLOBAL_EMAIL_VARIABLES,
  findTemplateVariables,
  type EmailAudience,
} from "./email.ts";

const idSchema = z.string().min(1).max(191);
const localeSchema = z.string().min(2).max(10);

// ─── The two keys (ADR-172 #4) ───────────────────────────────

export interface CampaignEmailDefinition {
  audience: EmailAudience;
  /** Beyond GLOBAL_EMAIL_VARIABLES. */
  variables: readonly string[];
  /** Must be PROVIDED by the sender; the renderer refuses otherwise. */
  required: readonly string[];
}

/**
 * The keys a custom or direct email renders and is logged under. Deliberately
 * NOT in `EMAIL_TEMPLATES`: they own no stored body, no translations and no
 * on/off row — the body is the campaign's — and every consumer of that
 * registry assumes a key owns content (ADR-172 #4, code-style #28).
 */
export const CAMPAIGN_EMAILS = {
  "campaign.custom": {
    audience: "any",
    variables: ["unsubscribe.url"],
    required: ["unsubscribe.url"],
  },
  "campaign.direct": {
    audience: "any",
    variables: ["unsubscribe.url"],
    required: ["unsubscribe.url"],
  },
} as const satisfies Record<string, CampaignEmailDefinition>;

export type CampaignEmailKey = keyof typeof CAMPAIGN_EMAILS;
export const CAMPAIGN_EMAIL_KEYS = Object.keys(CAMPAIGN_EMAILS) as CampaignEmailKey[];

export function isCampaignEmailKey(value: string): value is CampaignEmailKey {
  return Object.prototype.hasOwnProperty.call(CAMPAIGN_EMAILS, value);
}

export const CAMPAIGN_EMAIL_KEY_FOR_KIND = {
  CUSTOM: "campaign.custom",
  DIRECT: "campaign.direct",
} as const satisfies Record<"CUSTOM" | "DIRECT", CampaignEmailKey>;

/** Everything a design, a custom body or a direct body may reference. */
export const CUSTOM_EMAIL_VARIABLES = [...GLOBAL_EMAIL_VARIABLES, "unsubscribe.url"] as const;

// ─── Limits ──────────────────────────────────────────────────

/** Bytes of body, before and after sanitising. One email × 10,000 recipients. */
export const EMAIL_BODY_MAX = 200_000;
/** Direct emails one staff member may send in an hour (owner, E8). */
export const DIRECT_SEND_LIMIT_PER_HOUR = 30;
export const EMAIL_DESIGN_NAME_MAX = 120;
export const EMAIL_DESIGN_DESCRIPTION_MAX = 300;

// ─── Shared field shapes ─────────────────────────────────────

/** A header takes one line: a newline in a subject is how a Bcc gets added. */
const headerLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !/[\r\n]/.test(value));

const emailModeSchema = z.enum(EMAIL_BODY_MODES);

interface BodyFields {
  subject?: string | null | undefined;
  preheader?: string | null | undefined;
  mode: (typeof EMAIL_BODY_MODES)[number];
  bodyHtml: string;
}

/**
 * The rules every author-written body shares, reported the way
 * `emailTemplateSaveSchema` reports them so the editors name the problem the
 * same way: `params.variable` for an unknown `{{name}}`, `params.missing` for a
 * required one that is absent.
 */
function checkBody(value: BodyFields, ctx: z.RefinementCtx): void {
  const allowed = new Set<string>(CUSTOM_EMAIL_VARIABLES);
  const used = findTemplateVariables(
    `${value.subject ?? ""} ${value.preheader ?? ""} ${value.bodyHtml}`,
  );
  for (const name of used) {
    if (!allowed.has(name)) {
      // A typo'd variable renders as a failed send, or literal braces.
      ctx.addIssue({ code: "custom", path: ["bodyHtml"], params: { variable: name } });
    }
  }
  // An HTML document replaces the shell, and with it the footer that carries
  // the way out. It has to carry its own (ADR-172 #2).
  if (value.mode === "HTML" && !findTemplateVariables(value.bodyHtml).includes("unsubscribe.url")) {
    ctx.addIssue({
      code: "custom",
      path: ["bodyHtml"],
      params: { missing: "unsubscribe.url" },
    });
  }
}

// ─── Designs (ADR-172 #3) ────────────────────────────────────

export const emailDesignSaveSchema = z
  .object({
    id: idSchema.optional(),
    name: headerLine(EMAIL_DESIGN_NAME_MAX).pipe(z.string().min(1)),
    description: headerLine(EMAIL_DESIGN_DESCRIPTION_MAX)
      .optional()
      .transform((value) => (value ? value : null)),
    mode: emailModeSchema,
    subject: headerLine(200)
      .optional()
      .transform((value) => (value ? value : null)),
    preheader: headerLine(200)
      .optional()
      .transform((value) => (value ? value : null)),
    bodyHtml: z.string().trim().min(1).max(EMAIL_BODY_MAX),
  })
  .superRefine(checkBody);
export type EmailDesignSaveInput = z.input<typeof emailDesignSaveSchema>;
export type EmailDesignSave = z.output<typeof emailDesignSaveSchema>;

export const emailDesignIdSchema = z.object({ id: idSchema });

// ─── A custom email (ADR-172 #1, #2) ─────────────────────────

/** One locale's words. The subject is required: there is no template's to fall back to. */
export const campaignContentSchema = z
  .object({
    locale: localeSchema,
    subject: headerLine(200).pipe(z.string().min(1)),
    preheader: headerLine(200)
      .optional()
      .transform((value) => (value ? value : null)),
    mode: emailModeSchema,
    bodyHtml: z.string().trim().min(1).max(EMAIL_BODY_MAX),
  })
  .superRefine(checkBody);
export type CampaignContentInput = z.input<typeof campaignContentSchema>;
export type CampaignContent = z.output<typeof campaignContentSchema>;

/**
 * What the composer saves. Each step sends what it owns: Content sends the
 * name, the design it started from and one locale's words; Audience sends the
 * audience. A draft may exist with neither yet.
 */
export const customEmailSaveSchema = z.object({
  id: idSchema.optional(),
  name: headerLine(160).pipe(z.string().min(1)),
  designId: idSchema.nullable().optional(),
  content: campaignContentSchema.optional(),
  audience: announcementAudienceSchema.optional(),
});
export type CustomEmailSaveInput = z.input<typeof customEmailSaveSchema>;
export type CustomEmailSave = z.output<typeof customEmailSaveSchema>;

/** The isolated preview route's custom-email and design modes. */
export const customEmailPreviewSchema = z.object({
  campaignId: idSchema,
  locale: localeSchema,
});
export const emailDesignPreviewSchema = z.object({ designId: idSchema });

// ─── A direct email (ADR-172 #6, #7) ─────────────────────────

export const DIRECT_RECIPIENT_KINDS = ["user", "subscriber"] as const;
export type DirectRecipientKind = (typeof DIRECT_RECIPIENT_KINDS)[number];

export const directEmailSchema = z
  .object({
    recipient: z.object({ kind: z.enum(DIRECT_RECIPIENT_KINDS), id: idSchema }).strict(),
    designId: idSchema.nullable().optional(),
    subject: headerLine(200).pipe(z.string().min(1)),
    mode: emailModeSchema,
    bodyHtml: z.string().trim().min(1).max(EMAIL_BODY_MAX),
    replyToSelf: z.boolean(),
  })
  .superRefine(checkBody);
export type DirectEmailInput = z.input<typeof directEmailSchema>;
export type DirectEmail = z.output<typeof directEmailSchema>;

/** Who the dialog is about, before anything is written. */
export const directRecipientSchema = z
  .object({ kind: z.enum(DIRECT_RECIPIENT_KINDS), id: idSchema })
  .strict();

/**
 * Why a direct email is refused (ADR-172 #6, #7). A code the dialog names,
 * never prose.
 */
export const DIRECT_EMAIL_REFUSALS = [
  "recipient_unavailable",
  "recipient_unsubscribed",
  "rate_limited",
  "email_disabled",
  "no_link_secret",
] as const;
export type DirectEmailRefusal = (typeof DIRECT_EMAIL_REFUSALS)[number];
