// The registry is the half of the email platform that lives in code, so a
// drift between a template's declared variables, its samples and what a body
// may say is exactly the failure this file exists to catch.
import { describe, expect, it } from "vitest";
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_KEYS,
  GLOBAL_EMAIL_VARIABLES,
  emailTemplateSaveSchema,
  emailTemplateVariables,
  emailTestSendSchema,
  emailTransportSaveSchema,
  findTemplateVariables,
  isEmailTemplateKey,
  isUrlEmailVariable,
  replaceTemplateVariables,
  type EmailTemplateKey,
} from "./email.ts";

const save = (overrides: Record<string, unknown> = {}) =>
  emailTemplateSaveSchema.safeParse({
    key: "auth.password_reset",
    locale: "en",
    subject: "Reset your password",
    mode: "RICH",
    bodyHtml: `<p>Hello {{recipient.name}}</p><a href="{{reset.url}}">Reset</a>`,
    ...overrides,
  });

describe("the registry", () => {
  it("has a key for every template and no stragglers", () => {
    expect(EMAIL_TEMPLATE_KEYS.length).toBe(Object.keys(EMAIL_TEMPLATES).length);
    expect(EMAIL_TEMPLATE_KEYS).toContain("auth.password_reset");
  });

  it.each(EMAIL_TEMPLATE_KEYS)("%s declares every variable it requires", (key) => {
    const definition = EMAIL_TEMPLATES[key];
    for (const name of definition.required) {
      expect(emailTemplateVariables(key)).toContain(name);
    }
  });

  it.each(EMAIL_TEMPLATE_KEYS)("%s has a sample value for every variable it allows", (key) => {
    // The preview and the test send run on these: a gap here is an admin
    // seeing literal braces the first time they open the editor.
    for (const name of emailTemplateVariables(key)) {
      expect(
        EMAIL_TEMPLATES[key].sample[name],
        `${key} is missing a sample for ${name}`,
      ).toBeTypeOf("string");
    }
  });

  it.each(EMAIL_TEMPLATE_KEYS)("%s samples a real http(s) URL for every URL variable", (key) => {
    for (const name of emailTemplateVariables(key)) {
      if (!isUrlEmailVariable(name)) continue;
      expect(() => new URL(EMAIL_TEMPLATES[key].sample[name] ?? "")).not.toThrow();
    }
  });

  it("gives every template the global variables", () => {
    for (const key of EMAIL_TEMPLATE_KEYS) {
      expect(emailTemplateVariables(key)).toEqual(
        expect.arrayContaining([...GLOBAL_EMAIL_VARIABLES]),
      );
    }
  });

  it("recognises only real keys", () => {
    expect(isEmailTemplateKey("auth.password_reset")).toBe(true);
    expect(isEmailTemplateKey("auth.made_up")).toBe(false);
    // An admin cannot mint a key by posting one (ADR-078 #5).
    expect(save({ key: "auth.made_up" }).success).toBe(false);
  });
});

describe("the variable vocabulary", () => {
  it("finds each variable once, in the order it appears", () => {
    expect(findTemplateVariables("{{b}} {{a}} {{b}}")).toEqual(["b", "a"]);
  });

  it("tolerates spacing inside the braces", () => {
    expect(findTemplateVariables("{{ reset.url }}")).toEqual(["reset.url"]);
  });

  it("ignores anything with logic in it", () => {
    // No loops, no conditionals, no arguments — ADR-078 #6.
    expect(findTemplateVariables("{{#if x}}{{/if}} {{a|upper}} {{ 1bad }}")).toEqual([]);
  });

  it("replaces with the same pattern it finds with", () => {
    expect(replaceTemplateVariables("{{a}}/{{ b }}", (name) => name.toUpperCase())).toBe("A/B");
  });
});

describe("emailTemplateSaveSchema", () => {
  it("accepts a body using declared variables", () => {
    expect(save().success).toBe(true);
  });

  it("refuses a variable the template does not declare", () => {
    expect(save({ bodyHtml: `<a href="{{reset.url}}">x</a> {{invoice.total}}` }).success).toBe(
      false,
    );
  });

  it("refuses a body missing a required variable", () => {
    // A password reset with no link is a dead end, and it fails on SAVE.
    expect(save({ bodyHtml: "<p>Someone asked to reset your password.</p>" }).success).toBe(false);
  });

  it("refuses CR/LF in the subject", () => {
    expect(save({ subject: "Reset\r\nBcc: evil@example.com" }).success).toBe(false);
  });

  it("refuses an empty body and an unknown mode", () => {
    expect(save({ bodyHtml: "" }).success).toBe(false);
    expect(save({ mode: "MARKDOWN" }).success).toBe(false);
  });

  it("allows a template with no required variables to say nothing", () => {
    const result = emailTemplateSaveSchema.safeParse({
      key: "auth.password_changed" satisfies EmailTemplateKey,
      locale: "en",
      subject: "Your password changed",
      mode: "RICH",
      bodyHtml: "<p>Your password was changed.</p>",
    });
    expect(result.success).toBe(true);
  });
});

describe("emailTransportSaveSchema", () => {
  const smtp = { driver: "SMTP", security: "STARTTLS", host: "smtp.example.com", port: 587 };

  it("accepts a complete SMTP row", () => {
    expect(emailTransportSaveSchema.safeParse(smtp).success).toBe(true);
  });

  it("requires a host and port for SMTP", () => {
    expect(emailTransportSaveSchema.safeParse({ ...smtp, host: undefined }).success).toBe(false);
    expect(emailTransportSaveSchema.safeParse({ ...smtp, port: undefined }).success).toBe(false);
  });

  it("needs neither for the log driver", () => {
    expect(emailTransportSaveSchema.safeParse({ driver: "LOG", security: "NONE" }).success).toBe(
      true,
    );
  });

  it("refuses a port outside the range", () => {
    expect(emailTransportSaveSchema.safeParse({ ...smtp, port: 0 }).success).toBe(false);
    expect(emailTransportSaveSchema.safeParse({ ...smtp, port: 70000 }).success).toBe(false);
  });

  it("treats an empty password as 'keep the stored one'", () => {
    const result = emailTransportSaveSchema.safeParse({ ...smtp, password: "" });
    expect(result.success).toBe(true);
  });
});

describe("emailTestSendSchema", () => {
  it("needs a real key and a real address", () => {
    expect(
      emailTestSendSchema.safeParse({ key: "auth.password_reset", locale: "en", to: "x@e.com" })
        .success,
    ).toBe(true);
    expect(
      emailTestSendSchema.safeParse({ key: "auth.password_reset", locale: "en", to: "nope" })
        .success,
    ).toBe(false);
    expect(
      emailTestSendSchema.safeParse({ key: "made.up", locale: "en", to: "x@e.com" }).success,
    ).toBe(false);
  });
});
