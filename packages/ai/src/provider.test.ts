// ADR-098 (b) — **one reader**, asserted as a source guard rather than as
// behaviour.
//
// `media.test.ts` set this precedent: some invariants are about which FILE does
// something, and no runtime assertion can express that. A second reader of
// `apiKeyCipher` is a schema-level mistake, not a style one — it is a second
// shape through which a credential can reach a caller — so it fails here, in
// the diff that adds it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { normalizeBaseUrl } from "./provider.ts";
import { echoDriver } from "./drivers/echo.ts";

const SRC = dirname(fileURLToPath(import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") && !full.endsWith(".test.ts") ? [full] : [];
  });
}

describe("the sealed key has exactly one reader", () => {
  it("names apiKeyCipher in provider.ts and nowhere else", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => readFileSync(file, "utf8").includes("apiKeyCipher"))
      .map((file) => relative(SRC, file).replaceAll("\\", "/"));

    expect(offenders).toEqual(["provider.ts"]);
  });

  it("exports no driver from the package's own door", () => {
    // ADR-097 #2: `runAiTask` / `streamAiTask` are the only exports that reach
    // a provider. A leaked `export { anthropicDriver }` would give a feature a
    // second way in, and with it a way to skip the meter.
    //
    // Comments are stripped before the check, because the claim is about
    // EXPORTS: `index.ts` names `loadProviderDriver` in prose precisely to say
    // it is not exported, and a guard that failed on that would teach the next
    // person to delete the explanation.
    const index = readFileSync(join(SRC, "index.ts"), "utf8")
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/\/\/.*$/gm, "");
    for (const leak of ["anthropicDriver", "openAiDriver", "echoDriver", "loadProviderDriver"]) {
      expect(index, `index.ts must not export ${leak}`).not.toContain(leak);
    }
  });

  it("keeps the memory driver off the public surface", () => {
    // `testing.ts` is reachable as `@repo/ai/testing`, which is a different
    // import and an obvious one in a diff.
    expect(readFileSync(join(SRC, "index.ts"), "utf8")).not.toContain("./testing.ts");
  });
});

describe("normalizeBaseUrl", () => {
  it("strips trailing slashes", () => {
    // The market driver's bug (DEVLOG 2026-09-14): a URL copied out of a
    // browser address bar ends in "/", the SDK appends its own path, and the
    // resulting "//v1/messages" fails in a way that reads exactly like a
    // rejected API key.
    expect(normalizeBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
    expect(normalizeBaseUrl("https://api.example.com///")).toBe("https://api.example.com");
  });

  it("leaves a clean origin alone", () => {
    expect(normalizeBaseUrl("https://api.example.com")).toBe("https://api.example.com");
  });

  it("treats empty, null and slashes-only as 'no override'", () => {
    expect(normalizeBaseUrl(null)).toBeUndefined();
    expect(normalizeBaseUrl("")).toBeUndefined();
    expect(normalizeBaseUrl("///")).toBeUndefined();
  });
});

describe("the echo driver", () => {
  const request = {
    modelId: "echo",
    system: "system",
    messages: [{ role: "user" as const, content: "hello" }],
    maxOutputTokens: 100,
    effort: "low" as const,
  };

  it("labels its output as a placeholder, so nobody mistakes it for a suggestion", async () => {
    const result = await echoDriver().complete(request);
    expect(result.text).toContain("Echo provider");
    expect(result.text).toContain("placeholder");
  });

  it("streams in pieces and carries usage on the last chunk", async () => {
    const chunks = [];
    for await (const chunk of echoDriver().stream(request)) chunks.push(chunk);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.at(-1)?.usage).toBeDefined();
    expect(chunks.slice(0, -1).every((c) => c.text !== undefined)).toBe(true);
  });

  it("passes its own connection test — there is nothing to reach", async () => {
    await expect(echoDriver().test()).resolves.toBeUndefined();
  });
});
