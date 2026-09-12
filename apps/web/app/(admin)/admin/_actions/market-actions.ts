"use server";

// Market platform actions (Module 13, ADR-087 / changes-25 T4).
//
// Gate order per security.md #1: `requirePermission()` first, then the parse,
// then the `@repo/core` service. Never Prisma (architecture.md #2).
//
// **Two keys, not one, and the split is the point.** Instruments are data an
// editor curates; the provider is a credential and an endpoint. ADR-087 #5
// keeps the provider on `market.providers.manage` rather than on super_admin —
// a read-only quote key captures nothing, unlike ADR-078's SMTP host — but it
// is still a different privilege from renaming EUR/USD.
//
// **No new keys were added.** `market.view`, `market.instruments.manage` and
// `market.providers.manage` have been seeded since Module 01 and had governed
// nothing (ADR-086 #7).
import {
  marketInstrumentSchema,
  marketProviderSchema,
  marketReorderSchema,
} from "@repo/contracts";
import {
  MARKET_CACHE_TAG,
  deleteInstrument,
  reorderInstruments,
  saveInstrument,
  saveMarketProvider,
  setInstrumentActive,
  testMarketProvider,
  type ProviderTestResult,
} from "@repo/core";
import { requirePermission } from "@repo/rbac";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const id = z.string().min(1).max(64);

/**
 * Every instrument write drops the `market` tag, never `content`.
 *
 * ADR-087 #8: market data churns on a daily sweep and content churns on
 * editorial action. Sharing a tag would have every article publish drop the
 * rate cache — and, worse, would make an admin renaming an instrument
 * invalidate every course page on the site.
 */
function invalidate(): void {
  revalidateTag(MARKET_CACHE_TAG, { expire: 0 });
}

export async function saveInstrumentAction(input: unknown): Promise<string> {
  const subject = await requirePermission("market.instruments.manage");
  const parsed = marketInstrumentSchema.parse(input);
  const instrumentId = await saveInstrument(subject, parsed);
  invalidate();
  return instrumentId;
}

export async function setInstrumentActiveAction(
  instrumentId: string,
  isActive: boolean,
): Promise<void> {
  const subject = await requirePermission("market.instruments.manage");
  await setInstrumentActive(subject, id.parse(instrumentId), z.boolean().parse(isActive));
  invalidate();
}

export async function deleteInstrumentAction(instrumentId: string): Promise<void> {
  const subject = await requirePermission("market.instruments.manage");
  await deleteInstrument(subject, id.parse(instrumentId));
  invalidate();
}

export async function reorderInstrumentsAction(orderedIds: unknown): Promise<void> {
  const subject = await requirePermission("market.instruments.manage");
  const parsed = marketReorderSchema.parse({ orderedIds });
  await reorderInstruments(subject, parsed.orderedIds);
  invalidate();
}

export async function saveMarketProviderAction(input: unknown): Promise<void> {
  // The stricter of the two keys. Editing the provider is editing where the
  // numbers come from.
  const subject = await requirePermission("market.providers.manage");
  const parsed = marketProviderSchema.parse(input);
  await saveMarketProvider(subject, parsed);
  invalidate();
}

/**
 * "Test connection". Reads through `loadProviderDriver()` like everything
 * else, so a passing test proves the SAME path a sweep takes — testing with a
 * key typed into the form would prove only that the form works.
 */
export async function testMarketProviderAction(symbol: string): Promise<ProviderTestResult> {
  await requirePermission("market.providers.manage");
  return testMarketProvider(z.string().min(1).max(20).parse(symbol));
}
