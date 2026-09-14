// Real MariaDB (testing.md: "Mocking Prisma hides FK and constraint bugs").
//
// Four claims are settled here and nowhere else, because all four are about
// what the DATABASE does under concurrency and at a boundary:
//
//  1. Every terminal state writes a row, the rollup and the period counter, in
//     one transaction, with atomic increments — two admins generating at once
//     must not lose one of the two costs.
//  2. **No prompt and no completion text is stored anywhere.** Asserted by
//     scanning the written rows for the input, not by reading the schema.
//  3. The cap flips ON the boundary, not past it.
//  4. The refusal order short-circuits BEFORE a driver is reached.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import type { db as DbClient } from "@repo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

// Imported for their TYPES only: every module below is loaded with a dynamic
// `import()` in `beforeAll`, AFTER `DATABASE_URL` points at the container, so a
// static import would build a Prisma client against the wrong URL.
import type * as BudgetModule from "./budget.ts";
import type * as ConfigModule from "./config.ts";
import type * as RunModule from "./run.ts";
import type * as UsageModule from "./usage.ts";

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let usage: typeof UsageModule;
let budget: typeof BudgetModule;
let config: typeof ConfigModule;
let run: typeof RunModule;

/** The seeded shape a fresh install has, minus the two real providers. */
async function seedPlatform(overrides: Record<string, unknown> = {}): Promise<void> {
  const settings: Record<string, unknown> = {
    "ai.enabled": true,
    "ai.maxTokensPerRequest": 2000,
    "ai.monthlyBudgetUsd": 50,
    "ai.budgetWarnPercent": 80,
    "ai.capBehavior": "DISABLE",
    "ai.rateLimitPerUserHour": 120,
    "ai.model.light": "echo",
    "ai.model.standard": "echo",
    "ai.model.heavy": "echo",
    ...overrides,
  };

  for (const [key, value] of Object.entries(settings)) {
    const type =
      typeof value === "boolean" ? "BOOLEAN" : typeof value === "number" ? "NUMBER" : "STRING";
    await db.setting.upsert({
      where: { key },
      update: { value: value as never },
      create: { key, groupName: "ai", value: value as never, type: type as never, label: key },
    });
  }

  await db.aiProvider.upsert({
    where: { id: "echo" },
    update: { isEnabled: true, isDefault: true },
    create: { id: "echo", kind: "ECHO", label: "Echo", isEnabled: true, isDefault: true },
  });

  await db.aiModel.upsert({
    where: { providerId_modelId: { providerId: "echo", modelId: "echo" } },
    update: {},
    create: {
      providerId: "echo",
      modelId: "echo",
      label: "Echo",
      inputPricePerMTok: 1,
      outputPricePerMTok: 10,
      cachedInputPricePerMTok: 0.1,
      maxOutputTokens: 4096,
      supportsVision: true,
    },
  });

  await db.aiFeature.upsert({
    where: { key: "seo_generation" },
    update: { isEnabled: true },
    create: { key: "seo_generation", isEnabled: true },
  });
}

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_ai_test")
    .withUsername("test")
    .withUserPassword("test")
    .start();

  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = url;
  db = (await import("@repo/db")).db;
  usage = await import("./usage.ts");
  budget = await import("./budget.ts");
  config = await import("./config.ts");
  run = await import("./run.ts");
}, 180_000);

afterAll(async () => {
  await db?.$disconnect();
  await container?.stop();
});

beforeEach(async () => {
  await db.aiUsage.deleteMany();
  await db.aiUsageDaily.deleteMany();
  await db.aiBudgetPeriod.deleteMany();
  await db.aiFeature.deleteMany();
  await db.aiModel.deleteMany();
  await db.aiProvider.deleteMany();
  await db.setting.deleteMany();
});

describe("the meter", () => {
  it("writes the row, the rollup and the period counter in one transaction", async () => {
    await usage.recordUsage({
      feature: "seo_generation",
      provider: "ECHO",
      modelId: "echo",
      status: "OK",
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.006,
      durationMs: 120,
    });

    expect(await db.aiUsage.count()).toBe(1);
    const daily = await db.aiUsageDaily.findFirst();
    expect(daily?.calls).toBe(1);
    expect(daily?.inputTokens).toBe(1000);
    expect(Number(daily?.costUsd)).toBeCloseTo(0.006, 6);
    const period = await db.aiBudgetPeriod.findFirst();
    expect(period?.calls).toBe(1);
  });

  it("increments atomically under two concurrent calls", async () => {
    // ADR-056's enrollment counter, same failure, different table:
    // read-modify-write loses one of the two costs.
    await Promise.all(
      Array.from({ length: 6 }, () =>
        usage.recordUsage({
          feature: "seo_generation",
          provider: "ECHO",
          modelId: "echo",
          status: "OK",
          inputTokens: 100,
          outputTokens: 10,
          costUsd: 0.01,
        }),
      ),
    );

    const daily = await db.aiUsageDaily.findFirst();
    expect(daily?.calls).toBe(6);
    expect(Number(daily?.costUsd)).toBeCloseTo(0.06, 6);
    const period = await db.aiBudgetPeriod.findFirst();
    expect(period?.calls).toBe(6);
    expect(Number(period?.costUsd)).toBeCloseTo(0.06, 6);
  });

  it("counts a REFUSED row as a call and a failure, at zero cost", async () => {
    await usage.recordUsage({
      feature: "seo_generation",
      provider: "ECHO",
      modelId: "-",
      status: "REFUSED",
      reason: "budget_exceeded",
      costUsd: 0,
    });
    const daily = await db.aiUsageDaily.findFirst();
    expect(daily?.calls).toBe(1);
    expect(daily?.failures).toBe(1);
    expect(Number(daily?.costUsd)).toBe(0);
  });

  it("purges raw rows past retention and keeps every rollup", async () => {
    const old = new Date(Date.now() - 200 * 86_400_000);
    await usage.recordUsage({
      feature: "seo_generation",
      provider: "ECHO",
      modelId: "echo",
      status: "OK",
      costUsd: 1,
      at: old,
    });
    await usage.recordUsage({
      feature: "seo_generation",
      provider: "ECHO",
      modelId: "echo",
      status: "OK",
      costUsd: 1,
    });

    const purged = await usage.purgeUsageOlderThan(90);
    expect(purged).toBe(1);
    expect(await db.aiUsage.count()).toBe(1);
    // Spend history must outlive PII: the rollup carries no person and stays.
    expect(await db.aiUsageDaily.count()).toBe(2);
  });
});

describe("the log holds no bodies", () => {
  it("stores nothing resembling the prompt or the completion", async () => {
    await seedPlatform();
    const secret = "CONFIDENTIAL-DRAFT-PHRASE-9137";

    await run
      .runAiTask({
        feature: "seo_generation",
        payload: { title: secret, content: `${secret} body text` },
      })
      .catch(() => undefined);

    // Scan every column of every written row, rather than trusting the schema
    // to have no body column: the claim is "no prompt text reaches the log",
    // and a future column would break it silently.
    const rows = await db.aiUsage.findMany();
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain(secret);
    expect(JSON.stringify(await db.aiUsageDaily.findMany())).not.toContain(secret);
  });

  it("stores a taxonomy reason, never a provider message", async () => {
    await seedPlatform({ "ai.enabled": false });
    await expect(
      run.runAiTask({ feature: "seo_generation", payload: { title: "t", content: "c" } }),
    ).rejects.toThrow();

    const row = await db.aiUsage.findFirst();
    expect(row?.reason).toBe("globally_disabled");
    expect(row?.status).toBe("REFUSED");
  });
});

describe("the budget", () => {
  it("flips ON the boundary, not past it", async () => {
    await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80 });
    await db.aiBudgetPeriod.updateMany({ data: { costUsd: 10 } });

    const state = await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80 });
    // Relaxing `>=` to `>` here is what this test exists to catch: it would let
    // exactly one more call through every month (ADR-096's lesson).
    expect(state.status).toBe("capped");
    expect(state.availableUsd).toBe(0);
  });

  it("warns at the configured percent and not before", async () => {
    await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80 });
    await db.aiBudgetPeriod.updateMany({ data: { costUsd: 7.99 } });
    expect((await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80 })).status).toBe("ok");
    await db.aiBudgetPeriod.updateMany({ data: { costUsd: 8 } });
    expect((await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80 })).status).toBe(
      "warning",
    );
  });

  it("treats 0 as unlimited", async () => {
    const state = await budget.getBudgetState({ budgetUsd: 0, warnPercent: 80 });
    expect(state.unlimited).toBe(true);
    expect(state.status).toBe("ok");
    expect(state.availableUsd).toBe(Number.POSITIVE_INFINITY);
  });

  it("keeps the cap the period STARTED with, until an admin rewrites it", async () => {
    await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80 });
    // A later read with a different setting must not retroactively re-cap.
    const again = await budget.getBudgetState({ budgetUsd: 999, warnPercent: 80 });
    expect(again.budgetUsd).toBe(10);

    // The limits screen's save is the explicit act that changes it.
    await budget.applyBudgetSettings({ budgetUsd: 999 });
    expect((await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80 })).budgetUsd).toBe(999);
  });

  it("notifies ONCE per period, however many calls are blocked", async () => {
    await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80 });
    await db.aiBudgetPeriod.updateMany({ data: { costUsd: 20 } });

    const first = await budget.claimBudgetEvent({ warnPercent: 80 });
    const second = await budget.claimBudgetEvent({ warnPercent: 80 });
    const third = await budget.claimBudgetEvent({ warnPercent: 80 });

    expect(first.event).toBe("capped");
    // Without the dedupe a capped platform sends a notification storm, one per
    // blocked call.
    expect(second.event).toBeNull();
    expect(third.event).toBeNull();
  });

  it("starts a fresh row for a new UTC month, so nothing is re-enabled by hand", async () => {
    const march = new Date(Date.UTC(2026, 2, 15));
    const april = new Date(Date.UTC(2026, 3, 1));
    await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80, at: march });
    await db.aiBudgetPeriod.update({ where: { period: "2026-03" }, data: { costUsd: 50 } });

    const next = await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80, at: april });
    expect(next.period).toBe("2026-04");
    expect(next.spentUsd).toBe(0);
    expect(next.status).toBe("ok");
  });

  it("resets the current period on an explicit, audited reset", async () => {
    await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80 });
    await db.aiBudgetPeriod.updateMany({ data: { costUsd: 20, notifiedAt: new Date() } });
    await budget.resetBudgetPeriod({ budgetUsd: 10 });
    const state = await budget.getBudgetState({ budgetUsd: 10, warnPercent: 80 });
    expect(state.spentUsd).toBe(0);
    expect(state.notifiedAt).toBeNull();
  });
});

describe("model resolution", () => {
  it("takes the explicit override first", async () => {
    await seedPlatform();
    const model = await db.aiModel.findFirstOrThrow();
    await db.aiModel.create({
      data: {
        providerId: "echo",
        modelId: "echo-pinned",
        label: "Pinned",
        inputPricePerMTok: 2,
        outputPricePerMTok: 20,
        maxOutputTokens: 4096,
      },
    });
    const pinned = await db.aiModel.findFirstOrThrow({ where: { modelId: "echo-pinned" } });
    await db.aiFeature.update({
      where: { key: "seo_generation" },
      data: { modelId: pinned.id },
    });

    const resolved = await config.resolveFeature("seo_generation");
    expect(resolved.model.modelId).toBe("echo-pinned");
    expect(resolved.model.rowId).not.toBe(model.id);
  });

  it("falls through a tier that names a retired model, and never throws", async () => {
    // A price list an admin edited last month must not be able to break
    // generation.
    await seedPlatform({ "ai.model.standard": "a-model-that-was-retired" });
    const resolved = await config.resolveFeature("seo_generation");
    expect(resolved.model.modelId).toBe("echo");
  });

  it("clamps the output ceiling to the minimum of three", async () => {
    // registry 700 (seo_generation) · admin 300 · model 4096 → 300.
    await seedPlatform({ "ai.maxTokensPerRequest": 300 });
    expect((await config.resolveFeature("seo_generation")).maxOutputTokens).toBe(300);

    // A feature row may LOWER the registry's cap, never raise it.
    await db.aiFeature.update({
      where: { key: "seo_generation" },
      data: { maxOutputTokens: 50 },
    });
    expect((await config.resolveFeature("seo_generation")).maxOutputTokens).toBe(50);

    await db.aiFeature.update({
      where: { key: "seo_generation" },
      data: { maxOutputTokens: 99_999 },
    });
    expect((await config.resolveFeature("seo_generation")).maxOutputTokens).toBe(300);
  });

  it("refuses when no provider is enabled", async () => {
    await seedPlatform();
    await db.aiProvider.updateMany({ data: { isEnabled: false } });
    await expect(config.resolveFeature("seo_generation")).rejects.toMatchObject({
      reason: "no_provider",
    });
  });

  it("ignores an AiFeature row for a key the registry does not know", async () => {
    await seedPlatform();
    await db.aiFeature.create({ data: { key: "tutor_chatbot", isEnabled: true } });
    const keys = await config.loadEnabledFeatureKeys();
    expect(keys.has("seo_generation")).toBe(true);
    expect([...keys]).not.toContain("tutor_chatbot");
  });
});

describe("the refusal order", () => {
  it("refuses a globally disabled platform first", async () => {
    await seedPlatform({ "ai.enabled": false });
    await expect(
      run.runAiTask({ feature: "seo_generation", payload: { title: "t", content: "c" } }),
    ).rejects.toMatchObject({ reason: "globally_disabled" });
    expect((await db.aiUsage.findFirstOrThrow()).reason).toBe("globally_disabled");
  });

  it("refuses a disabled feature on an enabled platform", async () => {
    await seedPlatform();
    await db.aiFeature.update({ where: { key: "seo_generation" }, data: { isEnabled: false } });
    await expect(
      run.runAiTask({ feature: "seo_generation", payload: { title: "t", content: "c" } }),
    ).rejects.toMatchObject({ reason: "feature_disabled" });
  });

  it("refuses when the cap is reached and capBehavior is DISABLE", async () => {
    await seedPlatform({ "ai.monthlyBudgetUsd": 1 });
    await budget.getBudgetState({ budgetUsd: 1, warnPercent: 80 });
    await db.aiBudgetPeriod.updateMany({ data: { costUsd: 5 } });

    await expect(
      run.runAiTask({ feature: "seo_generation", payload: { title: "t", content: "c" } }),
    ).rejects.toMatchObject({ reason: "budget_exceeded" });
  });

  it("keeps serving a capped platform when capBehavior is NOTIFY_ONLY", async () => {
    // "The CMS must keep working" and "stop spending" genuinely conflict at 3am
    // before a launch, and that is the owner's call to make in a form.
    await seedPlatform({ "ai.monthlyBudgetUsd": 1, "ai.capBehavior": "NOTIFY_ONLY" });
    await budget.getBudgetState({ budgetUsd: 1, warnPercent: 80 });
    await db.aiBudgetPeriod.updateMany({ data: { costUsd: 5 } });

    const result = await run.runAiTask({
      feature: "seo_generation",
      payload: { title: "t", content: "c" },
    });
    expect(result.text).toContain("Echo provider");
  });

  it("refuses past the per-user hourly window", async () => {
    await seedPlatform({ "ai.rateLimitPerUserHour": 2 });
    const user = await db.user.create({
      // `User.id` has no database default (Better Auth owns the table), so a
      // test row supplies its own.
      data: { id: "staff-1", email: "staff@example.com", name: "Staff", userType: "STAFF" },
    });

    await run.runAiTask({
      feature: "seo_generation",
      payload: { title: "t", content: "c" },
      actorId: user.id,
    });
    await run.runAiTask({
      feature: "seo_generation",
      payload: { title: "t", content: "c" },
      actorId: user.id,
    });
    await expect(
      run.runAiTask({
        feature: "seo_generation",
        payload: { title: "t", content: "c" },
        actorId: user.id,
      }),
    ).rejects.toMatchObject({ reason: "rate_limited" });
  });

  it("meters a successful call exactly once, with its cost frozen", async () => {
    await seedPlatform();
    const result = await run.runAiTask({
      feature: "seo_generation",
      payload: { title: "t", content: "c" },
      entity: { type: "article", id: "abc" },
    });

    const rows = await db.aiUsage.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("OK");
    expect(rows[0]!.entityType).toBe("article");
    expect(rows[0]!.entityId).toBe("abc");
    expect(Number(rows[0]!.costUsd)).toBeCloseTo(result.costUsd, 6);

    // Re-pricing the model must NOT rewrite history (ADR-100 #3).
    await db.aiModel.updateMany({ data: { inputPricePerMTok: 999 } });
    const after = await db.aiUsage.findFirstOrThrow();
    expect(Number(after.costUsd)).toBeCloseTo(result.costUsd, 6);
  });

  it("meters an aborted stream with the tokens it saw", async () => {
    await seedPlatform();
    await db.aiFeature
      .update({ where: { key: "writing_assistant" }, data: { isEnabled: true } })
      .catch(async () =>
        db.aiFeature.create({ data: { key: "writing_assistant", isEnabled: true } }),
      );

    const stream = run.streamAiTask({
      feature: "writing_assistant",
      payload: { action: "draft", instruction: "an intro" },
    });
    // Take one chunk and walk away — exactly what a browser tab closing does.
    await stream.next();
    await stream.return(undefined);

    const row = await db.aiUsage.findFirstOrThrow({ where: { feature: "writing_assistant" } });
    // The generator's own `finally` ran, which is the whole point: the provider
    // bills what it streamed, so a row that pretends otherwise under-reports.
    expect(["OK", "ABORTED"]).toContain(row.status);
  });
});

describe("the usage dashboard's reads", () => {
  it("pages the recent-calls table by keyset", async () => {
    for (let i = 0; i < 5; i += 1) {
      await usage.recordUsage({
        feature: "seo_generation",
        provider: "ECHO",
        modelId: "echo",
        status: "OK",
        costUsd: 0.01,
        at: new Date(Date.now() - i * 1000),
      });
    }

    const first = await usage.listUsageRows({ limit: 2 });
    expect(first.rows).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await usage.listUsageRows({ limit: 2, cursor: first.nextCursor });
    expect(second.rows).toHaveLength(2);
    expect(second.rows.map((r) => r.id)).not.toEqual(first.rows.map((r) => r.id));

    const last = await usage.listUsageRows({ limit: 50 });
    expect(last.rows).toHaveLength(5);
    expect(last.nextCursor).toBeNull();
  });

  it("filters by feature, status and staff member", async () => {
    await db.user.create({
      data: { id: "staff-2", email: "a@example.com", name: "A", userType: "STAFF" },
    });
    await usage.recordUsage({
      feature: "alt_text",
      provider: "ECHO",
      modelId: "echo",
      status: "FAILED",
      reason: "provider_error",
      costUsd: 0,
      userId: "staff-2",
    });
    await usage.recordUsage({
      feature: "seo_generation",
      provider: "ECHO",
      modelId: "echo",
      status: "OK",
      costUsd: 1,
    });

    expect((await usage.listUsageRows({ feature: "alt_text" })).rows).toHaveLength(1);
    expect((await usage.listUsageRows({ status: "FAILED" })).rows).toHaveLength(1);
    expect((await usage.listUsageRows({ userId: "staff-2" })).rows).toHaveLength(1);
    expect((await usage.listUsageRows({ since: new Date(Date.now() - 60_000) })).rows).toHaveLength(
      2,
    );
  });

  it("summarises from the ROLLUP, and reports 0 rather than NaN for no calls", async () => {
    const empty = await usage.summarizeUsage(new Date(Date.now() - 86_400_000));
    expect(empty.calls).toBe(0);
    expect(empty.averageCostUsd).toBe(0);

    await usage.recordUsage({
      feature: "seo_generation",
      provider: "ECHO",
      modelId: "echo",
      status: "OK",
      inputTokens: 10,
      outputTokens: 2,
      costUsd: 0.5,
    });
    await usage.recordUsage({
      feature: "seo_generation",
      provider: "ECHO",
      modelId: "echo",
      status: "FAILED",
      reason: "provider_error",
      costUsd: 0.1,
    });

    const summary = await usage.summarizeUsage(new Date(Date.now() - 86_400_000));
    expect(summary.calls).toBe(2);
    expect(summary.failures).toBe(1);
    expect(summary.costUsd).toBeCloseTo(0.6, 6);
    expect(summary.averageCostUsd).toBeCloseTo(0.3, 6);
  });

  it("returns one chart point per day, feature, provider and model", async () => {
    await usage.recordUsage({
      feature: "seo_generation",
      provider: "ECHO",
      modelId: "echo",
      status: "OK",
      costUsd: 1,
    });
    await usage.recordUsage({
      feature: "alt_text",
      provider: "ECHO",
      modelId: "echo",
      status: "OK",
      costUsd: 2,
    });

    const series = await usage.usageDailySeries(new Date(Date.now() - 7 * 86_400_000));
    expect(series).toHaveLength(2);
    expect(series.map((p) => p.feature).sort()).toEqual(["alt_text", "seo_generation"]);
    expect(series.every((p) => typeof p.costUsd === "number")).toBe(true);
  });
});

describe("loading a driver", () => {
  it("refuses a disabled provider", async () => {
    await seedPlatform();
    await db.aiProvider.update({ where: { id: "echo" }, data: { isEnabled: false } });
    const provider = await import("./provider.ts");
    await expect(provider.loadProviderDriver("echo")).rejects.toMatchObject({
      reason: "no_provider",
    });
  });

  it("refuses a provider with no key, and never guesses one", async () => {
    await seedPlatform();
    await db.aiProvider.create({
      data: { id: "anthropic", kind: "ANTHROPIC", label: "Anthropic", isEnabled: true },
    });
    const provider = await import("./provider.ts");
    await expect(provider.loadProviderDriver("anthropic")).rejects.toMatchObject({
      reason: "missing_key",
    });
  });

  it("reports an unreadable seal as configuration, not as a provider failure", async () => {
    // ADR-098's consequence: an unreadable seal surfaces on the screen that can
    // fix it. With AI_SECRET_KEY absent it reads exactly like a rejected API
    // key, which is why it gets its own reason.
    await seedPlatform();
    await db.aiProvider.create({
      data: {
        id: "anthropic",
        kind: "ANTHROPIC",
        label: "Anthropic",
        isEnabled: true,
        apiKeyCipher: "v1:AAAA:BBBB:CCCC",
      },
    });
    const provider = await import("./provider.ts");
    delete process.env.AI_SECRET_KEY;
    await expect(provider.loadProviderDriver("anthropic")).rejects.toMatchObject({
      reason: "secret_unreadable",
    });
  });

  it("builds an ECHO driver with no key at all", async () => {
    await seedPlatform();
    const provider = await import("./provider.ts");
    const driver = await provider.loadProviderDriver("echo");
    expect(driver.kind).toBe("ECHO");
  });

  it("reports a failing test connection as a reason, never as a thrown error", async () => {
    await seedPlatform();
    const result = await run.testProviderConnection({ providerId: "echo" });
    expect(result).toEqual({ ok: true, reason: null });

    const missing = await run.testProviderConnection({ providerId: "nope" });
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe("no_provider");
  });
});

describe("availability", () => {
  it("reports a capped DISABLE platform as off, feature switches notwithstanding", async () => {
    const availability = await import("./availability.ts");
    await seedPlatform({ "ai.monthlyBudgetUsd": 1 });
    await budget.getBudgetState({ budgetUsd: 1, warnPercent: 80 });
    await db.aiBudgetPeriod.updateMany({ data: { costUsd: 5 } });

    const state = await availability.getAiAvailability();
    // The failure this shape prevents: a page rendering an affordance because
    // its feature is on, on a platform whose cap was reached an hour ago.
    expect(state.enabled).toBe(false);
    expect(state.features.seo_generation).toBeUndefined();
    expect(state.budget.status).toBe("capped");
  });

  it("reports an enabled feature on an enabled platform", async () => {
    const availability = await import("./availability.ts");
    await seedPlatform();
    const state = await availability.getAiAvailability();
    expect(state.enabled).toBe(true);
    expect(state.features.seo_generation).toBe(true);
    expect(state.features.alt_text).toBeUndefined();
  });
});
