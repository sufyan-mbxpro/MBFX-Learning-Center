// The taxonomy is what the usage row stores and what the admin screen renders,
// so the mapping from "something went wrong" to one of these strings is worth
// pinning: a provider error that fell through to `provider_error` when it was
// really a bad key sends an admin to the wrong screen.
import { describe, expect, it } from "vitest";

import { AI_REASONS, AiError, classifyProviderError, isRefusalReason } from "./errors.ts";

describe("the reason taxonomy", () => {
  it("is closed and has no duplicates", () => {
    expect(new Set(AI_REASONS).size).toBe(AI_REASONS.length);
  });

  it("separates what we refused from what the provider did", () => {
    expect(isRefusalReason("budget_exceeded")).toBe(true);
    expect(isRefusalReason("globally_disabled")).toBe(true);
    // A provider failure is not a refusal: something was called, and it may
    // well have been billed.
    expect(isRefusalReason("provider_error")).toBe(false);
    expect(isRefusalReason("aborted")).toBe(false);
  });

  it("names a model that cannot read images, rather than calling the image too large", () => {
    // Regression: `runAiTask` refused an image for a model without vision as
    // `content_too_large`, so alt text on a small photo said "too large".
    expect(AI_REASONS).toContain("model_no_vision");
    expect(isRefusalReason("model_no_vision")).toBe(true);
  });
});

describe("AiError", () => {
  it("carries the reason separately from the developer message", () => {
    const error = new AiError("provider_auth", "401 from https://api.example.com");
    expect(error.reason).toBe("provider_auth");
    expect(error.name).toBe("AiError");
    // Nothing downstream renders `message`: it can quote a URL, a header, or in
    // the worst case the prompt. `reason` is what the screen and the row use.
    expect(error.message).not.toBe(error.reason);
  });

  it("falls back to the reason when there is nothing else to say", () => {
    expect(new AiError("rate_limited").message).toBe("rate_limited");
  });
});

describe("classifyProviderError", () => {
  it("passes an AiError's own reason straight through", () => {
    expect(classifyProviderError(new AiError("missing_key"))).toBe("missing_key");
  });

  it("reads an abort as the client going away, not a provider fault", () => {
    // It is the one case that still meters what was billed.
    expect(classifyProviderError({ name: "AbortError" })).toBe("aborted");
    expect(classifyProviderError({ name: "APIUserAbortError" })).toBe("aborted");
  });

  it("maps a timeout by name and by status", () => {
    expect(classifyProviderError({ name: "APIConnectionTimeoutError" })).toBe("provider_timeout");
    expect(classifyProviderError({ name: "TimeoutError" })).toBe("provider_timeout");
    expect(classifyProviderError({ status: 408 })).toBe("provider_timeout");
  });

  it("maps auth failures, which are the ones an admin can actually fix", () => {
    expect(classifyProviderError({ status: 401 })).toBe("provider_auth");
    expect(classifyProviderError({ status: 403 })).toBe("provider_auth");
  });

  it("maps rate limiting and oversize payloads", () => {
    expect(classifyProviderError({ status: 429 })).toBe("provider_rate_limit");
    expect(classifyProviderError({ status: 413 })).toBe("content_too_large");
  });

  it("falls back to provider_error for anything else", () => {
    expect(classifyProviderError({ status: 500 })).toBe("provider_error");
    expect(classifyProviderError(new Error("boom"))).toBe("provider_error");
    expect(classifyProviderError(undefined)).toBe("provider_error");
    expect(classifyProviderError("a string")).toBe("provider_error");
  });
});
