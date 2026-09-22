// ADR-124 — consent at sign-up, subscribe bands hidden for a signed-in reader,
// and the admin's Resubscribe and Add subscriber.
//
// Read as SOURCE, like `newsletter-signup.test.ts` and `public-session.test.ts`:
// `apps/web` has no jsdom runner, and every rule here is a property of the
// markup or of the order of lines in an action. The database half — what each
// service actually writes — is `packages/core/src/newsletter-consent.integration.test.ts`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SIGNED_OUT_ONLY_CLASS,
  SESSION_HINT_KEY,
  buildSessionHintScript,
} from "./_lib/session-hint.ts";

const APP_ROOT = resolve(process.cwd(), "app");
const read = (relative: string) =>
  readFileSync(resolve(APP_ROOT, relative), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");

describe("the sign-up opt-in (ADR-124 §1)", () => {
  const form = read("(public)/[locale]/sign-up/sign-up-form.tsx");
  const action = read("(public)/[locale]/_actions/newsletter-opt-in.ts");

  it("is never pre-ticked", () => {
    expect(form).toContain("useState(false)");
    expect(form).not.toMatch(/defaultChecked/);
    expect(form).toContain("checked={newsletter}");
  });

  it("is absent when the newsletter flag is off", () => {
    expect(form).toContain("newsletterEnabled && (");
    expect(read("(public)/[locale]/sign-up/page.tsx")).toContain(
      'isFeatureVisible("newsletter", null)',
    );
  });

  it("runs only after the account exists, and only when ticked", () => {
    const signUp = form.indexOf("signUpWithPassword(");
    const optIn = form.indexOf("optInToNewsletterAction(");
    expect(signUp).toBeGreaterThan(-1);
    expect(optIn).toBeGreaterThan(signUp);
    expect(form).toContain("newsletterEnabled && newsletter");
  });

  it("the action reads the session first and never takes an address", () => {
    expect(action).toContain('"use server"');
    const body = action.slice(action.indexOf("export async function"));
    expect(body.indexOf("await auth()")).toBeGreaterThan(-1);
    expect(body.indexOf("await auth()")).toBeLessThan(body.indexOf("isFeatureVisible"));
    expect(body).toContain("session.user.id");
    expect(body).not.toMatch(/\bemail\b/);
    expect(body).toContain("newsletterAccountOptInSchema");
    expect(body).toContain("newsletter:account:");
  });

  it("verification activates it, wired where the verification link lands", () => {
    const route = read("api/auth/[...all]/route.ts");
    expect(route).toContain("onEmailVerified(");
    expect(route).toContain("activateAccountSubscription");
  });
});

describe("subscribe bands are hidden for a signed-in reader (ADR-124 §3)", () => {
  const PLACEMENTS = [
    "(public)/[locale]/_components/footer.tsx",
    "(public)/[locale]/_sections/newsletter.tsx",
    "(public)/[locale]/_sections/connect.tsx",
    "(public)/[locale]/news/page.tsx",
    "(public)/[locale]/analysis/page.tsx",
  ];

  it.each(PLACEMENTS)("%s marks its band signed-out-only", (relative) => {
    expect(read(relative)).toContain("SIGNED_OUT_ONLY_CLASS");
  });

  it("hides by CSS keyed on the pre-paint attribute, not by a render after the fetch", () => {
    // A class the server HTML carries, so the cached page is unchanged and the
    // band is gone before first paint rather than collapsing after it.
    expect(SIGNED_OUT_ONLY_CLASS).toBe("in-data-[session=learner]:hidden");
    for (const relative of PLACEMENTS) {
      expect(read(relative)).not.toContain("usePublicSession");
    }
  });

  it("the layout injects the hint script, and the provider keeps it honest", () => {
    expect(read("(public)/[locale]/layout.tsx")).toContain("<SessionHintScript />");
    expect(read("(public)/[locale]/_components/session-hint-script.tsx")).toContain(
      "useServerInsertedHTML",
    );
    expect(read("(public)/[locale]/_components/public-session.tsx")).toContain(
      "rememberSession(signedIn)",
    );
    expect(read("_lib/credentials.ts")).toContain("rememberSession(false)");
  });

  it("the script is self-contained and reads only its own key", () => {
    const script = buildSessionHintScript();
    expect(script).toContain(JSON.stringify(SESSION_HINT_KEY));
    expect(script).toContain("data-session");
    // Executable on its own: parsing it must not throw.
    expect(() => new Function(script)).not.toThrow();
  });
});

describe("the admin's Resubscribe and Add subscriber (ADR-124 §2, §4)", () => {
  const actions = read("(admin)/keystone/_actions/newsletter-actions.ts");
  const table = read("(admin)/keystone/newsletter/subscribers-table.tsx");

  it.each(["resubscribeSubscriberAction", "addSubscriberAction"])(
    "%s checks newsletter.manage first, then parses",
    (name) => {
      const body = actions.slice(actions.indexOf(`export async function ${name}`));
      const next = body.indexOf("export async function", 1);
      const fn = next === -1 ? body : body.slice(0, next);
      const permission = fn.indexOf('requirePermission("newsletter.manage")');
      expect(permission).toBeGreaterThan(-1);
      expect(permission).toBeLessThan(fn.indexOf(".parse("));
    },
  );

  it("Resubscribe is not behind a ConfirmDialog — restore is the undo (code-style #7)", () => {
    const item = table.slice(
      table.indexOf('row.status === "UNSUBSCRIBED" ?'),
      table.indexOf("labels.resubscribeAction"),
    );
    expect(item).toContain("resubscribeSubscriberAction");
    expect(item).not.toContain("ConfirmDialog");
    expect(item).not.toContain("setConfirm");
  });

  it("Add subscriber sits on the title row and its dialog has a header and Fields", () => {
    // ADR-140 §3 moved it out of the table toolbar and onto the heading row.
    expect(table).toContain("<HeaderActions>");
    expect(table).toContain("<DialogTitle>{labels.addTitle}</DialogTitle>");
    expect(table).toContain("<DialogDescription>{labels.addDescription}</DialogDescription>");
    expect(table).toContain("useFieldErrors(adminAddSubscriberSchema");
    expect(table).toContain("<FieldError>");
  });
});
