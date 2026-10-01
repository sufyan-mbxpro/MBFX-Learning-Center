// The translatable SOURCE of a promotion, and its hash (ADR-164, changes-52 P6).
//
// The words only — the five columns of `PromotionTranslation`. Everything else
// on a promotion (kind, window, placements, link, image) is the same in every
// language and never sent.
//
// Every field may be empty, the title included: a promotion LINKED to site
// content borrows the target's title in the reader's language. Such a
// promotion is still a source — its machine row is empty words, which is what
// lets it show in another language at all (a missing row hides it, ADR-167 #6)
// while the words come from the target's own translation. An empty source
// sends nothing to Google and costs nothing.
//
// Shared by the service (a person's save records the hash its words were made
// from, never a copied value) and the job (which re-hashes before it writes).
import { computeSourceHash } from "@repo/i18n";
import type { Prisma } from "@repo/db";

export interface PromotionSource {
  title: string | null;
  body: string | null;
  badge: string | null;
  ctaLabel: string | null;
  imageAlt: string | null;
}

export function hashPromotionSource(s: PromotionSource): string {
  return computeSourceHash(
    [s.title ?? "", s.body ?? "", s.badge ?? "", s.ctaLabel ?? "", s.imageAlt ?? ""].join("\u0000"),
  );
}

export async function loadPromotionSource(
  client: Pick<Prisma.TransactionClient, "promotionTranslation">,
  promotionId: string,
  defaultLocale: string,
): Promise<PromotionSource | null> {
  return client.promotionTranslation.findUnique({
    where: { promotionId_locale: { promotionId, locale: defaultLocale } },
    select: { title: true, body: true, badge: true, ctaLabel: true, imageAlt: true },
  });
}
