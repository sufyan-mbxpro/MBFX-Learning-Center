import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_AUDIENCES,
  CUSTOM_EMAIL_AUDIENCES,
  announcementSaveSchema,
  audiencesForKind,
  isContentKind,
} from "./announcements.ts";
import {
  CAMPAIGN_EMAILS,
  CAMPAIGN_EMAIL_KEYS,
  CAMPAIGN_EMAIL_KEY_FOR_KIND,
  CUSTOM_EMAIL_VARIABLES,
  EMAIL_BODY_MAX,
  campaignContentSchema,
  customEmailSaveSchema,
  directEmailSchema,
  emailDesignSaveSchema,
  isCampaignEmailKey,
} from "./custom-emails.ts";
import { EMAIL_TEMPLATES } from "./email.ts";

const content = {
  locale: "en",
  subject: "Hello {{recipient.name}}",
  mode: "RICH" as const,
  bodyHtml: "<p>Visit {{site.name}}</p>",
};

function issues(result: { success: boolean; error?: { issues: unknown[] } }) {
  return result.success ? [] : (result.error?.issues ?? []);
}

describe("the campaign keys (ADR-172 #4)", () => {
  it("are their own registry, never template keys", () => {
    for (const key of CAMPAIGN_EMAIL_KEYS) {
      expect(Object.keys(EMAIL_TEMPLATES)).not.toContain(key);
      expect(isCampaignEmailKey(key)).toBe(true);
      expect(CAMPAIGN_EMAILS[key].required).toContain("unsubscribe.url");
    }
    expect(isCampaignEmailKey("auth.password_reset")).toBe(false);
    expect(Object.values(CAMPAIGN_EMAIL_KEY_FOR_KIND).sort()).toEqual(
      [...CAMPAIGN_EMAIL_KEYS].sort(),
    );
  });

  it("allow the globals and the unsubscribe link, nothing else", () => {
    expect(CUSTOM_EMAIL_VARIABLES).toContain("recipient.name");
    expect(CUSTOM_EMAIL_VARIABLES).toContain("unsubscribe.url");
    expect(CUSTOM_EMAIL_VARIABLES).not.toContain("reset.url");
  });
});

describe("audiences per kind (ADR-172 #5)", () => {
  it("offers Staff to a custom email only", () => {
    expect(audiencesForKind("CUSTOM")).toContain("staff");
    expect(audiencesForKind("COURSE")).not.toContain("staff");
    expect(audiencesForKind("COURSE")).toEqual(ANNOUNCEMENT_AUDIENCES);
    expect(audiencesForKind("DIRECT")).toEqual([]);
    expect(CUSTOM_EMAIL_AUDIENCES).toEqual([...ANNOUNCEMENT_AUDIENCES, "staff"]);
  });

  it("refuses Staff on a course announcement's save", () => {
    const base = { kind: "COURSE", targetId: "c1", name: "Launch" };
    expect(
      announcementSaveSchema.safeParse({ ...base, audience: { keys: ["staff"] } }).success,
    ).toBe(false);
    expect(
      announcementSaveSchema.safeParse({ ...base, audience: { keys: ["verified"] } }).success,
    ).toBe(true);
  });

  it("knows which kinds are about content", () => {
    expect(isContentKind("COURSE")).toBe(true);
    expect(isContentKind("CUSTOM")).toBe(false);
    expect(isContentKind("DIRECT")).toBe(false);
  });
});

describe("an author's words (ADR-172 #2)", () => {
  it("accepts a RICH body with allowed variables", () => {
    expect(campaignContentSchema.safeParse(content).success).toBe(true);
  });

  it("names an unknown variable, in the subject or the body", () => {
    const inBody = campaignContentSchema.safeParse({
      ...content,
      bodyHtml: "<p>{{reset.url}}</p>",
    });
    expect(issues(inBody)).toEqual([
      expect.objectContaining({ params: { variable: "reset.url" } }),
    ]);
    const inSubject = campaignContentSchema.safeParse({ ...content, subject: "{{course.title}}" });
    expect(inSubject.success).toBe(false);
  });

  it("makes an HTML document carry its own unsubscribe link", () => {
    const html = { ...content, mode: "HTML" as const, bodyHtml: "<html><body>Hi</body></html>" };
    expect(issues(campaignContentSchema.safeParse(html))).toEqual([
      expect.objectContaining({ params: { missing: "unsubscribe.url" } }),
    ]);
    expect(
      campaignContentSchema.safeParse({
        ...html,
        bodyHtml: '<html><body><a href="{{unsubscribe.url}}">Stop</a></body></html>',
      }).success,
    ).toBe(true);
  });

  it("refuses a subject that would add a header, an empty subject, and an oversized body", () => {
    expect(
      campaignContentSchema.safeParse({ ...content, subject: "Hi\r\nBcc: all@example.com" })
        .success,
    ).toBe(false);
    expect(campaignContentSchema.safeParse({ ...content, subject: "  " }).success).toBe(false);
    expect(
      campaignContentSchema.safeParse({ ...content, bodyHtml: "x".repeat(EMAIL_BODY_MAX + 1) })
        .success,
    ).toBe(false);
  });

  it("turns an empty preheader into null", () => {
    const parsed = campaignContentSchema.parse({ ...content, preheader: "" });
    expect(parsed.preheader).toBeNull();
  });
});

describe("the composer's save", () => {
  it("may carry a name alone, words, an audience, or all three", () => {
    expect(customEmailSaveSchema.safeParse({ name: "Notice" }).success).toBe(true);
    expect(
      customEmailSaveSchema.safeParse({
        name: "Notice",
        designId: null,
        content,
        audience: { keys: ["staff", "subscribers"] },
      }).success,
    ).toBe(true);
    expect(customEmailSaveSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("a design", () => {
  it("has a name and a body, and the same variable rules", () => {
    const design = {
      name: "Monthly",
      mode: "RICH" as const,
      bodyHtml: "<p>{{recipient.name}}</p>",
    };
    const parsed = emailDesignSaveSchema.parse(design);
    expect(parsed).toMatchObject({ description: null, subject: null, preheader: null });
    expect(emailDesignSaveSchema.safeParse({ ...design, name: "" }).success).toBe(false);
    expect(
      emailDesignSaveSchema.safeParse({ ...design, bodyHtml: "<p>{{nope}}</p>" }).success,
    ).toBe(false);
  });
});

describe("a direct email (ADR-172 #6)", () => {
  const direct = {
    recipient: { kind: "user", id: "u1" },
    subject: "About your account",
    mode: "RICH" as const,
    bodyHtml: "<p>Hi</p>",
    replyToSelf: false,
  };

  it("names a user or a subscriber, nothing else", () => {
    expect(directEmailSchema.safeParse(direct).success).toBe(true);
    expect(
      directEmailSchema.safeParse({ ...direct, recipient: { kind: "subscriber", id: "s1" } })
        .success,
    ).toBe(true);
    expect(
      directEmailSchema.safeParse({ ...direct, recipient: { kind: "email", id: "a@b.c" } }).success,
    ).toBe(false);
    expect(
      directEmailSchema.safeParse({ ...direct, recipient: { kind: "user", id: "u1", x: 1 } })
        .success,
    ).toBe(false);
  });

  it("holds the same variable rules as a campaign", () => {
    expect(
      directEmailSchema.safeParse({ ...direct, bodyHtml: "<p>{{reset.url}}</p>" }).success,
    ).toBe(false);
  });
});
