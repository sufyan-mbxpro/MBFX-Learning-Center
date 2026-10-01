import { expect, test, type Page } from "@playwright/test";
import { VIEWER_EMAIL, VIEWER_PASSWORD } from "../accounts.ts";
import { expectNoSeriousAxeViolations } from "../axe.ts";
import {
  announcement,
  announcementCount,
  announcementFixture,
  announcementSuppression,
  type AnnouncementFixture,
} from "../db.ts";
import { fillField, openAdminScreen, waitForHydration } from "../hydration.ts";
import { signInAsStaff } from "../sign-in.ts";

// changes-54 N7 — announcement emails end to end (ADR-171): an admin announces
// a course to two overlapping groups through the four-step editor, the job
// queue delivers to Mailpit, every ADDRESS gets exactly one email (the owner's
// one hard rule), a reader unsubscribes from the email's own link, the next
// announcement skips them, and a subject without the keys writes nothing.
//
// Serial: one world (the fixture) carries the file. Every address carries the
// run's stamp, so the Mailpit assertions read only this run's mail even on a
// reused Mailpit.
test.describe.configure({ mode: "serial" });

const stamp = String(Date.now());
const EMPTY_STATE = { cookies: [], origins: [] };
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:8025";
const SMTP_HOST = process.env.E2E_SMTP_HOST ?? "127.0.0.1";
const SMTP_PORT = Number(process.env.E2E_SMTP_PORT ?? 1025);

/**
 * ADR-143's white-on-primary labels (the admin chrome's brand fill) are the
 * owner's accepted decision and nothing wider is — see `axe.ts` and the P8
 * DEVLOG entry. Every other contrast failure still blocks.
 */
const AXE = { acceptBrandFillLabels: true } as const;

let world: AnnouncementFixture;
let firstId = "";
/** The admin's own save request, replayed under a subject without the keys. */
let saveAction: { id: string; body: string } | null = null;

interface MailpitSummary {
  ID: string;
  Subject: string;
}

async function mailTo(address: string): Promise<MailpitSummary[]> {
  const response = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
  );
  const body = (await response.json()) as { messages?: MailpitSummary[] };
  return body.messages ?? [];
}

async function messageText(id: string): Promise<string> {
  const response = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  const body = (await response.json()) as { Text?: string };
  return body.Text ?? "";
}

async function messageHeaders(id: string): Promise<Record<string, string[]>> {
  const response = await fetch(`${MAILPIT}/api/v1/message/${id}/headers`);
  return (await response.json()) as Record<string, string[]>;
}

/** This run's rows only: a reused E2E database keeps earlier runs' subscribers. */
function ours(id: string): string[] | undefined {
  return announcement(id)
    ?.recipients.map((row) => row.email)
    .filter((email) => email.includes(stamp));
}

function isServerAction(request: { method(): string; headers(): Record<string, string> }) {
  return request.method() === "POST" && Boolean(request.headers()["next-action"]);
}

async function continueStep(page: Page) {
  await page.getByRole("button", { name: "Save & continue" }).click();
}

async function sendNow(page: Page) {
  await page.getByRole("button", { name: "Send now" }).click();
  // ConfirmDialog is an alert dialog (a destructive-shaped confirmation).
  await page.getByRole("alertdialog").getByRole("button", { name: "Send", exact: true }).click();
}

test.describe("announcements", () => {
  test.beforeAll(async () => {
    const reachable = await fetch(`${MAILPIT}/api/v1/messages`).then(
      (response) => response.ok,
      () => false,
    );
    test.skip(!reachable, `Mailpit is not reachable at ${MAILPIT} (docker compose up mailpit)`);
    world = announcementFixture({ stamp, smtpHost: SMTP_HOST, smtpPort: SMTP_PORT });
  });

  test("an admin announces a course to two overlapping groups; each address gets ONE email", async ({
    page,
  }) => {
    await openAdminScreen(page, `/keystone/announcements/new?course=${world.courseId}`);
    await expect(page.getByRole("heading", { level: 1, name: "New announcement" })).toBeVisible();
    await expectNoSeriousAxeViolations(page, AXE);

    // Step 1 arrives filled from the course editor's button; the first save
    // creates the draft and moves to its own address.
    const [saveRequest] = await Promise.all([
      page.waitForRequest(isServerAction),
      continueStep(page),
    ]);
    saveAction = { id: saveRequest.headers()["next-action"]!, body: saveRequest.postData() ?? "" };
    await page.waitForURL(/\/keystone\/announcements\/(?!new)[^/?#]+\?step=message$/, {
      timeout: 30_000,
    });
    firstId = new URL(page.url()).pathname.split("/").pop()!;
    await waitForHydration(page);

    // Step 2: the template's own subject and design; no override needed.
    await continueStep(page);

    // Step 3: subscribers PLUS both learners by hand. Learner A is also a
    // subscriber under the same mailbox in other letter case.
    await page.getByRole("button", { name: /Newsletter subscribers/ }).click();
    await page.getByRole("button", { name: /Select users/ }).click();
    for (const user of world.users) {
      await fillField(page.getByRole("searchbox", { name: /Search learners/ }), stamp);
      await page.getByRole("button", { name: new RegExp(user.name) }).click();
    }
    // Learner A is in both groups: the footer says a duplicate was removed.
    await expect(page.getByRole("status").filter({ hasText: "unique recipient" })).toContainText(
      /\(([1-9]\d*) duplicates/,
      { timeout: 15_000 },
    );
    await continueStep(page);

    // Step 4: everything ready; send.
    await expect(page.getByText("Everything is ready.")).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousAxeViolations(page, AXE);
    await sendNow(page);

    // The queue, not the request, delivers (owner, D8). The rows are the
    // dedupe: three addresses, Learner A once, with the ACCOUNT's row.
    await expect
      .poll(() => ours(firstId), { timeout: 30_000 })
      .toEqual([world.addresses.a, world.addresses.b, world.addresses.solo].sort());
    const aRow = announcement(firstId)!.recipients.find((row) => row.email === world.addresses.a);
    expect(aRow?.userId).toBe(world.users[0]!.id);

    for (const address of Object.values(world.addresses)) {
      await expect.poll(async () => (await mailTo(address)).length, { timeout: 60_000 }).toBe(1);
    }
    await expect.poll(() => announcement(firstId)?.status, { timeout: 30_000 }).toBe("SENT");
  });

  test("the email's one-click header is the handler, and the page link unsubscribes", async ({
    browser,
  }) => {
    const [message] = await mailTo(world.addresses.a);
    expect(message, "learner A has the announcement").toBeDefined();

    // RFC 8058: the header names the POST handler, never the page (§9.3).
    const headers = await messageHeaders(message!.ID);
    expect(headers["List-Unsubscribe"]?.[0]).toMatch(/\/api\/email\/unsubscribe\?t=v1\./);
    expect(headers["List-Unsubscribe-Post"]?.[0]).toBe("List-Unsubscribe=One-Click");

    const text = await messageText(message!.ID);
    const link = /(https?:\/\/[^\s)]+\/email\/unsubscribe\?t=[^\s)]+)/.exec(text)?.[1];
    expect(link, "the footer link is in the message").toBeTruthy();

    const context = await browser.newContext({ storageState: EMPTY_STATE });
    const page = await context.newPage();
    await page.goto(new URL(link!).pathname + new URL(link!).search);
    await waitForHydration(page);
    // A GET changes nothing: a mail scanner fetches every link (ADR-080 #4).
    expect(announcementSuppression(world.addresses.a)).toBeNull();
    await expectNoSeriousAxeViolations(page, AXE);

    // `exact`: the newsletter button's name also contains "unsubscribe".
    await page.getByRole("button", { name: "Unsubscribe", exact: true }).click();
    await expect(page.getByText("You're unsubscribed")).toBeVisible();
    // The address is also a subscriber, so the separate second button is offered.
    await expect(
      page.getByRole("button", { name: "Also unsubscribe from the newsletter" }),
    ).toBeVisible();
    expect(announcementSuppression(world.addresses.a)?.reason).toBe("UNSUBSCRIBED");
    await context.close();
  });

  test("the next announcement skips the address that unsubscribed", async ({ page }) => {
    await openAdminScreen(page, "/keystone/announcements");
    const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: /launch/ }) });
    await row.first().getByRole("button", { name: "Open actions" }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await page.waitForURL(/\/keystone\/announcements\/(?!new)[^/?#]+$/, { timeout: 30_000 });
    const secondId = new URL(page.url()).pathname.split("/").pop()!;
    expect(secondId).not.toBe(firstId);
    await waitForHydration(page);

    // A saved draft with an audience opens on Review.
    await expect(page.getByText("Everything is ready.")).toBeVisible({ timeout: 15_000 });
    await sendNow(page);

    await expect
      .poll(() => ours(secondId), { timeout: 30_000 })
      .toEqual([world.addresses.b, world.addresses.solo].sort());
    await expect
      .poll(async () => (await mailTo(world.addresses.b)).length, { timeout: 60_000 })
      .toBe(2);
    await expect
      .poll(async () => (await mailTo(world.addresses.solo)).length, { timeout: 60_000 })
      .toBe(2);
    expect((await mailTo(world.addresses.a)).length).toBe(1);
  });

  test("a staff member without the keys can neither open the screen nor save a draft", async ({
    browser,
  }) => {
    expect(saveAction, "the first test recorded the save request").not.toBeNull();
    const hijacked = `E2E hijack ${stamp}`;

    // `seo_manager` is STAFF and holds no `announcements.*` key.
    const context = await browser.newContext({ storageState: EMPTY_STATE });
    const page = await context.newPage();
    await signInAsStaff(page, VIEWER_EMAIL, VIEWER_PASSWORD, "/keystone/dashboard");

    await page.goto("/keystone/announcements");
    // The section's one primary action (ADR-172: a menu, "New email").
    await expect(page.getByRole("button", { name: "New email" })).toHaveCount(0);

    // The action refuses when called directly, which is the boundary
    // (security.md #1). The row count is the assertion, not the status code.
    const body = saveAction!.body.replace(/"name":"[^"]*"/, `"name":"${hijacked}"`);
    await page.request.post("/keystone/announcements/new", {
      headers: { "next-action": saveAction!.id, "content-type": "text/plain;charset=UTF-8" },
      data: body,
    });
    expect(announcementCount(hijacked)).toBe(0);
    await context.close();
  });
});
