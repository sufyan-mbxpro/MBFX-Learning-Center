// ADR-179 #2: every footer line is data, and an absent value removes its line.
import { describe, expect, it } from "vitest";
import { localizeEmailShell, type EmailShellWords } from "./send.ts";

const words: EmailShellWords = {
  login: "Log in to your account",
  support: "Contact support",
  privacy: "Privacy policy",
  email: "Email",
  website: "Website",
  copyright: "© {year} {siteName}. All rights reserved.",
  sentTo: "This email was sent to {email}.",
  unsubscribeLine: "If you no longer wish to receive these emails, {link}.",
};

const context = {
  shell: { siteName: "MBX" },
  site: {
    origin: "https://mbx.test",
    contactEmail: "hello@mbx.test",
    privacyPath: "/legal/privacy",
  },
  globals: { year: "2026" },
};

describe("localizeEmailShell", () => {
  it("fills every line from the context, the words and the recipient", () => {
    const shell = localizeEmailShell(context, words, "en", "sam@example.com");
    expect(shell.homeUrl).toBe("https://mbx.test");
    expect(shell.links?.map((link) => link.url)).toEqual([
      "https://mbx.test/sign-in",
      "https://mbx.test/support",
      "https://mbx.test/legal/privacy",
    ]);
    expect(shell.contacts).toEqual([
      { label: "Email", value: "hello@mbx.test", url: "mailto:hello@mbx.test" },
      { label: "Website", value: "mbx.test", url: "https://mbx.test" },
    ]);
    // Copyright and "sent to" are ONE line, as the reference footer draws them.
    expect(shell.legalLines).toEqual([
      "© 2026 MBX. All rights reserved. This email was sent to sam@example.com.",
    ]);
    expect(shell.unsubscribeLine).toBe("If you no longer wish to receive these emails, {link}.");
  });

  it("prefixes a non-default language the way the public routing does", () => {
    const shell = localizeEmailShell(context, words, "ar");
    expect(shell.links?.[0]?.url).toBe("https://mbx.test/ar/sign-in");
    expect(shell.homeUrl).toBe("https://mbx.test/ar");
  });

  it("drops a line whose value is absent", () => {
    const shell = localizeEmailShell(
      { ...context, site: { origin: "https://mbx.test" } },
      { ...words, login: "" },
      "en",
    );
    // No privacy document, no login word: one link left.
    expect(shell.links?.map((link) => link.label)).toEqual(["Contact support"]);
    expect(shell.contacts?.map((row) => row.label)).toEqual(["Website"]);
    // No recipient: no "sent to" line.
    expect(shell.legalLines).toEqual(["© 2026 MBX. All rights reserved."]);
  });
});
