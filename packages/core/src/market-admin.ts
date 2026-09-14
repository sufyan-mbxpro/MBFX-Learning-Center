// The admin's door to the market tables (Module 13, ADR-087 / changes-25 T4).
//
// Server actions never touch Prisma (architecture.md #2), so everything the
// two market screens need is here. Three properties this file is responsible
// for, none of which a screen can be trusted to remember:
//
//   1. **The API key leaves by no route.** `MarketProviderView` has no key
//      property at all, so a leak has to get past the TYPE, not just past a
//      reviewer (ADR-087 #5). `loadProviderDriver()` in `market.ts` stays the
//      one reader of `apiKeyCipher`; nothing here selects it, and
//      `saveMarketProvider` only ever writes it.
//   2. **A blank key field means UNCHANGED, never erase.** Write-only means
//      the field renders empty over a stored key, so treating empty as a
//      deletion would wipe the key on every unrelated save of the form.
//   3. **Every mutation records audit** (security.md #5).
import type { MarketInstrumentSaveInput, MarketProviderSaveInput } from "@repo/contracts";
import { db, type MarketDriver, type MarketInstrumentKind, type Prisma } from "@repo/db";
import { hasSecretKey } from "@repo/secrets";
import type { Subject } from "@repo/rbac";

import { recordAudit } from "./index.ts";
import {
  MARKET_PROVIDER_ID,
  MARKET_SECRET_KEY_ENV,
  loadProviderDriver,
  sealProviderKey,
  syncDailyBars,
  type InstrumentView,
  type SyncResult,
} from "./market.ts";

// ─── The provider ────────────────────────────────────────────

/**
 * What the provider screen renders.
 *
 * Note what is NOT here: there is no `apiKey` and no `apiKeyCipher`.
 * `hasApiKey` is the only thing the screen is told, which is enough to say
 * "saved — replace" and nothing more.
 */
export interface MarketProviderView {
  driver: MarketDriver;
  baseUrl: string | null;
  hasApiKey: boolean;
  refreshSeconds: number;
  staleSeconds: number;
  isEnabled: boolean;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  /**
   * Whether `MARKET_SECRET_KEY` is present and usable. Without it a stored key
   * cannot be opened, so the screen warns rather than letting an admin save a
   * credential that will never work.
   */
  hasSecretKey: boolean;
  /**
   * Whether `CRON_SECRET` is set. Not proof that anything CALLS the sync
   * endpoint — only the deployment knows that — but its absence is proof that
   * nothing can: the route fails closed on an unset secret (ADR-096 #5). The
   * screen says "only when a scheduler calls it" rather than promising a
   * cadence it cannot see.
   */
  cronConfigured: boolean;
}

export async function loadMarketProvider(): Promise<MarketProviderView> {
  const row = await db.marketProvider.findUnique({
    where: { id: MARKET_PROVIDER_ID },
    // `apiKeyCipher` is selected ONLY to compute `hasApiKey`, and is not
    // carried out of this function. The view type is what enforces that.
    select: {
      driver: true,
      baseUrl: true,
      apiKeyCipher: true,
      refreshSeconds: true,
      staleSeconds: true,
      isEnabled: true,
      lastSyncAt: true,
      lastSyncError: true,
    },
  });

  if (!row) {
    return {
      driver: "MANUAL",
      baseUrl: null,
      hasApiKey: false,
      refreshSeconds: 300,
      staleSeconds: 86_400,
      isEnabled: false,
      lastSyncAt: null,
      lastSyncError: null,
      hasSecretKey: hasSecretKey(MARKET_SECRET_KEY_ENV),
      cronConfigured: Boolean(process.env.CRON_SECRET),
    };
  }

  const { apiKeyCipher, ...rest } = row;
  return {
    ...rest,
    hasApiKey: Boolean(apiKeyCipher),
    hasSecretKey: hasSecretKey(MARKET_SECRET_KEY_ENV),
    cronConfigured: Boolean(process.env.CRON_SECRET),
  };
}

export async function saveMarketProvider(
  subject: Subject,
  input: MarketProviderSaveInput,
): Promise<MarketProviderView> {
  const data: Prisma.MarketProviderUncheckedCreateInput = {
    id: MARKET_PROVIDER_ID,
    driver: input.driver,
    baseUrl: input.baseUrl ?? null,
    refreshSeconds: input.refreshSeconds,
    staleSeconds: input.staleSeconds,
    isEnabled: input.isEnabled,
  };

  // A blank key leaves the stored one alone. Write-only means the field
  // renders empty over a saved credential, so "blank = erase" would delete the
  // key every time somebody changed the refresh interval.
  const update: Prisma.MarketProviderUncheckedUpdateInput = { ...data };
  delete (update as { id?: unknown }).id;
  if (input.apiKey) {
    const sealed = sealProviderKey(input.apiKey);
    data.apiKeyCipher = sealed;
    update.apiKeyCipher = sealed;
  }

  await db.marketProvider.upsert({
    where: { id: MARKET_PROVIDER_ID },
    create: data,
    update,
  });

  await recordAudit({
    userId: subject.id,
    action: "market.provider.update",
    entityType: "MarketProvider",
    entityId: MARKET_PROVIDER_ID,
    // The key is never in the audit payload either — a diff that echoed it
    // would be a second copy outside the seal.
    changes: {
      after: {
        driver: input.driver,
        isEnabled: input.isEnabled,
        apiKeyChanged: Boolean(input.apiKey),
      },
    },
  });

  return loadMarketProvider();
}

export interface ProviderTestResult {
  ok: boolean;
  /** The symbol that was tried, so a failure says what it was asked for. */
  symbol: string;
  bars?: number;
  latestClose?: number;
  latencyMs: number;
  error?: string;
}

/**
 * Fetch one series and report. The screen's "Test connection".
 *
 * Reads through `loadProviderDriver()` like everything else, so a test that
 * passes proves the SAME path a sweep takes — testing with a key typed into
 * the form would prove only that the form works.
 */
export async function testMarketProvider(symbol: string): Promise<ProviderTestResult> {
  const startedAt = Date.now();
  const driver = await loadProviderDriver();
  if (!driver) {
    return {
      ok: false,
      symbol,
      latencyMs: Date.now() - startedAt,
      error: "No provider is configured, or its key cannot be opened.",
    };
  }
  try {
    const bars = await driver.fetchDailySeries(symbol, "compact");
    return {
      ok: true,
      symbol,
      bars: bars.length,
      latestClose: bars[bars.length - 1]?.close,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      symbol,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Instruments ─────────────────────────────────────────────

export interface AdminInstrumentRow extends InstrumentView {
  /** The newest stored bar, or null — the screen's freshness column. */
  lastBarDate: Date | null;
  /**
   * Whole days since that bar, or null when the instrument has never synced.
   *
   * Derived HERE rather than in the page, because `Date.now()` in a React
   * render is an impure call the lint rules refuse (react-hooks/purity) — and
   * they are right to: a value that changes between two renders of the same
   * props is exactly what a render must not produce.
   */
  staleDays: number | null;
  barCount: number;
}

/**
 * Every instrument, with freshness.
 *
 * The freshness column is not decoration: the sweep walks instruments
 * oldest-stored-bar first and stops when the budget runs out (ADR-087 #9), so
 * this is what makes that rotation visible rather than mysterious when a free
 * tier is exhausted mid-run.
 */
export async function listInstruments(filter?: {
  kind?: MarketInstrumentKind;
  isActive?: boolean;
  search?: string;
}): Promise<AdminInstrumentRow[]> {
  const rows = await db.marketInstrument.findMany({
    where: {
      ...(filter?.kind ? { kind: filter.kind } : {}),
      ...(filter?.isActive === undefined ? {} : { isActive: filter.isActive }),
      ...(filter?.search
        ? {
            OR: [
              { symbol: { contains: filter.search } },
              { displayName: { contains: filter.search } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { symbol: "asc" }],
    include: {
      bars: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      _count: { select: { bars: true } },
    },
  });

  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    symbol: row.symbol,
    displayName: row.displayName,
    base: row.base,
    quote: row.quote,
    providerSymbol: row.providerSymbol,
    pipSize: row.pipSize === null ? null : Number(row.pipSize),
    decimals: row.decimals,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    lastBarDate: row.bars[0]?.date ?? null,
    staleDays: row.bars[0] ? Math.floor((now - row.bars[0].date.getTime()) / 86_400_000) : null,
    barCount: row._count.bars,
  }));
}

export async function saveInstrument(
  subject: Subject,
  input: MarketInstrumentSaveInput,
): Promise<string> {
  const data = {
    kind: input.kind,
    symbol: input.symbol,
    displayName: input.displayName,
    base: input.base ?? null,
    quote: input.quote ?? null,
    providerSymbol: input.providerSymbol ?? null,
    pipSize: input.pipSize ?? null,
    decimals: input.decimals,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  };

  const row = input.id
    ? await db.marketInstrument.update({ where: { id: input.id }, data })
    : await db.marketInstrument.create({ data });

  await recordAudit({
    userId: subject.id,
    action: input.id ? "market.instrument.update" : "market.instrument.create",
    entityType: "MarketInstrument",
    entityId: row.id,
    changes: { after: { symbol: row.symbol, kind: row.kind } },
  });

  return row.id;
}

export async function setInstrumentActive(
  subject: Subject,
  id: string,
  isActive: boolean,
): Promise<void> {
  const row = await db.marketInstrument.update({ where: { id }, data: { isActive } });
  await recordAudit({
    userId: subject.id,
    action: isActive ? "market.instrument.activate" : "market.instrument.deactivate",
    entityType: "MarketInstrument",
    entityId: id,
    changes: { after: { symbol: row.symbol } },
  });
}

export async function deleteInstrument(subject: Subject, id: string): Promise<void> {
  // Bars cascade — the schema says so, and an instrument with no bars is not
  // a thing anybody would want kept.
  const row = await db.marketInstrument.delete({ where: { id } });
  await recordAudit({
    userId: subject.id,
    action: "market.instrument.delete",
    entityType: "MarketInstrument",
    entityId: id,
    changes: { after: { symbol: row.symbol } },
  });
}

/** Keyboard reorder (plan 8.2 — no drag-and-drop dependency anywhere). */
export async function reorderInstruments(
  subject: Subject,
  orderedIds: readonly string[],
): Promise<void> {
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.marketInstrument.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  await recordAudit({
    userId: subject.id,
    action: "market.instrument.reorder",
    entityType: "MarketInstrument",
    changes: { after: { count: orderedIds.length } },
  });
}

// ─── The manual sweep (ADR-096 #3) ───────────────────────────

/**
 * "Sync now" — the same sweep the cron route runs, with a person behind it.
 *
 * **It does not go through `/api/cron/market-sync`.** That route's job is to
 * authenticate an unattended caller with a shared secret; this one already has
 * a subject that passed `requirePermission()`, and making an admin screen
 * present a bearer token to its own app would be a second authorization
 * scheme for the same action.
 *
 * The audit row is the visible difference: an admin-initiated run records the
 * admin, the unattended one records `userId: null`. Both are true, and
 * inventing a system user to make them look alike would put a fictional actor
 * in the trail (security.md #5).
 *
 * **The due check is deliberately skipped.** A person pressing a button has
 * said what they want; the interval exists to stop a SCHEDULER from calling
 * the provider too often. The run still writes `lastSyncAt`, so the next
 * scheduled tick is measured from it — "when we last called the provider" is
 * the only honest reading of that column (ADR-096 #3).
 */
export async function runMarketSync(subject: Subject): Promise<SyncResult> {
  const startedAt = new Date();
  const result = await syncDailyBars({ now: startedAt });

  await recordAudit({
    userId: subject.id,
    action: "market.sync.manual",
    entityType: "MarketProvider",
    entityId: MARKET_PROVIDER_ID,
    changes: {
      after: {
        attempted: result.attempted,
        synced: result.synced,
        barsWritten: result.barsWritten,
        skipped: result.skipped,
        failures: result.failures.length,
      },
    },
  });

  return result;
}
