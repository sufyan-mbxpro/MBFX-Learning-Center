// `/support` is the page a reader arrives at with a question (ADR-113).
//
// It shipped once already with a channel list gated on an empty collection,
// which meant the band never drew and the page offered no way to ask anything.
// The guards below are the properties that failure would have tripped, plus
// the three that are load-bearing for safety rather than for content.
//
// Read as SOURCE, like `newsletter-signup.test.ts` and
// `admin-form-conventions.test.ts`: the app has no jsdom runner (component
// tests live in `packages/ui`), and what matters here is a property of the
// markup and the data rather than of a render.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SUPPORT_CHANNELS,
  SUPPORT_CONTACT,
  SUPPORT_FAQ,
} from "./(public)/[locale]/support/_content/support-facts.ts";

const APP_ROOT = resolve(process.cwd(), "app");
const raw = (relative: string) => readFileSync(resolve(APP_ROOT, relative), "utf8");

/**
 * The file with its comments removed.
 *
 * Every "this must not appear" assertion reads this rather than the raw
 * source, because the things being forbidden — `disabled`, a bare `mailto:` —
 * are exactly the things the surrounding comments have to NAME in order to
 * explain why they are handled. A guard that trips on its own explanation
 * teaches the next reader to delete the explanation.
 */
const read = (relative: string) =>
  raw(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");

const PAGE = "(public)/[locale]/support/page.tsx";
const FORM = "(public)/[locale]/support/_components/support-form.tsx";
const ACTION = "(public)/[locale]/_actions/support.ts";
const FACTS = "(public)/[locale]/support/_content/support-facts.ts";

describe("the three channels reach a person", () => {
  it("records one of each kind, in the reference's order", () => {
    expect(SUPPORT_CHANNELS.map((channel) => channel.kind)).toEqual(["whatsapp", "email", "phone"]);
  });

  // The whole point of the band. A scheme test rather than an exact-URL test:
  // the numbers are the owner's to change, the schemes are not.
  it.each([
    ["whatsapp", "https://wa.me/"],
    ["email", "mailto:"],
    ["phone", "tel:"],
  ])("%s opens a %s target", (kind, prefix) => {
    const channel = SUPPORT_CHANNELS.find((entry) => entry.kind === kind);
    // The email channel's href is built on the page from the setting.
    const href = channel?.href ?? read(PAGE);
    expect(href.includes(prefix)).toBe(true);
  });

  it("gives every channel an availability line, because a card without one reads as always-on", () => {
    for (const channel of SUPPORT_CHANNELS) expect(channel.availability.trim()).not.toBe("");
  });

  // ADR-047 §2 rule 1, stated as a test rather than a convention: the band is
  // absent when the data is, which is the failure ADR-109's version hit.
  it("draws the band only when there is a channel in it", () => {
    expect(read(PAGE)).toMatch(/channels\.length > 0/);
  });

  // `mailto:` with nothing after it opens a compose window addressed to
  // nobody — worse than no card, because it looks like it worked.
  it("drops the email card when no address is recorded", () => {
    expect(read(PAGE)).toMatch(/supportEmail !== ""/);
  });

  // ADR-131: the inbox is the admin's General setting, and the card opens the
  // compose window already addressed AND with a subject line in it.
  it("builds the email card from the Support email setting, with a subject filled in", () => {
    const source = read(PAGE);
    expect(source).toContain('getSetting("site.supportEmail")');
    expect(source).toMatch(/mailto:\$\{supportEmail\}\?subject=\$\{encodeURIComponent\(/);
    expect(SUPPORT_CHANNELS.find((channel) => channel.kind === "email")?.href).toBeNull();
  });

  // wa.me wants digits only; a `+` in the path is not the documented form.
  it("links WhatsApp by digits alone", () => {
    const href = SUPPORT_CHANNELS.find((channel) => channel.kind === "whatsapp")?.href ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+$/);
  });

  // `noopener` is what stops the opened page reaching back through
  // `window.opener`. Only the off-site link needs it; `mailto:` and `tel:`
  // open no document.
  it("opens the off-site link with rel=noopener", () => {
    // Matched on the VALUE, not on an attribute spelling: the page applies
    // it through a conditional spread, so `rel="…"` never appears literally.
    expect(read(PAGE)).toContain("noopener noreferrer");
  });
});

describe("the FAQ", () => {
  it("carries the owner's seven questions", () => {
    expect(SUPPORT_FAQ).toHaveLength(7);
  });

  it("gives every question a non-empty answer", () => {
    for (const item of SUPPORT_FAQ) {
      expect(item.question.trim()).not.toBe("");
      expect(item.answer.trim()).not.toBe("");
    }
  });

  // These are plain strings from a `.ts` file, never editor HTML, so
  // `FaqPanel` must be told so — `format="html"` would render them through the
  // rich-text path and any stray angle bracket with it.
  it("renders them as text, not HTML", () => {
    expect(read(PAGE)).toContain('format="text"');
  });

  it("holds no markup, which is what makes the text renderer correct", () => {
    for (const item of SUPPORT_FAQ) expect(item.answer).not.toMatch(/<[a-z/]/i);
  });
});

describe("the contact form accepts submissions", () => {
  const source = read(FORM);

  // The first assertion this file exists for. The newsletter form shipped
  // hard-`disabled` for eighteen change-sets under "coming soon"; the failure
  // mode worth guarding is not a deliberate re-add, it is a revert quietly
  // bringing one back and leaving a form that looks finished and accepts
  // nothing.
  it("has no disabled control", () => {
    expect(source).not.toMatch(/\bdisabled\b/);
  });

  // ADR-156: with reCAPTCHA off (no site key from Settings), the form still
  // posts the action directly and works before hydration. With a key it has to
  // mint a token first, which needs JavaScript.
  it("submits through a form action, so it works before hydration when reCAPTCHA is off", () => {
    expect(source).toContain("action={captchaSiteKey ? submitWithCaptcha : formAction}");
    expect(read(PAGE)).toContain("captchaSiteKey={captchaSiteKey}");
    expect(source).toContain("useActionState");
  });

  it("adds the reCAPTCHA token for the `support` action before the server action sees it", () => {
    expect(source).toContain("getCaptchaToken(CAPTCHA_ACTIONS.support)");
    expect(source).toContain("formData.set(CAPTCHA_FIELD");
    const action = read(ACTION);
    expect(action).toContain("verifyCaptchaToken(");
    expect(action).toContain("action: CAPTCHA_ACTIONS.support");
    // After both limits, so a flood costs no request to Google.
    expect(action.indexOf("verifyCaptchaToken(")).toBeGreaterThan(action.indexOf("byEmail.ok"));
  });

  it("posts the locale as a hidden input rather than a closure value", () => {
    expect(source).toMatch(/type="hidden"\s+name="locale"/);
  });

  it("wraps every visible control in a Field with a label (code-style #24)", () => {
    // Four visible controls; the honeypot is a raw input by design.
    expect(source.match(/<Field required>/g) ?? []).toHaveLength(4);
    expect(source.match(/<FieldLabel>/g) ?? []).toHaveLength(4);
  });

  it("is absent, not disabled, when there is no inbox to send to", () => {
    expect(read(PAGE)).toMatch(/supportEmail !== "" && \(/);
  });

  // changes-43: the form stays, and the confirmation sits under the Send
  // button in the BRAND's tint (the owner found the blue success panel foreign
  // to the site). It must still be a live region, and errors stay an alert.
  it("confirms a send under the button in the brand's tone, and errors with an alert", () => {
    expect(source).toContain('role="status"');
    expect(source).toContain("bg-primary/10");
    expect(source).not.toContain("success-interactive");
    expect(source).not.toContain("sendAnother");
    expect(source.indexOf('type="submit"')).toBeLessThan(source.indexOf('role="status"'));
    expect(source).toContain('variant="destructive"');
  });

  it("fills in a signed-in learner's name and email", () => {
    expect(source).toContain("usePublicSession");
    expect(source).toContain("learner?.email");
  });
});

describe("the anonymous mutation keeps all five of its guards", () => {
  const source = read(ACTION);

  // ADR-113's whole argument. Each of these stands in for one part of the
  // `requirePermission()` this endpoint cannot have; deleting any one of them
  // should fail here before it fails in production.
  it.each([
    ["a recorded inbox", 'getSetting("site.contactEmail")'],
    ["the honeypot", "SUPPORT_HONEYPOT_FIELD"],
    ["the schema", "supportRequestSchema"],
    ["a per-IP limit", "support:ip:"],
    ["a per-address limit", "support:email:"],
  ])("still checks %s", (_label, needle) => {
    expect(source).toContain(needle);
  });

  // The property that stops it being an open relay: the destination comes
  // from a staff-only setting (ADR-131), never from the request.
  it("never reads a destination off the form", () => {
    expect(source).not.toMatch(/formData\.get\(\s*["']to["']\s*\)/);
    expect(source).toContain(
      'const to = (await getSetting("site.contactEmail")) || (await getSetting("site.supportEmail"));',
    );
  });

  // Two is a pattern; a third without its own ADR is how a repo ends up with
  // an anonymous write nobody audited. A honeypot constant is the marker,
  // because it is the one thing ONLY a subject-less mutation needs: a form
  // behind a session has a session to check instead.
  it("is the SECOND such action, and a third has to be declared", () => {
    const dir = resolve(APP_ROOT, "(public)/[locale]/_actions");
    const anonymous = readdirSync(dir)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .filter((file) => readFileSync(resolve(dir, file), "utf8").includes("HONEYPOT_FIELD"))
      .sort();

    expect(anonymous).toEqual(["newsletter.ts", "support.ts"]);
  });
});

describe("the last band names four places, and every one of them exists", () => {
  const source = read(PAGE);

  it("no longer calls itself Coming Soon", () => {
    // It had four cards and three of them LINKED. The heading was true of
    // exactly one — a community forum this site does not have and is not
    // building — and a band that says "coming soon" over three working
    // destinations teaches a reader to scroll past it (changes-36).
    expect(source).not.toContain("comingSoon");
    expect(source).toContain('t("moreHelp.title")');
  });

  it("offers courses where it offered a forum", () => {
    // The replacement is not arbitrary: what a forum stands in for is
    // somewhere to go and learn the thing rather than ask about it, which is
    // what `/learn` already is.
    expect(source).toMatch(/key:\s*"courses"/);
    expect(source).not.toContain('"community"');
  });

  it("gives every entry a destination, so the flag-off case is the only static one", () => {
    const registry = source.slice(source.indexOf("const MORE_HELP = ["));
    const entries = [...registry.matchAll(/key:\s*"(\w+)"/g)].map((m) => m[1]);
    expect(entries).toEqual(["helpCenter", "courses", "videos", "phone"]);
    // `href: null` was the forum's, and it was the only one. A new entry with
    // no destination is a decision, and it should fail here first.
    expect(registry.slice(0, registry.indexOf("] as const;"))).not.toContain("href: null");
  });

  it("keeps the link-or-static rule the band is honest because of", () => {
    // A flagged-off section still renders its card, in muted ink with no
    // arrow — the reader is told the thing exists and is not handed a 404
    // (changes-11 D25). Deleting this branch is how a dead link gets shipped.
    expect(source).toContain("href === null");
    expect(source).toContain("isFeatureVisible");
  });
});

describe("the facts file stays the owner's to edit", () => {
  const source = raw(FACTS);

  // It must remain emptyable: the page's gates are all `=== ""` / `.length`
  // tests, and `as const` on the contact object would make one of them a
  // compile error instead.
  it("types the contact object rather than freezing it to literals", () => {
    expect(source).toContain("SUPPORT_CONTACT: SupportContact");
  });

  it("imports nothing, so it stays build-time data", () => {
    expect(source).not.toMatch(/^import /m);
  });

  it("dials and displays the same number", () => {
    expect(SUPPORT_CONTACT.phoneDisplay.replace(/[^\d+]/g, "")).toBe(SUPPORT_CONTACT.phone);
  });
});
