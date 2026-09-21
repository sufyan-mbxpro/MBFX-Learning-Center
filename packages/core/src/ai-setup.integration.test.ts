// The guided AI setup (ADR-120) against real MariaDB.
//
// The properties a screen cannot be trusted to remember:
//
//   1. **A stored key never crosses vendors.** Testing or saving Gemini with
//      the Anthropic row's id must not open, send or reuse the Anthropic key.
//   2. **Connecting makes exactly one default**, enabled, in one transaction.
//   3. **Blank means unchanged** — a second save without a key keeps it.
//   4. **An un-ticked model is disabled, never deleted**, and `pricedAt` moves
//      only when a price does.
//   5. **The tiers land in settings** with the models they name.
//
// No network: the only discovery exercised here is Echo's and the refusals
// that happen before a request, which is what this layer owns. The HTTP shape
// of each provider is `drivers.test.ts`'s job, under MSW.
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import type * as AiAdminModule from "./ai-admin.ts";
import {
  makeActor,
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "./test-utils/cms-container.ts";

let ctx: CmsTestContext;
let service: typeof AiAdminModule;
let actor: Awaited<ReturnType<typeof makeActor>>;

const model = (modelId: string, input = 1, output = 5) => ({
  modelId,
  label: modelId,
  inputPricePerMTok: input,
  outputPricePerMTok: output,
  cachedInputPricePerMTok: null,
  maxOutputTokens: 8192,
  supportsVision: true,
});

beforeAll(async () => {
  // The seal refuses to fall back to plaintext, so the key must exist before
  // @repo/ai is loaded by anything in this suite.
  process.env.AI_SECRET_KEY = Buffer.alloc(32, 9).toString("base64");
  ctx = await startCmsTestDb();
  service = await import("./ai-admin.ts");
  actor = await makeActor(ctx.db, "ai-setup-actor", ["ai.providers.manage", "ai.settings.manage"]);

  // The seed's rows, as `prisma/seed.ts` writes them.
  await ctx.db.aiProvider.createMany({
    data: [
      { id: "echo", kind: "ECHO", label: "Echo (no provider)", isEnabled: true, isDefault: true },
      { id: "anthropic", kind: "ANTHROPIC", label: "Anthropic", isEnabled: false },
    ],
  });
  await ctx.db.aiModel.create({
    data: {
      providerId: "echo",
      modelId: "echo",
      label: "Echo",
      inputPricePerMTok: 0,
      outputPricePerMTok: 0,
    },
  });
  const settings: Array<[string, unknown, "BOOLEAN" | "NUMBER" | "STRING"]> = [
    ["ai.enabled", false, "BOOLEAN"],
    ["ai.maxTokensPerRequest", 2000, "NUMBER"],
    ["ai.monthlyBudgetUsd", 50, "NUMBER"],
    ["ai.budgetWarnPercent", 80, "NUMBER"],
    ["ai.capBehavior", "DISABLE", "STRING"],
    ["ai.rateLimitPerUserHour", 120, "NUMBER"],
    ["ai.model.light", "claude-haiku-4-5", "STRING"],
    ["ai.model.standard", "claude-sonnet-5", "STRING"],
    ["ai.model.heavy", "claude-opus-5", "STRING"],
  ];
  for (const [key, value, type] of settings) {
    await ctx.db.setting.create({
      data: { groupName: "ai", key, value: value as never, type, label: key },
    });
  }
}, 180_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

describe("the setup view carries no key (ADR-098 (b))", () => {
  it("has no key property in its TYPE, and none at runtime", async () => {
    expectTypeOf<AiAdminModule.AiProviderView>().not.toHaveProperty("apiKeyCipher");
    expectTypeOf<AiAdminModule.AiProviderView>().not.toHaveProperty("apiKey");
    const view = await service.loadAiSetupView();
    for (const provider of view.providers) {
      expect(Object.keys(provider)).not.toContain("apiKeyCipher");
    }
    expect(view.models.echo?.map((m) => m.modelId)).toEqual(["echo"]);
  });
});

describe("discoverAiModels", () => {
  it("lists Echo's placeholder model with no key and no network", async () => {
    const result = await service.discoverAiModels(actor, { kind: "ECHO", providerId: "echo" });
    expect(result.ok).toBe(true);
    expect(result.models.map((m) => m.modelId)).toEqual(["echo"]);
    // Priced before, so the form pre-fills it rather than inventing one.
    expect(result.models[0]?.knownInputPricePerMTok).toBe(0);
  });

  it("reports missing_key for a stored provider with no key, and stamps the row", async () => {
    const result = await service.discoverAiModels(actor, {
      kind: "ANTHROPIC",
      providerId: "anthropic",
    });
    expect(result).toEqual({ ok: false, reason: "missing_key", models: [] });
    const row = await ctx.db.aiProvider.findUniqueOrThrow({ where: { id: "anthropic" } });
    expect(row.lastTestAt).not.toBeNull();
    expect(row.lastTestError).toBe("missing_key");
  });

  it("never tests another kind with a row's stored key", async () => {
    // Give the Anthropic row a key, then ask about GOOGLE naming that row.
    await service.saveAiSetup(actor, {
      providerId: "anthropic",
      kind: "ANTHROPIC",
      apiKey: "sk-ant-secret",
      models: [model("claude-haiku-4-5")],
      tiers: { light: "claude-haiku-4-5", standard: "claude-haiku-4-5", heavy: "claude-haiku-4-5" },
    });
    const before = await ctx.db.aiProvider.findUniqueOrThrow({ where: { id: "anthropic" } });

    const result = await service.discoverAiModels(actor, {
      kind: "GOOGLE",
      providerId: "anthropic",
    });
    // The id is ignored because the kinds differ, so there is no key at all.
    expect(result.reason).toBe("missing_key");
    const after = await ctx.db.aiProvider.findUniqueOrThrow({ where: { id: "anthropic" } });
    expect(after.lastTestAt).toEqual(before.lastTestAt);
  });
});

describe("saveAiSetup", () => {
  it("connects a provider: enabled, the one default, key sealed, models and tiers written", async () => {
    const saved = await service.saveAiSetup(actor, {
      providerId: "anthropic",
      kind: "ANTHROPIC",
      apiKey: "sk-ant-secret-2",
      models: [model("claude-haiku-4-5"), model("claude-sonnet-5", 2, 10), model("claude-opus-5")],
      tiers: { light: "claude-haiku-4-5", standard: "claude-sonnet-5", heavy: "claude-opus-5" },
    });

    expect(saved).toMatchObject({ id: "anthropic", isEnabled: true, isDefault: true });
    expect(saved.hasApiKey).toBe(true);

    const defaults = await ctx.db.aiProvider.findMany({ where: { isDefault: true } });
    expect(defaults.map((p) => p.id)).toEqual(["anthropic"]);

    const row = await ctx.db.aiProvider.findUniqueOrThrow({ where: { id: "anthropic" } });
    // Sealed, not stored as typed.
    expect(row.apiKeyCipher).toBeTruthy();
    expect(row.apiKeyCipher).not.toContain("sk-ant-secret-2");

    const models = await ctx.db.aiModel.findMany({
      where: { providerId: "anthropic", isEnabled: true },
      orderBy: { sortOrder: "asc" },
    });
    expect(models.map((m) => m.modelId)).toEqual([
      "claude-haiku-4-5",
      "claude-sonnet-5",
      "claude-opus-5",
    ]);

    const tiers = await ctx.db.setting.findMany({
      where: { key: { in: ["ai.model.light", "ai.model.standard", "ai.model.heavy"] } },
      orderBy: { key: "asc" },
    });
    expect(Object.fromEntries(tiers.map((s) => [s.key, s.value]))).toEqual({
      "ai.model.heavy": "claude-opus-5",
      "ai.model.light": "claude-haiku-4-5",
      "ai.model.standard": "claude-sonnet-5",
    });

    const audit = await ctx.db.auditLog.findFirst({
      where: { entityType: "AiProvider", entityId: "anthropic", action: "ai.setup.update" },
      orderBy: { createdAt: "desc" },
    });
    expect(JSON.stringify(audit?.changes)).not.toContain("sk-ant-secret");
  });

  it("keeps the key on a blank save, disables an un-ticked model, and dates only a price change", async () => {
    const cipherBefore = (await ctx.db.aiProvider.findUniqueOrThrow({ where: { id: "anthropic" } }))
      .apiKeyCipher;
    const haikuBefore = await ctx.db.aiModel.findUniqueOrThrow({
      where: { providerId_modelId: { providerId: "anthropic", modelId: "claude-haiku-4-5" } },
    });

    await service.saveAiSetup(actor, {
      providerId: "anthropic",
      kind: "ANTHROPIC",
      models: [model("claude-haiku-4-5"), model("claude-sonnet-5", 3, 15)],
      tiers: { light: "claude-haiku-4-5", standard: "claude-sonnet-5", heavy: "claude-sonnet-5" },
    });

    const row = await ctx.db.aiProvider.findUniqueOrThrow({ where: { id: "anthropic" } });
    expect(row.apiKeyCipher).toBe(cipherBefore);

    const opus = await ctx.db.aiModel.findUniqueOrThrow({
      where: { providerId_modelId: { providerId: "anthropic", modelId: "claude-opus-5" } },
    });
    expect(opus.isEnabled).toBe(false);

    const haiku = await ctx.db.aiModel.findUniqueOrThrow({
      where: { providerId_modelId: { providerId: "anthropic", modelId: "claude-haiku-4-5" } },
    });
    expect(haiku.pricedAt).toEqual(haikuBefore.pricedAt);

    const sonnet = await ctx.db.aiModel.findUniqueOrThrow({
      where: { providerId_modelId: { providerId: "anthropic", modelId: "claude-sonnet-5" } },
    });
    expect(Number(sonnet.inputPricePerMTok)).toBe(3);
    expect(sonnet.pricedAt.getTime()).toBeGreaterThanOrEqual(haikuBefore.pricedAt.getTime());
  });

  it("keeps a stored price when none is sent, and starts an unpriced new model at 0", async () => {
    const unpriced = (modelId: string) => ({
      ...model(modelId),
      inputPricePerMTok: null,
      outputPricePerMTok: null,
    });
    await service.saveAiSetup(actor, {
      providerId: "anthropic",
      kind: "ANTHROPIC",
      models: [unpriced("claude-haiku-4-5"), unpriced("claude-sonnet-5"), unpriced("claude-new")],
      tiers: { light: "claude-haiku-4-5", standard: "claude-sonnet-5", heavy: "claude-new" },
    });

    const sonnet = await ctx.db.aiModel.findUniqueOrThrow({
      where: { providerId_modelId: { providerId: "anthropic", modelId: "claude-sonnet-5" } },
    });
    expect(Number(sonnet.inputPricePerMTok)).toBe(3);
    expect(Number(sonnet.outputPricePerMTok)).toBe(15);

    const fresh = await ctx.db.aiModel.findUniqueOrThrow({
      where: { providerId_modelId: { providerId: "anthropic", modelId: "claude-new" } },
    });
    expect(Number(fresh.inputPricePerMTok)).toBe(0);
    expect(Number(fresh.outputPricePerMTok)).toBe(0);

    // Put the suite's later expectations (two enabled Anthropic models) back.
    await service.saveAiSetup(actor, {
      providerId: "anthropic",
      kind: "ANTHROPIC",
      models: [model("claude-haiku-4-5"), model("claude-sonnet-5", 3, 15)],
      tiers: { light: "claude-haiku-4-5", standard: "claude-sonnet-5", heavy: "claude-sonnet-5" },
    });
  });

  it("creates a NEW row for another kind instead of reusing the named one, and needs its own key", async () => {
    await expect(
      service.saveAiSetup(actor, {
        providerId: "anthropic",
        kind: "DEEPSEEK",
        models: [model("deepseek-chat")],
        tiers: { light: "deepseek-chat", standard: "deepseek-chat", heavy: "deepseek-chat" },
      }),
    ).rejects.toBeInstanceOf(service.AiSetupKeyRequiredError);

    const saved = await service.saveAiSetup(actor, {
      providerId: "anthropic",
      kind: "DEEPSEEK",
      apiKey: "sk-deepseek",
      models: [model("deepseek-chat", 0.27, 1.1)],
      tiers: { light: "deepseek-chat", standard: "deepseek-chat", heavy: "deepseek-chat" },
    });

    expect(saved.id).not.toBe("anthropic");
    expect(saved).toMatchObject({ kind: "DEEPSEEK", label: "DeepSeek", isDefault: true });
    const anthropic = await ctx.db.aiProvider.findUniqueOrThrow({ where: { id: "anthropic" } });
    expect(anthropic.isDefault).toBe(false);
    // Its models are untouched by a save that was about another provider.
    expect(
      await ctx.db.aiModel.count({ where: { providerId: "anthropic", isEnabled: true } }),
    ).toBe(2);
  });

  it("switches back to Echo without touching models or tiers", async () => {
    await service.saveAiSetup(actor, {
      providerId: "echo",
      kind: "ECHO",
      models: [],
      tiers: { light: "", standard: "", heavy: "" },
    });
    const defaults = await ctx.db.aiProvider.findMany({ where: { isDefault: true } });
    expect(defaults.map((p) => p.id)).toEqual(["echo"]);
    const light = await ctx.db.setting.findUniqueOrThrow({ where: { key: "ai.model.light" } });
    expect(light.value).toBe("deepseek-chat");
  });
});

describe("saveAiUsageLimits", () => {
  it("writes the limits and leaves the tiers alone", async () => {
    await service.saveAiUsageLimits(actor, {
      enabled: true,
      maxTokensPerRequest: 1500,
      monthlyBudgetUsd: 25,
      budgetWarnPercent: 70,
      capBehavior: "NOTIFY_ONLY",
      rateLimitPerUserHour: 60,
    });
    const limits = await service.loadAiLimitsView();
    expect(limits).toMatchObject({
      enabled: true,
      maxTokensPerRequest: 1500,
      monthlyBudgetUsd: 25,
      capBehavior: "NOTIFY_ONLY",
    });
    expect(limits.tiers.light).toBe("deepseek-chat");
  });
});
