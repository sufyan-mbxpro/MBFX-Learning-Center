import { describe, expect, it } from "vitest";
import { previewImagesFromViewer, viewerOrigin } from "./preview-images";

const site = "https://tunnel.example.com";
const viewer = "http://localhost:3003";

describe("previewImagesFromViewer", () => {
  it("loads a site image from the origin the admin is on", () => {
    const html = `<img src="${site}/uploads/brand/logo.png" alt="MBX" />`;
    expect(previewImagesFromViewer(html, site, viewer)).toBe(
      `<img src="${viewer}/uploads/brand/logo.png" alt="MBX" />`,
    );
  });

  it("leaves links, other hosts and a look-alike host as they are", () => {
    const html = [
      `<a href="${site}/learn">Learn</a>`,
      `<img src="https://cdn.example.org/a.png" />`,
      `<img src="${site}.evil.test/a.png" />`,
    ].join("");
    expect(previewImagesFromViewer(html, site, viewer)).toBe(html);
  });

  it("is a no-op when the origins already agree", () => {
    const html = `<img src="${viewer}/uploads/logo.png" />`;
    expect(previewImagesFromViewer(html, viewer, viewer)).toBe(html);
  });
});

describe("viewerOrigin", () => {
  // Behind Cloudflare and the reverse proxy, `request.url` is the server's own
  // address: rewriting the logo to it broke every live preview.
  const internal = "http://127.0.0.1:3000/keystone/api/email/preview";

  it("prefers the Origin the browser sent", () => {
    const request = new Request(internal, {
      method: "POST",
      headers: { origin: "https://learn.mbxpro.com", "x-forwarded-host": "other.test" },
    });
    expect(viewerOrigin(request)).toBe("https://learn.mbxpro.com");
  });

  it("falls back to the forwarded host, then to the request URL", () => {
    const forwarded = new Request(internal, {
      headers: { "x-forwarded-host": "learn.mbxpro.com", "x-forwarded-proto": "https" },
    });
    expect(viewerOrigin(forwarded)).toBe("https://learn.mbxpro.com");
    expect(viewerOrigin(new Request(internal, { headers: { origin: "null" } }))).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it("never lets a header put anything but an origin into the CSP", () => {
    const request = new Request(internal, {
      headers: { origin: "javascript:alert(1)", "x-forwarded-host": "a.test; script-src *" },
    });
    expect(viewerOrigin(request)).toBe("http://127.0.0.1:3000");
  });
});
