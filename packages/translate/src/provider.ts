// The provider row, and **the ONE reader of `apiKeyCipher`** (ADR-160 #4).
//
// `provider.test.ts` fails any other file in this package that SELECTS the
// column, the way `@repo/ai`'s provider guard does. Writing it (the settings
// save) is a different act and is allowed where the save lives.
import { db } from "@repo/db";

import { TranslateError } from "./errors.ts";
import { googleTranslateDriver, type TranslateDriver } from "./google.ts";
import { openTranslateKey } from "./secret.ts";

export const PROVIDER_ID = "default";

export interface ProviderConfig {
  enabled: boolean;
  pricePerMillionChars: number;
  monthlyCharBudget: number | null;
}

export interface LoadedProvider {
  driver: TranslateDriver;
  config: ProviderConfig;
}

/**
 * The driver and the row's pricing, or a `TranslateError`.
 *
 * `includeDisabled` is for the settings screen, which tests a key BEFORE the
 * switch is on. `apiKey` is a key typed on that screen and not yet saved; it
 * is used instead of the stored one and never written by this function.
 * Nothing that translates content passes either.
 */
export async function loadTranslateDriver(
  options: { includeDisabled?: boolean; apiKey?: string } = {},
): Promise<LoadedProvider> {
  const row = await db.translateProvider.findUnique({
    where: { id: PROVIDER_ID },
    select: {
      enabled: true,
      apiKeyCipher: true,
      pricePerMillionChars: true,
      monthlyCharBudget: true,
    },
  });

  const config: ProviderConfig = {
    enabled: row?.enabled ?? false,
    pricePerMillionChars: row ? Number(row.pricePerMillionChars) : 20,
    monthlyCharBudget: row?.monthlyCharBudget ?? null,
  };

  if (!config.enabled && !options.includeDisabled) {
    throw new TranslateError("not_configured", "Automatic translation is switched off");
  }

  const typed = options.apiKey?.trim();
  let apiKey: string;
  if (typed) {
    apiKey = typed;
  } else if (row?.apiKeyCipher) {
    // An unreadable seal switches translation OFF, never "fail every job"
    // (ADR-160 #11): the reason is `seal_unavailable`, which pauses.
    apiKey = openTranslateKey(row.apiKeyCipher);
  } else {
    throw new TranslateError("not_configured", "No Google Translate API key is saved");
  }

  return { driver: googleTranslateDriver(apiKey), config };
}
