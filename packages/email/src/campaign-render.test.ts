// ADR-172 #4: a custom or direct email renders its OWN words under a campaign
// key that owns no stored body. The renderer's rules are the same ones every
// template obeys — sanitise, assemble, then substitute escaped values — and
// the campaign keys require the unsubscribe link, because every such message
// carries the footer.
import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, DEFAULT_LIGHT_SURFACE } from "@repo/theme";
import { EmailRenderError, renderEmail } from "./render.ts";
import type { EmailPalette } from "./layout.ts";

const palette: EmailPalette = {
  brand: DEFAULT_BRAND,
  surface: DEFAULT_LIGHT_SURFACE,
  fontFamily: "Inter, Arial, sans-serif",
};

const VARIABLES = {
  "site.name": "MBX Learning Center",
  "site.url": "https://example.com",
  "logo.url": "https://example.com/logo.png",
  year: "2026",
  "recipient.name": "Alex <b>Morgan</b>",
  "recipient.email": "alex@example.com",
  "unsubscribe.url": "https://example.com/email/unsubscribe?t=v1.x.y",
};

function render(overrides: Partial<Parameters<typeof renderEmail>[0]> = {}) {
  return renderEmail({
    key: "campaign.custom",
    mode: "RICH",
    subject: "Hello {{recipient.name}}",
    bodyHtml: '<p onclick="x()">Hi {{recipient.name}}</p><script>alert(1)</script>',
    variables: VARIABLES,
    palette,
    shell: {
      siteName: "MBX Learning Center",
      postalAddress: "1 Example Street",
      unsubscribe: { url: VARIABLES["unsubscribe.url"], label: "Unsubscribe" },
    },
    ...overrides,
  });
}

describe("rendering a campaign's own words", () => {
  it("sanitises the author's body and escapes the values put into it", () => {
    const email = render();
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("onclick");
    expect(email.html).toContain("Alex &lt;b&gt;Morgan&lt;/b&gt;");
    expect(email.subject).toBe("Hello Alex <b>Morgan</b>");
  });

  it("wraps a RICH body in the shell, with the postal address and the way out", () => {
    const email = render();
    expect(email.html).toContain("1 Example Street");
    expect(email.html).toContain("https://example.com/email/unsubscribe?t=v1.x.y");
  });

  it("requires the unsubscribe link from its caller, under both keys", () => {
    const { "unsubscribe.url": _dropped, ...withoutLink } = VARIABLES;
    for (const key of ["campaign.custom", "campaign.direct"] as const) {
      expect(() => render({ key, variables: withoutLink })).toThrow(EmailRenderError);
    }
  });
});
