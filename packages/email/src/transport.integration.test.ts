// The SMTP driver against a real server (testing.md: mocks are for the
// network edge we do not own, not for the transport we do). Mailpit is the
// same image `docker-compose.yml` runs for development, so what passes here
// is what a developer sees locally.
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { smtpDriver } from "./transport.ts";

let mailpit: StartedTestContainer;
let smtpPort: number;
let apiPort: number;

const message = {
  to: "learner@example.com",
  from: { name: "MBX Learning Center", address: "no-reply@example.com" },
  subject: "Reset your password",
  html: "<p>Use this link.</p>",
  text: "Use this link.",
};

beforeAll(async () => {
  mailpit = await new GenericContainer("axllent/mailpit:latest")
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forListeningPorts())
    .start();
  smtpPort = mailpit.getMappedPort(1025);
  apiPort = mailpit.getMappedPort(8025);
});

afterAll(async () => {
  await mailpit?.stop();
});

interface MailpitMessage {
  Subject: string;
  To: { Address: string }[];
}

async function inbox(): Promise<MailpitMessage[]> {
  const response = await fetch(`http://127.0.0.1:${apiPort}/api/v1/messages`);
  const body = (await response.json()) as { messages: MailpitMessage[] };
  return body.messages;
}

describe("smtpDriver against a real server", () => {
  it("verifies, then delivers what it was given", async () => {
    const driver = smtpDriver({ host: "127.0.0.1", port: smtpPort, security: "NONE" });

    await expect(driver.verify()).resolves.toBeUndefined();

    const { messageId } = await driver.send(message);
    expect(messageId).toMatch(/@/);

    const messages = await inbox();
    expect(messages).toHaveLength(1);
    expect(messages[0]?.Subject).toBe("Reset your password");
    expect(messages[0]?.To[0]?.Address).toBe("learner@example.com");
  });

  it("rejects rather than swallowing an unreachable server", async () => {
    // The FAILED-row path: a delivery failure has to reach the caller so it
    // can be recorded, never be logged and forgotten (ADR-078 #11).
    const driver = smtpDriver({ host: "127.0.0.1", port: 1, security: "NONE" });
    await expect(driver.verify()).rejects.toThrow();
    await expect(driver.send(message)).rejects.toThrow();
  });
});
