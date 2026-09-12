// changes-21 F7 (ADR-080) — the newsletter signup is real, and stays real.
//
// Read as SOURCE, like `password-fields.test.ts` and
// `admin-form-conventions.test.ts`: the app has no jsdom runner (component
// tests live in `packages/ui`), and what matters here is a property of the
// markup rather than of a render.
//
// **The first assertion is the one this file exists for.** The form shipped
// hard-`disabled` from changes-03 to F7, under "Newsletter signup is coming
// soon", and it was right to: there was nowhere to put an address. The failure
// mode worth guarding is not that someone re-adds the placeholder on purpose —
// it is a merge or a revert quietly bringing it back, leaving a form that looks
// finished and accepts nothing.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve(process.cwd(), "app");
const raw = (relative: string) => readFileSync(resolve(APP_ROOT, relative), "utf8");

/**
 * The file with its comments removed.
 *
 * Every "this must not appear" assertion below reads this rather than the raw
 * source, because the things being forbidden — `disabled`,
 * `footer.newsletterEnabled` — are exactly the things the surrounding comments
 * have to NAME in order to explain why they are gone. A guard that trips on
 * its own explanation teaches the next reader to delete the explanation.
 */
const read = (relative: string) =>
  raw(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");

const FORM = "(public)/[locale]/_components/newsletter-form.tsx";
const ACTION = "(public)/[locale]/_actions/newsletter.ts";

/** Every place the form is drawn. A fifth needs a setting key of its own. */
const PLACEMENTS = [
  "(public)/[locale]/_components/footer.tsx",
  "(public)/[locale]/_sections/newsletter.tsx",
  "(public)/[locale]/news/page.tsx",
  "(public)/[locale]/analysis/page.tsx",
];

describe("the signup form accepts submissions", () => {
  const source = read(FORM);

  it("has no disabled control and no 'unavailable' label left", () => {
    expect(source).not.toMatch(/\bdisabled\b/);
    expect(source).not.toContain("unavailableLabel");
    expect(source).not.toContain("TODO(newsletter)");
  });

  it("submits through a form action, so it works before hydration", () => {
    // `<form action={formAction}>` posts whether or not the bundle has loaded.
    // An onClick handler would make the control dead on a slow connection.
    expect(source).toContain("useActionState");
    expect(source).toContain("<form action={formAction}");
  });

  it("renders every state the action can return", () => {
    // Four outcomes, and deliberately no "already subscribed" — that would
    // make the form a membership oracle for anybody's address (ADR-080 #1).
    for (const label of ["sent", "invalid", "limited", "failed", "consent"]) {
      expect(source).toContain(`labels.${label}`);
    }
    expect(source).not.toMatch(/alreadySubscribed|already_subscribed/);
  });

  it("carries the honeypot by its shared constant, never a literal", () => {
    // A hard-coded name on one side is how a honeypot silently stops working.
    expect(source).toContain("NEWSLETTER_HONEYPOT_FIELD");
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("tabIndex={-1}");
  });
});

describe("the action keeps all five guards (ADR-080 #3)", () => {
  const source = read(ACTION);

  it.each([
    ["the feature flag", 'isFeatureVisible("newsletter", null)'],
    ["the honeypot", "NEWSLETTER_HONEYPOT_FIELD"],
    ["the schema", "newsletterSubscribeSchema"],
    ["a per-IP bucket", "newsletter:ip:"],
    ["a per-email bucket", "newsletter:email:"],
  ])("still checks %s", (_label, needle) => {
    expect(source).toContain(needle);
  });

  it("never exposes a GET mutation — every path here is an action or a POST", () => {
    // ADR-080 #4: a mail scanner fetches every link in a message, so nothing
    // reachable by GET may confirm or unsubscribe anyone.
    expect(source).toContain('"use server"');
    expect(source).not.toMatch(/export async function GET/);
  });
});

describe("every placement checks the flag AND its own setting (ADR-080 #5)", () => {
  it.each(PLACEMENTS)("%s reads both switches", (relative) => {
    const source = read(relative);
    expect(source).toContain('isFeatureVisible("newsletter"');
    expect(source).toContain("isNewsletterPlacementEnabled(");
  });

  it.each(PLACEMENTS)("%s no longer reads the deleted footer.newsletterEnabled", (relative) => {
    // One setting that meant both "does signup exist" and "is it in the
    // footer", stranded in the `layout` group ADR-038 paused — which is how it
    // became uneditable. F7 deleted it.
    expect(read(relative)).not.toContain("footer.newsletterEnabled");
  });

  it.each(PLACEMENTS)("%s passes a source, so admin can filter by placement", (relative) => {
    expect(read(relative)).toMatch(/source="(footer|home|news|analysis)"/);
  });
});
