import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { VIEWER_EMAIL, VIEWER_PASSWORD } from "../accounts.ts";
import { expectNoSeriousAxeViolations } from "../axe.ts";
import { activeLocales, auditCount, promotion, promotionPopupTotals } from "../db.ts";
import { fillField, openAdminScreen, reloadAdminScreen, waitForHydration } from "../hydration.ts";
import { signInAsStaff } from "../sign-in.ts";

// changes-52 P8 — promotions end to end (ADR-167): an editor creates one and
// activates it, a visitor meets it as a popup on `/` and on `/ar`, dismissing
// it holds for the session, and a subject without the keys writes nothing.
//
// ONE promotion carries the whole file, which is why it is serial: the public
// tests need the one the admin tests made, and the last test archives it. A
// run that dies earlier leaves it live on a reused server, so the public tests
// page the dialog to their own promotion rather than assume it is first.
//
// Why a standalone ANNOUNCEMENT on the home page: it is the editor's blank
// state apart from the words and the window, so the spec drives what an editor
// must type and nothing it would not.
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const TITLE = `E2E promotion ${stamp}`;
const EMPTY_STATE = { cookies: [], origins: [] };

/**
 * Axe on the open popup. Scoped to the dialog: the page behind it is the home
 * template, which the RTL smoke suite owns. ADR-143's white-on-primary labels
 * are accepted and nothing else is — see `axe.ts`.
 */
const POPUP_AXE = { include: '[role="dialog"]', acceptBrandFillLabels: true } as const;

/** Set by the first test; every later one is about this promotion. */
let promotionId = "";
/**
 * The two server actions as the browser actually sent them, recorded from the
 * admin's own clicks. Replaying the EXACT request under another session is what
 * makes the denial mean something — a hand-built body the action rejects as
 * malformed would "pass" without ever reaching the permission check.
 */
let saveAction: { id: string; body: string } | null = null;
let statusAction: { id: string } | null = null;

/** A fresh visitor: no cookies, no storage, so no frequency memory either. */
async function visitor(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ storageState: EMPTY_STATE });
}

/**
 * Open a public page and wait for its promotions read. Waiting on the RESPONSE
 * rather than a timer is what lets "no dialog" be asserted without guessing
 * how long the dev server takes to compile the route.
 */
async function openPublic(page: Page, path: string): Promise<{ id: string }[]> {
  const [response] = await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname === "/api/promotions", {
      timeout: 60_000,
    }),
    page.goto(path),
  ]);
  const body = (await response.json()) as { promotions?: { id: string }[] };
  return body.promotions ?? [];
}

/**
 * Wait for the popup and page it to THIS file's promotion.
 *
 * Several live promotions share one dialog (ADR-167 #5), and a run that died
 * before its archive step leaves one live on a reused server — at the same
 * priority, so ours may be page two. Asserting on page one would make the
 * suite fail for the rerun rather than for the code.
 */
async function openOurPopup(page: Page, next: string) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  const ours = dialog.getByRole("heading", { name: TITLE });
  for (let i = 0; i < 3 && !(await ours.isVisible()); i++) {
    await dialog.getByRole("button", { name: next }).click();
  }
  await expect(ours).toBeVisible();
  return dialog;
}

/**
 * Pick a day in the `DateTimePicker` behind `label`: step `months` from the
 * current month and press day `day`. The control's hour defaults to 09:00.
 */
async function pickDate(page: Page, label: RegExp, months: number, day: number) {
  const trigger = page.getByLabel(label);
  await trigger.click();
  // Scoped to THIS picker's popup: a previous one can still be in the DOM
  // while its close animation runs, and then every control is there twice.
  const popover = page.locator('[data-slot="popover-content"]').last();
  await expect(popover).toBeVisible();
  const step = months < 0 ? "Previous month" : "Next month";
  for (let i = 0; i < Math.abs(months); i++) {
    await popover.getByRole("button", { name: step }).click();
  }
  // The day buttons are named with the long en-US date, e.g. "September 1, 2026".
  await popover.getByRole("button", { name: new RegExp(`^[A-Z][a-z]+ ${day}, \\d{4}$`) }).click();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  // The trigger now names a date instead of the placeholder.
  await expect(trigger).toContainText(`${day},`);
}

/** A server action POST, with the `Next-Action` id it carries. */
function isServerAction(request: { method(): string; headers(): Record<string, string> }) {
  return request.method() === "POST" && Boolean(request.headers()["next-action"]);
}

test.describe("promotions", () => {
  test("an editor creates a promotion and activates it", async ({ page }) => {
    await openAdminScreen(page, "/keystone/promotions/new");
    await expect(page.getByRole("heading", { level: 1, name: "New promotion" })).toBeVisible();

    // Standalone ⇒ the title is required; the rest of the blank state stands.
    await fillField(page.getByLabel(/^Title\s*\*?$/), TITLE);

    // A window that is open NOW: from the 1st of last month to the 28th two
    // months out, so the spec never depends on what day it runs.
    await pickDate(page, /^Show from/, -1, 1);
    await pickDate(page, /^Show until/, 2, 28);

    // One second rather than the default five — the popup's delay is behaviour
    // under test, not a cost this suite should pay on every visit.
    await fillField(page.getByLabel(/^Popup delay/), "1");

    // Arabic has no words for this promotion, so it must fall back to English
    // for the `/ar` popup to exist at all (§6: HIDE is the default).
    await page.getByLabel(/^In a language with no translation/).click();
    await page.getByRole("option", { name: "Show it in English" }).click();

    const [saveRequest] = await Promise.all([
      page.waitForRequest(isServerAction),
      page.getByRole("button", { name: "Save", exact: true }).click(),
    ]);
    saveAction = {
      id: saveRequest.headers()["next-action"]!,
      body: saveRequest.postData() ?? "",
    };

    // The first save moves the editor to the promotion's own address.
    await page.waitForURL(/\/keystone\/promotions\/(?!new)[^/?#]+$/, { timeout: 30_000 });
    promotionId = new URL(page.url()).pathname.split("/").pop()!;

    const saved = promotion(promotionId);
    expect(saved, "the save wrote a row").not.toBeNull();
    expect(saved!.status).toBe("DRAFT");
    expect(saved!.untranslated).toBe("SHOW_DEFAULT");
    expect(saved!.frequency).toBe("PER_SESSION");
    expect(saved!.translations.find((t) => t.locale === "en")?.title).toBe(TITLE);
    expect(auditCount(promotionId, "promotions.create")).toBe(1);

    // Activation is its own action behind `promotions.publish`, never part of Save.
    await waitForHydration(page);
    const [statusRequest] = await Promise.all([
      page.waitForRequest(isServerAction),
      page.getByRole("button", { name: "Activate" }).click(),
    ]);
    statusAction = { id: statusRequest.headers()["next-action"]! };

    await expect.poll(() => promotion(promotionId)?.status, { timeout: 15_000 }).toBe("ACTIVE");
    expect(auditCount(promotionId, "promotions.publish")).toBe(1);
  });

  test("a visitor meets it on the home page, and passes axe with it open", async ({ browser }) => {
    const context = await visitor(browser);
    const page = await context.newPage();

    const live = await openPublic(page, "/");
    expect(live.map((p) => p.id)).toContain(promotionId);

    // Focus goes to the message, not the button (changes-52 §7.3) — checked
    // on opening, before any paging moves it to the pager.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole("heading").first()).toBeFocused();

    await openOurPopup(page, "Next");
    await expectNoSeriousAxeViolations(page, POPUP_AXE);

    // The view reached the counters (ADR-170): through the real beacon, past
    // its same-origin and live-only guards, into a daily row.
    await expect
      .poll(() => promotionPopupTotals(promotionId).impressions, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);
    await context.close();
  });

  test("once dismissed it stays away for the session, and comes back in a new one", async ({
    browser,
  }) => {
    const context = await visitor(browser);
    const page = await context.newPage();

    await openPublic(page, "/");
    const dialog = await openOurPopup(page, "Next");
    await dialog.getByRole("button", { name: "Not now" }).click();
    await expect(dialog).toBeHidden();
    // Closed without a click ⇒ a dismissal. The view is not re-asserted: the
    // previous test's counted already, and ADR-170 counts one per network a day.
    await expect
      .poll(() => promotionPopupTotals(promotionId).dismissals, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    // Same tab, reloaded: PER_SESSION remembers it in sessionStorage.
    const live = await openPublic(page, "/");
    expect(
      live.map((p) => p.id),
      "still live — the absence below is the rule, not the data",
    ).toContain(promotionId);
    // The delay is one second; three is the rule having had every chance to fire.
    await page.waitForTimeout(3_000);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // A new tab is a new session (sessionStorage is per tab), so it shows again.
    const second = await context.newPage();
    await openPublic(second, "/");
    await openOurPopup(second, "Next");

    await context.close();
  });

  test("in Arabic it opens right to left, fits a phone, and passes axe", async ({ browser }) => {
    const rtl = activeLocales().find((locale) => locale.isRtl);
    test.skip(rtl === undefined, "no RTL locale is active (ADR-091)");

    const context = await visitor(browser);
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });

    await openPublic(page, `/${rtl!.code}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const dialog = await openOurPopup(page, "التالي");
    // The chrome is Arabic even where the words fell back to English.
    await expect(dialog.getByRole("button", { name: "ليس الآن" })).toBeVisible();
    expect(await dialog.evaluate((el) => getComputedStyle(el).direction)).toBe("rtl");

    // Inside the viewport, and the page does not scroll sideways under it.
    const box = await dialog.boundingBox();
    expect(box, "the dialog has a box").not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await expectNoSeriousAxeViolations(page, POPUP_AXE);
    await context.close();
  });

  test("a subject without the promotion keys cannot change it, asserted at the DB", async ({
    browser,
    page: adminPage,
  }) => {
    expect(saveAction, "the first test recorded the save action").not.toBeNull();
    expect(statusAction, "the first test recorded the status action").not.toBeNull();
    const before = promotion(promotionId)!;
    const publishes = auditCount(promotionId, "promotions.publish");
    const statuses = auditCount(promotionId, "promotions.status");
    const updates = auditCount(promotionId, "promotions.update");
    const editor = `/keystone/promotions/${promotionId}`;

    const headers = (id: string) => ({
      "Next-Action": id,
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
    });
    const archive = JSON.stringify([{ id: promotionId, status: "ARCHIVED" }]);
    const hijacked = JSON.parse(saveAction!.body) as [Record<string, unknown>];
    hijacked[0] = {
      ...hijacked[0],
      id: promotionId,
      translation: { ...(hijacked[0].translation as object), title: `HIJACKED ${stamp}` },
    };

    // The control: the recorded status request, replayed by the ADMIN with a
    // no-op status, is accepted. Without it, a refusal below could be the
    // request's shape rather than the subject's permissions.
    await openAdminScreen(adminPage, editor);
    const control = await adminPage.request.post(editor, {
      headers: headers(statusAction!.id),
      data: JSON.stringify([{ id: promotionId, status: "ACTIVE" }]),
    });
    expect(control.status(), "the replayed action is well formed").toBe(200);

    // `seo_manager` is STAFF and holds no `promotions.*` key.
    const context = await browser.newContext({ storageState: EMPTY_STATE });
    const page = await context.newPage();
    await signInAsStaff(page, VIEWER_EMAIL, VIEWER_PASSWORD, "/keystone/dashboard");

    // The screen does not open for them…
    await page.goto(editor);
    await expect(page.getByLabel(/^Show from/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Activate" })).toHaveCount(0);

    // …and the actions refuse them when called directly, which is the boundary
    // (security.md #1). Their status codes are not the assertion; the rows are.
    await page.request.post(editor, { headers: headers(statusAction!.id), data: archive });
    await page.request.post(editor, {
      headers: headers(saveAction!.id),
      data: JSON.stringify(hijacked),
    });

    const after = promotion(promotionId)!;
    expect(after.status).toBe(before.status);
    expect(after.translations).toEqual(before.translations);
    expect(auditCount(promotionId, "promotions.publish")).toBe(publishes);
    expect(auditCount(promotionId, "promotions.status")).toBe(statuses);
    expect(auditCount(promotionId, "promotions.update")).toBe(updates);

    await context.close();
  });

  test("archiving takes it down for visitors", async ({ browser, page }) => {
    await openAdminScreen(page, `/keystone/promotions/${promotionId}`);
    // The editor renders the stored status; reloaded so Archive is offered.
    await reloadAdminScreen(page);
    await page.getByRole("button", { name: "Archive" }).click();
    await expect.poll(() => promotion(promotionId)?.status, { timeout: 15_000 }).toBe("ARCHIVED");

    const context = await visitor(browser);
    const visit = await context.newPage();
    const live = await openPublic(visit, "/");
    expect(live.map((p) => p.id)).not.toContain(promotionId);
    await context.close();
  });
});
