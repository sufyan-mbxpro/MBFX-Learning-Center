// changes-61 guards: the tab-count treatment and the credential forms'
// hand-off to the next page. Source guards, like the other convention tests,
// because what they protect is a pattern across files rather than one unit.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(__dirname);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : tsxFiles(path);
    return path.endsWith(".tsx") && !path.endsWith(".test.tsx") ? [path] : [];
  });
}

const read = (path: string) => readFileSync(join(APP, path), "utf8");

describe("a tab's count is TabsCount, so only the selected one is filled", () => {
  it("no TabsTrigger carries a Badge as its count", () => {
    const offenders = tsxFiles(APP).filter((file) =>
      /<TabsTrigger[^>]*>(?:(?!<\/TabsTrigger>)[\s\S])*<Badge/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("both strips with counts use it", () => {
    expect(read("(admin)/keystone/settings/email/(tabs)/templates/template-gallery.tsx")).toContain(
      "<TabsCount>",
    );
    expect(read("(admin)/keystone/announcements/announcements-table.tsx")).toContain("<TabsCount>");
  });
});

describe("a successful sign-in leaves without the form flickering back", () => {
  it("reading the reCAPTCHA answer does not reset the box", () => {
    const recaptcha = read("_lib/recaptcha.ts");
    const readCheckbox = /function readCheckbox[\s\S]*?\n}\n/.exec(recaptcha)?.[0] ?? "";
    expect(readCheckbox).not.toBe("");
    expect(readCheckbox).not.toContain(".reset(");
    expect(recaptcha).toContain("export function resetCaptcha()");
  });

  it.each([
    "(public)/[locale]/sign-in/sign-in-form.tsx",
    "(admin-auth)/keystone/admin-sign-in-form.tsx",
    "(public)/[locale]/sign-up/sign-up-form.tsx",
  ])("%s awaits navigateAway instead of a bare location.assign", (file) => {
    const source = read(file);
    expect(source).toContain("navigateAway(");
    expect(source).not.toContain("window.location.assign(");
  });

  it("the support form clears a spent answer once the action has answered", () => {
    expect(read("(public)/[locale]/support/_components/support-form.tsx")).toContain(
      'if (state.status !== "idle") resetCaptcha();',
    );
  });
});
