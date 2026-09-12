// The email admin service against real MariaDB (ADR-078 Enforcement).
//
// The property this file exists for is the first one: **the transport view
// never carries the password**, at runtime AND at the type level. A runtime
// assertion alone would pass the day someone adds the property and forgets to
// populate it in one branch; a type assertion alone would pass if the object
// carried an extra key the type did not declare. Both, or neither is worth much.
//
// The rest covers what a screen cannot be trusted to remember: an empty
// password means KEEP, the source-hash flip marks siblings OUTDATED, reset goes
// back to the seeded words, and the delivery log pages by cursor.
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import { EMAIL_TEMPLATE_DEFAULTS } from "@repo/db";
import type * as EmailAdminModule from "./email-admin.ts";
import {
  makeActor,
  startCmsTestDb,
  stopCmsTestDb,
  type CmsTestContext,
} from "./test-utils/cms-container.ts";

let ctx: CmsTestContext;
let service: typeof EmailAdminModule;
let actor: Awaited<ReturnType<typeof makeActor>>;

const KEY = "auth.password_reset";

beforeAll(async () => {
  // `sealSecret` refuses to fall back to plaintext, so the key has to exist
  // before @repo/email is loaded by anything in this suite.
  process.env.EMAIL_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");
  ctx = await startCmsTestDb();
  service = await import("./email-admin.ts");
  actor = await makeActor(ctx.db, "email-admin-actor", [
    "email.settings.manage",
    "email.templates.update",
  ]);

  // The seed's own rows, written the way `prisma/seed.ts` writes them.
  for (const template of EMAIL_TEMPLATE_DEFAULTS) {
    await ctx.db.emailTemplate.create({ data: { key: template.key } });
    await ctx.db.emailTemplateTranslation.create({
      data: {
        templateKey: template.key,
        locale: "en",
        subject: template.subject,
        preheader: template.preheader,
        mode: "RICH",
        bodyHtml: template.bodyHtml,
        translationStatus: "TRANSLATED",
      },
    });
  }
}, 180_000);

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

// ─── The sealed password ─────────────────────────────────────

describe("the transport view never carries the password (ADR-078 #3)", () => {
  it("has no password property in its TYPE", () => {
    // The leak has to get past the type, not just past a reviewer.
    expectTypeOf<EmailAdminModule.EmailTransportView>().not.toHaveProperty("password");
    expectTypeOf<EmailAdminModule.EmailTransportView>().not.toHaveProperty("passwordCipher");
  });

  it("reports a saved password as a boolean and never returns its value", async () => {
    await service.saveEmailTransport(actor, {
      driver: "SMTP",
      host: "smtp.example.test",
      port: 587,
      security: "STARTTLS",
      username: "mailer",
      password: "s3cret-value",
    });

    const view = await service.loadEmailTransportView();
    expect(view.hasPassword).toBe(true);
    expect(view.host).toBe("smtp.example.test");
    // Not "no `password` key" — no VALUE anywhere in the object, however named.
    expect(JSON.stringify(view)).not.toContain("s3cret-value");

    // And it really was sealed, not dropped: the column holds versioned
    // ciphertext, never the plaintext.
    const row = await ctx.db.emailTransport.findUnique({ where: { id: "default" } });
    expect(row?.passwordCipher?.startsWith("v1:")).toBe(true);
    expect(row?.passwordCipher).not.toContain("s3cret-value");
  });

  it("an empty password keeps the stored cipher, because the field is write-only", async () => {
    const before = await ctx.db.emailTransport.findUnique({ where: { id: "default" } });

    await service.saveEmailTransport(actor, {
      driver: "SMTP",
      host: "smtp.example.test",
      port: 2525,
      security: "TLS",
      username: "mailer",
      password: "",
    });

    const after = await ctx.db.emailTransport.findUnique({ where: { id: "default" } });
    expect(after?.port).toBe(2525);
    expect(after?.passwordCipher).toBe(before?.passwordCipher);
    expect((await service.loadEmailTransportView()).hasPassword).toBe(true);
  });

  it("clearPassword is the only way to remove one", async () => {
    await service.saveEmailTransport(actor, {
      driver: "SMTP",
      host: "smtp.example.test",
      port: 2525,
      security: "TLS",
      username: "mailer",
      clearPassword: true,
    });
    expect((await service.loadEmailTransportView()).hasPassword).toBe(false);
  });

  it("the audit row records the host and that the password changed, never the password", async () => {
    await service.saveEmailTransport(actor, {
      driver: "SMTP",
      host: "smtp.elsewhere.test",
      port: 465,
      security: "TLS",
      password: "another-secret",
    });

    const audit = await ctx.db.auditLog.findFirst({
      where: { action: "email.transport.update" },
      orderBy: { createdAt: "desc" },
    });
    const serialized = JSON.stringify(audit?.changes);
    expect(serialized).toContain("smtp.elsewhere.test");
    expect(serialized).toContain("passwordChanged");
    expect(serialized).not.toContain("another-secret");
  });

  it("a new host drops the last verification, because it proved a different server", async () => {
    await ctx.db.emailTransport.update({
      where: { id: "default" },
      data: { lastVerifiedAt: new Date(), lastError: null },
    });
    await service.saveEmailTransport(actor, {
      driver: "SMTP",
      host: "smtp.third.test",
      port: 465,
      security: "TLS",
    });
    expect((await service.loadEmailTransportView()).lastVerifiedAt).toBeNull();
  });
});

// ─── Templates ───────────────────────────────────────────────

describe("the template list is registry-driven", () => {
  it("returns every declared template, and reports per-locale state", async () => {
    const rows = await service.listEmailTemplates(["en", "es"]);
    expect(rows).toHaveLength(EMAIL_TEMPLATE_DEFAULTS.length);

    const reset = rows.find((row) => row.key === KEY);
    expect(reset?.critical).toBe(true);
    expect(reset?.isActive).toBe(true);
    // `es` has no row, and "missing" is a different state from "out of date".
    expect(reset?.locales.find((l) => l.locale === "es")?.state).toBe("missing");
    expect(reset?.locales.find((l) => l.locale === "en")?.state).toBe("current");
  });

  it("a staff-audience template reports one locale, whatever it is asked for", () => {
    // No template is `staff` today — this pins the RULE rather than a row, so
    // the first staff-only template cannot quietly grow translation slots.
    expect(service.isTranslatedAudience("staff")).toBe(false);
    expect(service.isTranslatedAudience("public")).toBe(true);
    // `any` reaches learners too, so it IS translated — the case worth pinning.
    expect(service.isTranslatedAudience("any")).toBe(true);
  });
});

describe("saving a template", () => {
  it("sanitises the body on save, not only on render (security.md #8)", async () => {
    await service.saveEmailTemplate(actor, {
      key: KEY,
      locale: "en",
      subject: "Reset your password",
      mode: "RICH",
      bodyHtml: '<p onclick="steal()">Hello</p><script>alert(1)</script><p>{{reset.url}}</p>',
    });

    const row = await ctx.db.emailTemplateTranslation.findUnique({
      where: { templateKey_locale: { templateKey: KEY, locale: "en" } },
    });
    expect(row?.bodyHtml).not.toContain("<script");
    expect(row?.bodyHtml).not.toContain("onclick");
    expect(row?.bodyHtml).toContain("{{reset.url}}");
  });

  it("a source edit flips its siblings OUTDATED (ADR-069's rule, applied here)", async () => {
    await ctx.db.emailTemplateTranslation.create({
      data: {
        templateKey: KEY,
        locale: "es",
        subject: "Restablece tu contraseña",
        mode: "RICH",
        bodyHtml: "<p>{{reset.url}}</p>",
        translationStatus: "TRANSLATED",
        // Translated against whatever the source hash is right now.
        sourceHash: (
          await ctx.db.emailTemplateTranslation.findUnique({
            where: { templateKey_locale: { templateKey: KEY, locale: "en" } },
            select: { sourceHash: true },
          })
        )?.sourceHash,
      },
    });

    await service.saveEmailTemplate(actor, {
      key: KEY,
      locale: "en",
      // Only the PREHEADER moves — the hash covers every prose field, so a
      // change nobody would call "the body" still marks translations stale.
      subject: "Reset your password",
      preheader: "This link expires soon.",
      mode: "RICH",
      bodyHtml: "<p>{{reset.url}}</p>",
    });

    const sibling = await ctx.db.emailTemplateTranslation.findUnique({
      where: { templateKey_locale: { templateKey: KEY, locale: "es" } },
    });
    expect(sibling?.translationStatus).toBe("OUTDATED");

    const detail = await service.loadEmailTemplate(KEY);
    expect(detail?.translations.find((t) => t.locale === "es")?.state).toBe("outdated");
  });

  it("writes sender overrides and the content in one transaction", async () => {
    await service.saveEmailTemplate(actor, {
      key: KEY,
      locale: "en",
      subject: "Reset your password",
      mode: "RICH",
      bodyHtml: "<p>{{reset.url}}</p>",
      fromName: "MBX Security",
      fromEmail: "security@example.test",
    });
    const detail = await service.loadEmailTemplate(KEY);
    expect(detail?.fromName).toBe("MBX Security");
    expect(detail?.fromEmail).toBe("security@example.test");
  });
});

describe("switching a template off", () => {
  it("is allowed, and recorded with whether it was critical", async () => {
    await service.setEmailTemplateActive(actor, KEY, false);
    expect((await service.loadEmailTemplate(KEY))?.isActive).toBe(false);

    const audit = await ctx.db.auditLog.findFirst({
      where: { action: "email.template.deactivate" },
      orderBy: { createdAt: "desc" },
    });
    expect(JSON.stringify(audit?.changes)).toContain("critical");

    await service.setEmailTemplateActive(actor, KEY, true);
  });

  it("refuses a key the registry does not declare", async () => {
    await expect(
      service.setEmailTemplateActive(actor, "auth.not_a_template", false),
    ).rejects.toThrow(/not a template/);
  });
});

describe("reset to default", () => {
  it("restores the seeded words for the default locale", async () => {
    await service.saveEmailTemplate(actor, {
      key: KEY,
      locale: "en",
      subject: "Something an admin typed",
      mode: "RICH",
      bodyHtml: "<p>{{reset.url}}</p>",
    });
    await service.resetEmailTemplate(actor, KEY, "en");

    const row = await ctx.db.emailTemplateTranslation.findUnique({
      where: { templateKey_locale: { templateKey: KEY, locale: "en" } },
    });
    const seeded = EMAIL_TEMPLATE_DEFAULTS.find((t) => t.key === KEY);
    expect(row?.subject).toBe(seeded?.subject);
    expect(row?.bodyHtml).toBe(seeded?.bodyHtml);
  });

  it("DELETES a non-default locale rather than filling it with English", async () => {
    // A template's default in `es` is not "the English words under an es row":
    // that reports as translated and never gets corrected.
    await service.resetEmailTemplate(actor, KEY, "es");
    const row = await ctx.db.emailTemplateTranslation.findUnique({
      where: { templateKey_locale: { templateKey: KEY, locale: "es" } },
    });
    expect(row).toBeNull();
  });
});

// ─── The delivery log ────────────────────────────────────────

describe("the delivery log pages by cursor", () => {
  beforeAll(async () => {
    const base = Date.UTC(2026, 8, 1);
    await ctx.db.emailDelivery.createMany({
      data: Array.from({ length: 7 }, (_, index) => ({
        templateKey: KEY,
        to: `person-${index}@example.test`,
        locale: "en",
        subject: "Reset your password",
        status: index % 3 === 0 ? ("FAILED" as const) : ("SENT" as const),
        isTest: index === 6,
        createdAt: new Date(base + index * 1000),
      })),
    });
  });

  it("walks every row exactly once across pages", async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await service.listEmailDeliveries({ limit: 3, ...(cursor ? { cursor } : {}) });
      seen.push(...page.items.map((row) => row.to));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
  });

  it("filters by status and by recipient, and counts by status", async () => {
    const failed = await service.listEmailDeliveries({ limit: 50, status: "FAILED" });
    expect(failed.items.every((row) => row.status === "FAILED")).toBe(true);
    expect(failed.items).toHaveLength(3);

    const one = await service.listEmailDeliveries({ limit: 50, q: "person-4@" });
    expect(one.items.map((row) => row.to)).toEqual(["person-4@example.test"]);

    const counts = await service.countEmailDeliveries();
    expect(counts.failed).toBe(3);
    expect(counts.sent).toBe(4);
  });

  it("the row shape carries no body and no variables (ADR-078 #10)", async () => {
    const page = await service.listEmailDeliveries({ limit: 1 });
    const row = page.items[0]!;
    expect(Object.keys(row).sort()).toEqual(
      [
        "createdAt",
        "id",
        "isTest",
        "locale",
        "reason",
        "status",
        "subject",
        "templateKey",
        "to",
      ].sort(),
    );
  });
});
