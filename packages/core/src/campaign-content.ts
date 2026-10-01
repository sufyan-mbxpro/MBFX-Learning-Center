// The words of a CUSTOM or DIRECT campaign (ADR-172 #2), shared by the
// service that saves them, the runner that sends them and the Review step's
// checklist — a module of its own so none of those imports another.
import { createHash } from "node:crypto";
import { db, type EmailBodyMode } from "@repo/db";
import type { MessageContent } from "@repo/email";
import type { Locales } from "./announcement-target.ts";

export interface StoredCampaignContent extends MessageContent {
  locale: string;
  mode: EmailBodyMode;
}

export async function loadCampaignContents(campaignId: string): Promise<StoredCampaignContent[]> {
  const rows = await db.emailCampaignContent.findMany({
    where: { campaignId },
    select: { locale: true, subject: true, preheader: true, mode: true, bodyHtml: true },
    orderBy: { locale: "asc" },
  });
  return rows;
}

/**
 * A digest of every locale's words, order-independent. The test gate compares
 * the digest stored at the last test with this one: any edit — a comma in the
 * Arabic subject — changes it and asks for a new test (owner, E5).
 */
export function hashCampaignContents(contents: readonly StoredCampaignContent[]): string {
  const hash = createHash("sha256");
  for (const row of [...contents].sort((a, b) => a.locale.localeCompare(b.locale))) {
    hash.update(
      JSON.stringify([row.locale, row.subject, row.preheader ?? "", row.mode, row.bodyHtml]),
    );
    hash.update("\n");
  }
  return hash.digest("hex");
}

/**
 * The words a recipient reads: their own locale when it is ACTIVE and has
 * words, otherwise the default locale's (changes-55 §6). Null when even the
 * default is missing, which the Review step refuses as `no_content` before
 * anything is queued.
 */
export function pickCampaignContent(
  contents: readonly StoredCampaignContent[],
  locale: string,
  locales: Locales,
): StoredCampaignContent | null {
  const own = locales.active.includes(locale)
    ? contents.find((row) => row.locale === locale)
    : undefined;
  return own ?? contents.find((row) => row.locale === locales.defaultLocale) ?? null;
}
