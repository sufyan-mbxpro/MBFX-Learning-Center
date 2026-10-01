import { expect, test, type Page } from "@playwright/test";
import { VIEWER_EMAIL, VIEWER_PASSWORD } from "../accounts.ts";
import { expectNoSeriousAxeViolations } from "../axe.ts";
import {
  announcement,
  announcementCount,
  announcementFixture,
  type AnnouncementFixture,
} from "../db.ts";
import { fillField, openAdminScreen, waitForHydration } from "../hydration.ts";
import { signInAsStaff } from "../sign-in.ts";

// changes-55 C7 — custom and direct emails end to end (ADR-172): an admin
// writes a custom email from the seeded "Plain message" design, is held at
// Review until a test has gone out, sends it to two overlapping groups (each
// address gets ONE copy, ADR-171 #2), then emails one learner directly from
// their record, which lists both on its Emails tab. A staff member without
// the keys sees no menu, and replaying the direct send under them writes
// nothing.
//
// Serial, with its own stamped world, like `announcements.spec.ts`.
test.describe.configure({ mode: "serial" });

const stamp = String(Date.now());
const EMPTY_STATE = { cookies: [], origins: [] };
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:8025";
const SMTP_HOST = process.env.E2E_SMTP_HOST ?? "127.0.0.1";
const SMTP_PORT = Number(process.env.E2E_SMTP_PORT ?? 1025);
/** ADR-143's brand-fill labels are accepted; every other contrast failure blocks. */
const AXE = { acceptBrandFillLabels: true } as const;

const CUSTOM_SUBJECT = `Monday notice ${stamp}`;
const DIRECT_SUBJECT = `About your account ${stamp}`;

let world: AnnouncementFixture;
let customId = "";
/** The admin's own direct-send request, replayed under a subject without the keys. */
let directAction: { id: string; body: string } | null = null;

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

test.describe("custom and direct emails", () => {
  test.beforeAll(async () => {
    const reachable = await fetch(`${MAILPIT}/api/v1/messages`).then(
      (response) => response.ok,
      () => false,
    );
    test.skip(!reachable, `Mailpit is not reachable at ${MAILPIT} (docker compose up mailpit)`);
    world = announcementFixture({ stamp, smtpHost: SMTP_HOST, smtpPort: SMTP_PORT });
  });

  test("a custom email waits for a test, then reaches each address once", async ({ page }) => {
    await openAdminScreen(page, "/keystone/announcements/new?kind=custom");
    await expect(page.getByRole("heading", { level: 1, name: "New custom email" })).toBeVisible();
    await expectNoSeriousAxeViolations(page, AXE);

    // Step 1: the seeded design fills the message; the subject is ours.
    await fillField(page.getByLabel(/^Name/), `Custom ${stamp}`);
    await page.getByLabel(/^Start from/).click();
    await page.getByRole("option", { name: "Plain message" }).click();
    await fillField(page.getByLabel(/^Subject/), CUSTOM_SUBJECT);
    await continueStep(page);
    await page.waitForURL(/\/keystone\/announcements\/(?!new)[^/?#]+\?step=audience$/, {
      timeout: 30_000,
    });
    customId = new URL(page.url()).pathname.split("/").pop()!;
    await waitForHydration(page);

    // Step 2: subscribers PLUS both learners by hand; learner A is in both.
    await page.getByRole("button", { name: /Newsletter subscribers/ }).click();
    await page.getByRole("button", { name: /Select users/ }).click();
    for (const user of world.users) {
      await fillField(page.getByRole("searchbox", { name: /Search learners/ }), stamp);
      await page.getByRole("button", { name: new RegExp(user.name) }).click();
    }
    await expect(page.getByRole("status").filter({ hasText: "unique recipient" })).toContainText(
      /\(([1-9]\d*) duplicates/,
      { timeout: 15_000 },
    );
    await continueStep(page);

    // Step 3: held until a test goes out (owner, E5).
    await expect(page.getByText("Not tested since the last change")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Send now" })).toBeDisabled();
    await page.getByRole("button", { name: "Send me a test" }).click();
    await expect(page.getByText("Tested since the last change")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Everything is ready.")).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousAxeViolations(page, AXE);

    await page.getByRole("button", { name: "Send now" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Send", exact: true }).click();

    await expect
      .poll(() => ours(customId), { timeout: 30_000 })
      .toEqual([world.addresses.a, world.addresses.b, world.addresses.solo].sort());
    for (const address of Object.values(world.addresses)) {
      await expect
        .poll(
          async () =>
            (await mailTo(address)).filter((message) => message.Subject === CUSTOM_SUBJECT).length,
          { timeout: 60_000 },
        )
        .toBe(1);
    }
    await expect.poll(() => announcement(customId)?.status, { timeout: 30_000 }).toBe("SENT");
  });

  test("one learner is emailed from their record, and the record lists both", async ({ page }) => {
    const learner = world.users[1]!;
    await openAdminScreen(page, `/keystone/users/${learner.id}`);
    await page.getByRole("button", { name: "Send email" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(/^Subject/)).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousAxeViolations(page, AXE);
    await fillField(dialog.getByLabel(/^Subject/), DIRECT_SUBJECT);

    const [sendRequest] = await Promise.all([
      page.waitForRequest(isServerAction),
      dialog.getByRole("button", { name: "Send email" }).click(),
    ]);
    directAction = {
      id: sendRequest.headers()["next-action"]!,
      body: sendRequest.postData() ?? "",
    };
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    await expect
      .poll(
        async () =>
          (await mailTo(learner.email)).filter((message) => message.Subject === DIRECT_SUBJECT)
            .length,
        { timeout: 60_000 },
      )
      .toBe(1);

    await page.reload();
    await waitForHydration(page);
    await page.getByRole("tab", { name: "Emails" }).click();
    await expect(page.getByRole("link", { name: DIRECT_SUBJECT })).toBeVisible();
    await expect(page.getByRole("link", { name: `Custom ${stamp}` })).toBeVisible();
  });

  test("a staff member without the keys gets no menu, and a replayed send writes nothing", async ({
    browser,
  }) => {
    expect(directAction, "the previous test recorded the send request").not.toBeNull();
    const hijacked = `E2E hijack ${stamp}`;

    // `seo_manager` is STAFF and holds no `announcements.*` key.
    const context = await browser.newContext({ storageState: EMPTY_STATE });
    const page = await context.newPage();
    await signInAsStaff(page, VIEWER_EMAIL, VIEWER_PASSWORD, "/keystone/dashboard");
    await page.goto("/keystone/announcements");
    await expect(page.getByRole("button", { name: "New email" })).toHaveCount(0);

    // The action is the boundary (security.md #1): the row count is the
    // assertion, not the status code.
    const body = directAction!.body.replace(/"subject":"[^"]*"/, `"subject":"${hijacked}"`);
    await page.request.post(`/keystone/users/${world.users[1]!.id}`, {
      headers: { "next-action": directAction!.id, "content-type": "text/plain;charset=UTF-8" },
      data: body,
    });
    expect(announcementCount(hijacked)).toBe(0);
    await context.close();
  });
});
