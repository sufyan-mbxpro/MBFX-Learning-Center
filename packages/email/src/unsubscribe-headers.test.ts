import { describe, expect, it } from "vitest";
import { listUnsubscribeHeaders } from "./unsubscribe-headers.ts";

describe("listUnsubscribeHeaders (changes-54 §9.3)", () => {
  it("points the header at the one-click handler, not the footer page", () => {
    const headers = listUnsubscribeHeaders({
      url: "https://example.test/newsletter/unsubscribe?token=abc",
      label: "Unsubscribe",
      oneClickUrl: "https://example.test/api/newsletter/unsubscribe?token=abc",
    });
    expect(headers?.["List-Unsubscribe"]).toBe(
      "<https://example.test/api/newsletter/unsubscribe?token=abc>",
    );
    expect(headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("falls back to the footer url when no handler is given", () => {
    expect(
      listUnsubscribeHeaders({ url: "https://example.test/x", label: "Unsubscribe" })?.[
        "List-Unsubscribe"
      ],
    ).toBe("<https://example.test/x>");
  });

  it("adds no headers to a message that is not a list message", () => {
    expect(listUnsubscribeHeaders(undefined)).toBeUndefined();
  });
});
