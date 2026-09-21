// ADR-120 — the provider preset registry and the guided-setup schemas.
//
// A new vendor is a registry row, a catalog name and a migration. These are
// the properties the row has to satisfy for the driver seam to build a working
// client from it without a branch on the kind.
import { describe, expect, it } from "vitest";

import {
  AI_PROVIDER_KINDS,
  AI_PROVIDER_PRESETS,
  aiConnectionTestSchema,
  aiProviderSchema,
  aiSetupSchema,
  aiUsageLimitsSchema,
} from "./ai.ts";

const model = (modelId: string) => ({
  modelId,
  label: modelId,
  inputPricePerMTok: 1,
  outputPricePerMTok: 5,
  cachedInputPricePerMTok: null,
  maxOutputTokens: 8192,
  supportsVision: false,
});

const setup = (overrides: Record<string, unknown> = {}) => ({
  kind: "ANTHROPIC",
  apiKey: "sk-ant-test",
  models: [model("claude-haiku-4-5"), model("claude-sonnet-5")],
  tiers: { light: "claude-haiku-4-5", standard: "claude-sonnet-5", heavy: "claude-sonnet-5" },
  ...overrides,
});

describe("AI_PROVIDER_PRESETS", () => {
  it("has exactly one preset per kind, keyed by that kind", () => {
    expect(Object.keys(AI_PROVIDER_PRESETS).sort()).toEqual([...AI_PROVIDER_KINDS].sort());
    for (const kind of AI_PROVIDER_KINDS) expect(AI_PROVIDER_PRESETS[kind].kind).toBe(kind);
  });

  it("gives every compatible vendor an endpoint, unless it requires the admin's", () => {
    // OPENAI has the SDK's own host; every OTHER openai-protocol kind would
    // otherwise send its key to api.openai.com.
    for (const preset of Object.values(AI_PROVIDER_PRESETS)) {
      if (preset.protocol !== "openai" || preset.kind === "OPENAI") continue;
      expect(
        preset.baseUrlRequired || preset.defaultBaseUrl !== null,
        `${preset.kind} needs a defaultBaseUrl or baseUrlRequired`,
      ).toBe(true);
    }
  });

  it("serves every default endpoint over https without a trailing slash", () => {
    for (const preset of Object.values(AI_PROVIDER_PRESETS)) {
      if (!preset.defaultBaseUrl) continue;
      expect(preset.defaultBaseUrl).toMatch(/^https:\/\//);
      expect(preset.defaultBaseUrl.endsWith("/")).toBe(false);
    }
  });

  it("links only to https consoles", () => {
    for (const preset of Object.values(AI_PROVIDER_PRESETS)) {
      if (preset.consoleUrl) expect(preset.consoleUrl).toMatch(/^https:\/\//);
    }
  });

  it("keeps max_completion_tokens for OpenAI, whose reasoning models reject max_tokens", () => {
    expect(AI_PROVIDER_PRESETS.OPENAI.maxTokensParam).toBe("max_completion_tokens");
  });

  it("proves an OpenRouter key on a path that requires one", () => {
    // Its `/models` is public, so listing it would pass on any string.
    expect(AI_PROVIDER_PRESETS.OPENROUTER.keyCheckPath).toBe("/key");
  });

  it("gives every provider a stored default name", () => {
    for (const preset of Object.values(AI_PROVIDER_PRESETS)) {
      expect(preset.defaultLabel.length).toBeGreaterThan(0);
      expect(preset.defaultLabel.length).toBeLessThanOrEqual(80);
    }
  });
});

describe("aiSetupSchema", () => {
  it("accepts a provider, its models and three tiers that name them", () => {
    expect(aiSetupSchema.safeParse(setup()).success).toBe(true);
  });

  it("refuses a tier naming a model the save does not enable", () => {
    const result = aiSetupSchema.safeParse(
      setup({
        tiers: { light: "claude-haiku-4-5", standard: "claude-sonnet-5", heavy: "gpt-5.1" },
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["tiers.heavy"]);
  });

  it("refuses an empty tier and an empty model list for a real provider", () => {
    const result = aiSetupSchema.safeParse(
      setup({ models: [], tiers: { light: "", standard: "", heavy: "" } }),
    );
    const paths = result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
    expect(paths).toContain("models");
    expect(paths).toContain("tiers.light");
  });

  it("refuses the same model twice", () => {
    const result = aiSetupSchema.safeParse(
      setup({
        models: [model("claude-haiku-4-5"), model("claude-haiku-4-5"), model("claude-sonnet-5")],
      }),
    );
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("models.1.modelId");
  });

  it("accepts a model with no price — the setup screen does not ask for one", () => {
    const result = aiSetupSchema.safeParse(
      setup({
        models: [
          { ...model("claude-haiku-4-5"), inputPricePerMTok: null, outputPricePerMTok: null },
          model("claude-sonnet-5"),
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("still refuses a price that is not a number", () => {
    const result = aiSetupSchema.safeParse(
      setup({
        models: [
          { ...model("claude-haiku-4-5"), inputPricePerMTok: Number.NaN },
          model("claude-sonnet-5"),
        ],
      }),
    );
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(
      "models.0.inputPricePerMTok",
    );
  });

  it("lets Echo through with no models and no tiers", () => {
    const result = aiSetupSchema.safeParse(
      setup({
        kind: "ECHO",
        apiKey: undefined,
        models: [],
        tiers: { light: "", standard: "", heavy: "" },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("requires a base URL for the custom gateway and nowhere else", () => {
    const custom = setup({ kind: "OPENAI_COMPATIBLE" });
    expect(aiSetupSchema.safeParse(custom).error?.issues[0]?.path).toEqual(["baseUrl"]);
    expect(
      aiSetupSchema.safeParse({ ...custom, baseUrl: "https://llm.example.com/v1" }).success,
    ).toBe(true);
    expect(aiSetupSchema.safeParse(setup({ kind: "GOOGLE" })).success).toBe(true);
  });
});

describe("the connection test and provider schemas", () => {
  it("apply the same base-URL rule", () => {
    expect(aiConnectionTestSchema.safeParse({ kind: "OPENAI_COMPATIBLE" }).success).toBe(false);
    expect(aiConnectionTestSchema.safeParse({ kind: "DEEPSEEK", apiKey: "sk" }).success).toBe(true);
    expect(
      aiProviderSchema.safeParse({
        kind: "OPENAI_COMPATIBLE",
        label: "Gateway",
        isEnabled: true,
        isDefault: false,
      }).success,
    ).toBe(false);
  });
});

describe("aiUsageLimitsSchema", () => {
  it("is the limits without the three tiers", () => {
    const result = aiUsageLimitsSchema.safeParse({
      enabled: true,
      maxTokensPerRequest: 2000,
      monthlyBudgetUsd: 50,
      budgetWarnPercent: 80,
      capBehavior: "DISABLE",
      rateLimitPerUserHour: 120,
      modelLight: "ignored",
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("modelLight");
  });
});
