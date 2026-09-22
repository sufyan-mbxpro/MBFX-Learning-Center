// changes-21 F5 / ADR-078 #4, #8 — the email admin surface's two invisible
// properties.
//
// Read as source, like `admin-dialog-conventions.test.ts` and the other
// app-level guards: these are server actions and async server components behind
// a session, and both properties are syntactic — which key guards which action,
// and which surface is allowed to be framed. Importing them would mean a
// database and a session to assert how they were declared.
//
// The runtime half of the boundary is tested where it lives:
// `packages/core/src/email-admin.integration.test.ts` asserts the transport view
// never carries the password, and `packages/db/src/role-exclusions.test.ts`
// asserts no role but `super_admin` holds the key.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP = resolve(process.cwd(), "app");
const read = (relative: string) => readFileSync(resolve(APP, relative), "utf8");

const ACTIONS = read("(admin)/keystone/_actions/email-actions.ts");
// changes-51: the transport is the Delivery tab of the email section.
const SETTINGS_PAGE = read("(admin)/keystone/settings/email/(tabs)/delivery/page.tsx");
const PREVIEW_ROUTE = read("(admin)/keystone/api/email/preview/route.ts");
const PROXY = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");

/** The body of each exported action, up to the next export. */
function actionBodies(source: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const starts = [...source.matchAll(/^export async function (\w+)/gm)];
  starts.forEach((match, index) => {
    const from = match.index ?? 0;
    const to = starts[index + 1]?.index ?? source.length;
    bodies.set(match[1]!, source.slice(from, to));
  });
  return bodies;
}

const bodies = actionBodies(ACTIONS);

describe("every email action gates before it does anything (security.md #1)", () => {
  it("finds the actions at all", () => {
    expect([...bodies.keys()].sort()).toEqual(
      [
        "resetEmailTemplateAction",
        "saveEmailTemplateAction",
        "saveEmailTransportAction",
        "sendTestEmailAction",
        "setEmailTemplateActiveAction",
        "testEmailConnectionAction",
      ].sort(),
    );
  });

  it.each([...bodies.keys()])("%s calls requirePermission as its FIRST statement", (name) => {
    // The first statement INSIDE the body, not the first line of the
    // declaration — several of these have multi-line signatures and return
    // types. Not "mentions requirePermission somewhere" either: a parse that
    // runs first is a parse an unauthenticated caller reaches.
    // The body starts after the first line that ENDS with `{`. Scanning for the
    // first `{` instead finds the one inside a return type
    // (`Promise<{ status: string }>`), which is how this guard first passed
    // while asserting nothing.
    const lines = bodies.get(name)!.split("\n");
    const signatureEnd = lines.findIndex((line) => line.trimEnd().endsWith("{"));
    const firstStatement = lines
      .slice(signatureEnd + 1)
      .map((line) => line.trim())
      .find((line) => line !== "");
    expect(firstStatement).toMatch(/requirePermission\(/);
  });

  it.each([
    ["saveEmailTransportAction", "email.settings.manage"],
    ["testEmailConnectionAction", "email.settings.manage"],
    ["saveEmailTemplateAction", "email.templates.update"],
    ["setEmailTemplateActiveAction", "email.templates.update"],
    ["resetEmailTemplateAction", "email.templates.update"],
    ["sendTestEmailAction", "email.templates.test"],
  ])("%s requires %s", (name, key) => {
    expect(bodies.get(name)).toContain(`requirePermission("${key}")`);
  });

  it("parses every input through a @repo/contracts schema, never a cast", () => {
    for (const [name, body] of bodies) {
      if (name === "testEmailConnectionAction") continue; // takes no input
      expect(body, name).toMatch(/\.parse\(/);
      expect(body, name).not.toMatch(/\bas unknown as\b|\bas [A-Z]\w+(?!\[)/);
    }
  });

  it("rate-limits the test send, which is the one action that mails an arbitrary address", () => {
    expect(bodies.get("sendTestEmailAction")).toMatch(/rateLimit\(`email:test:\$\{subject\.id\}`/);
  });
});

describe("the settings screen splits by permission, absent not disabled (ADR-078 #4)", () => {
  it("renders the transport form only behind email.settings.manage", () => {
    expect(SETTINGS_PAGE).toContain('can(subject, "email.settings.manage")');
    // A ternary, so the alternative is the read-only summary — not `disabled`,
    // which invites someone to ask for the key.
    expect(SETTINGS_PAGE).toMatch(/canManageTransport \? \(/);
    expect(SETTINGS_PAGE).toContain("EmailDeliveryReadOnly");
  });

  it("never passes a password into the transport form", () => {
    // The form receives `EmailTransportView`, which has no such property — this
    // catches a prop added alongside it.
    expect(SETTINGS_PAGE).not.toMatch(/password=\{/);
  });
});

describe("the preview is isolated, and it is the only framable admin path (ADR-078 #8)", () => {
  it("serves its own sandbox CSP", () => {
    expect(PREVIEW_ROUTE).toContain('"Content-Security-Policy"');
    expect(PREVIEW_ROUTE).toMatch(/sandbox; default-src 'none'/);
  });

  it("gates on a permission key of its own, never on the proxy", () => {
    expect(PREVIEW_ROUTE).toContain('requirePermission("email.templates.view")');
  });

  it("is the single entry in the proxy's framable allowlist", () => {
    // The BEHAVIOUR — this path SAMEORIGIN, every other /keystone path DENY — is
    // asserted in `proxy.test.ts` against the real `proxy()`. This asserts what
    // behaviour cannot enumerate: that the allowlist has exactly one member, so
    // a second entry is a deliberate change rather than a quiet one.
    const list = PROXY.match(/ADMIN_FRAMABLE_PATHS = new Set\(\[([\s\S]*?)\]\)/);
    expect(list).not.toBeNull();
    const paths = [...(list?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    expect(paths).toEqual(["/keystone/api/email/preview"]);
  });

  it("the editor frames it with an empty sandbox and does not use srcDoc", () => {
    const editor = read("(admin)/keystone/settings/email/templates/[key]/template-editor.tsx");
    expect(editor).toContain('sandbox=""');
    // Code only: the file's own comments explain why srcDoc is not used, and
    // they would otherwise fail this. srcDoc would inherit the admin surface's
    // nonce CSP, which is the whole reason this is a route and not a string.
    const code = editor.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}|\/\/.*$/gm, "");
    expect(code).not.toContain("srcDoc");
    expect(code).toContain('method="post"');
  });
});
