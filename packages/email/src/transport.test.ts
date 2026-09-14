// The config mapping is the security-relevant half of the SMTP driver, and
// its failure mode is invisible at runtime: mail still goes out, just not
// encrypted. The drivers themselves are checked against a real server in
// transport.integration.test.ts.
import { describe, expect, it } from "vitest";
import { logDriver, smtpTransportOptions } from "./transport.ts";
import { memoryDriver } from "./testing.ts";

const BASE = { host: "smtp.example.com", port: 587 };

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
