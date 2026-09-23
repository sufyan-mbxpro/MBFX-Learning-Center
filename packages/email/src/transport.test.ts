// The config mapping is the security-relevant half of the SMTP driver, and
// its failure mode is invisible at runtime: mail still goes out, just not
// encrypted. The drivers themselves are checked against a real server in
// transport.integration.test.ts.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logDriver,
  sendgridDriver,
  sendgridKeyShapeNote,
  sendgridMailBody,
  smtpTransportOptions,
} from "./transport.ts";
import { memoryDriver } from "./testing.ts";

const BASE = { host: "smtp.example.com", port: 587 };

// Built from repeats rather than written out: these are the right LENGTHS and
// obviously not keys, which is what a secret scanner should conclude too.
const REAL_SHAPE_KEY = `SG.${"a".repeat(22)}.${"b".repeat(43)}`;
/** What a paste that took in the neighbouring token leaves behind. */
const TOO_LONG_KEY = `${REAL_SHAPE_KEY}${"c".repeat(8)}`;

const message = {
  to: "learner@example.com",
  from: { name: "MBX", address: "no-reply@example.com" },
  subject: "Reset your password",
  html: "<p>hi</p>",
  text: "hi",
};

describe("smtpTransportOptions", () => {
  it("treats TLS as connect-time encryption", () => {
    const options = smtpTransportOptions({ ...BASE, port: 465, security: "TLS" });
    expect(options.secure).toBe(true);
    expect(options.requireTLS).toBe(false);
  });

  it("makes a STARTTLS upgrade mandatory, not optional", () => {
    // Without requireTLS, nodemailer carries on in the clear when the server
    // declines the upgrade.
    const options = smtpTransportOptions({ ...BASE, security: "STARTTLS" });
    expect(options.secure).toBe(false);
    expect(options.requireTLS).toBe(true);
  });

  it("sends no auth block when there is no username", () => {
    expect(smtpTransportOptions({ ...BASE, security: "NONE" }).auth).toBeUndefined();
    expect(
      smtpTransportOptions({ ...BASE, security: "NONE", username: "", password: "x" }).auth,
    ).toBeUndefined();
  });

  it("passes credentials through when there is one", () => {
    const options = smtpTransportOptions({
      ...BASE,
      security: "STARTTLS",
      username: "mailer",
      password: "hunter2",
    });
    expect(options.auth).toEqual({ user: "mailer", pass: "hunter2" });
  });

  it("treats a missing password as empty rather than undefined", () => {
    expect(smtpTransportOptions({ ...BASE, security: "NONE", username: "mailer" }).auth).toEqual({
      user: "mailer",
      pass: "",
    });
  });
});

describe("logDriver", () => {
  it("accepts a message and verifies without a server", async () => {
    const driver = logDriver();
    expect(driver.kind).toBe("log");
    await expect(driver.verify()).resolves.toBeUndefined();
    await expect(driver.send(message)).resolves.toHaveProperty("messageId");
  });
});

describe("memoryDriver", () => {
  it("records what it was asked to send", async () => {
    const driver = memoryDriver();
    await driver.send(message);
    expect(driver.sent).toHaveLength(1);
    expect(driver.sent[0]?.subject).toBe("Reset your password");
    driver.clear();
    expect(driver.sent).toHaveLength(0);
  });

  it("can fail on demand, for the FAILED-row path", async () => {
    const driver = memoryDriver({ failWith: new Error("connection refused") });
    await expect(driver.send(message)).rejects.toThrow("connection refused");
    await expect(driver.verify()).rejects.toThrow("connection refused");
    expect(driver.sent).toHaveLength(0);
  });
});

// ADR-152. `fetch` is stubbed at the global — the network edge, which is all
// this driver talks to; nothing of ours is mocked.
describe("sendgridMailBody", () => {
  it("carries sandbox_mode exactly as configured", () => {
    expect(sendgridMailBody(message, true).mail_settings).toEqual({
      sandbox_mode: { enable: true },
    });
    expect(sendgridMailBody(message, false).mail_settings).toEqual({
      sandbox_mode: { enable: false },
    });
  });

  it("puts text/plain before text/html, as SendGrid requires", () => {
    expect(sendgridMailBody(message, false).content.map((part) => part.type)).toEqual([
      "text/plain",
      "text/html",
    ]);
  });

  it("omits reply_to and headers rather than sending them empty", () => {
    const body = sendgridMailBody(message, false);
    expect(body).not.toHaveProperty("reply_to");
    expect(body).not.toHaveProperty("headers");
    const full = sendgridMailBody(
      { ...message, replyTo: "help@example.com", headers: { "List-Unsubscribe": "<x>" } },
      false,
    );
    expect(full.reply_to).toEqual({ email: "help@example.com" });
    expect(full.headers).toEqual({ "List-Unsubscribe": "<x>" });
  });
});

describe("sendgridKeyShapeNote", () => {
  it("says nothing about a key of SendGrid's own shape", () => {
    expect(sendgridKeyShapeNote(REAL_SHAPE_KEY)).toBeNull();
  });

  it("names the length, which is the whole diagnosis", () => {
    expect(sendgridKeyShapeNote(TOO_LONG_KEY)).toContain(
      "the stored key is 77 characters and a SendGrid key is 69",
    );
    expect(sendgridKeyShapeNote(`SG.${"a".repeat(22)}.${"b".repeat(30)}`)).toContain(
      "the stored key is 56 characters",
    );
  });

  it("names the prefix when that is what is wrong", () => {
    expect(sendgridKeyShapeNote(`xkeysib-${"a".repeat(60)}`)).toContain(
      "does not begin with `SG.`",
    );
  });

  it("does not claim a length fault for a 69-character key of the wrong shape", () => {
    const wrongShape = `SG.${"a".repeat(22)}.${"b".repeat(20)}.${"c".repeat(22)}`;
    expect(wrongShape).toHaveLength(69);
    expect(sendgridKeyShapeNote(wrongShape)).toContain("69 characters but not the");
  });

  it("never returns any part of the key — a note is read aloud and pasted into tickets", () => {
    const note = sendgridKeyShapeNote(TOO_LONG_KEY) ?? "";
    expect(note).not.toContain("a".repeat(22));
    expect(note).not.toContain("b".repeat(43));
    expect(note).not.toContain(TOO_LONG_KEY);
  });
});

describe("sendgridDriver", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(response: Response) {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(response));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("posts to Mail Send with the key as a bearer token and flags a sandbox send", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 200 }));
    const result = await sendgridDriver({ apiKey: "SG.test", sandbox: true }).send(message);

    expect(result.sandbox).toBe(true);
    expect(result.messageId).toMatch(/^sandbox-/);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer SG.test");
    expect(JSON.parse(init?.body as string).mail_settings.sandbox_mode.enable).toBe(true);
  });

  it("returns SendGrid's message id on a real send, and no sandbox flag", async () => {
    stubFetch(new Response(null, { status: 202, headers: { "X-Message-Id": "abc123" } }));
    const result = await sendgridDriver({ apiKey: "SG.test", sandbox: false }).send(message);
    expect(result).toEqual({ messageId: "abc123" });
  });

  it("throws SendGrid's own error message on a rejected send", async () => {
    stubFetch(
      Response.json(
        { errors: [{ message: "The from address does not match a verified Sender Identity." }] },
        { status: 403 },
      ),
    );
    await expect(
      sendgridDriver({ apiKey: "SG.test", sandbox: true }).send(message),
    ).rejects.toThrow("SendGrid 403: The from address does not match a verified Sender Identity.");
  });

  // The bug this guards: SendGrid answers a Bearer token containing a space
  // with `400 authorization required`, the same words it uses for no key at
  // all, so a pasted `Bearer SG.xyz` read as "my key is rejected". The request
  // must not be made — SendGrid's wording is what made it undiagnosable.
  it.each([
    ["Bearer SG.test", "space or line break"],
    ["SG.te st", "space or line break"],
    ["SG.test\n", "space or line break"],
    ["", "no API key is stored"],
  ])("refuses the unusable key %j without asking SendGrid", async (apiKey, expected) => {
    const fetchMock = stubFetch(Response.json({ scopes: ["mail.send"] }));
    const driver = sendgridDriver({ apiKey, sandbox: false });

    await expect(driver.verify()).rejects.toThrow(expected);
    await expect(driver.send(message)).rejects.toThrow(expected);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The bug this guards: a key eight characters longer than a key can be gets
  // `401 unauthorized` — the same answer as a revoked key and a key from
  // another account — so a paste that took in the neighbouring token read as
  // "my key is rejected". The length is the one fault visible from here.
  it("says what SendGrid cannot about a 401'd key: its shape", async () => {
    stubFetch(Response.json({ errors: [{ message: "unauthorized" }] }, { status: 401 }));
    await expect(sendgridDriver({ apiKey: TOO_LONG_KEY, sandbox: false }).verify()).rejects.toThrow(
      "SendGrid 401: unauthorized — the stored key is 77 characters and a SendGrid key is 69",
    );
  });

  it("adds no shape note to a 401'd key that is the right shape", async () => {
    // A revoked key, or one from another account. Its shape is not the fault,
    // and a note about it would send the admin after the wrong one.
    stubFetch(Response.json({ errors: [{ message: "unauthorized" }] }, { status: 401 }));
    await expect(
      sendgridDriver({ apiKey: REAL_SHAPE_KEY, sandbox: false }).verify(),
    ).rejects.toThrow(/^SendGrid 401: unauthorized$/);
  });

  it("adds no shape note to a 403 — the key authenticated", async () => {
    stubFetch(Response.json({ errors: [{ message: "access forbidden" }] }, { status: 403 }));
    await expect(sendgridDriver({ apiKey: TOO_LONG_KEY, sandbox: false }).verify()).rejects.toThrow(
      /^SendGrid 403: access forbidden$/,
    );
  });

  it("verifies that the key may send, not merely that it authenticates", async () => {
    stubFetch(Response.json({ scopes: ["mail.send", "user.profile.read"] }));
    await expect(sendgridDriver({ apiKey: "SG.test", sandbox: false }).verify()).resolves.toBe(
      undefined,
    );

    stubFetch(Response.json({ scopes: ["user.profile.read"] }));
    await expect(sendgridDriver({ apiKey: "SG.test", sandbox: false }).verify()).rejects.toThrow(
      "no Mail Send permission",
    );
  });
});
