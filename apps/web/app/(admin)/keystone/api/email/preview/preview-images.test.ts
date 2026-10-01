import { describe, expect, it } from "vitest";
import { previewImagesFromViewer } from "./preview-images";

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
