import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  LEGAL_DOCUMENT_KEYS,
  LEGAL_DOCUMENT_MIME,
  LEGAL_DOCUMENT_SETTING,
  legalDocumentPath,
  SETTINGS_SCHEMAS,
  STORED_UPLOAD_PREFIX,
} from "@repo/contracts";

// changes-33 / ADR-110 — the legal documents.
//
// Three properties, and every one of them is the kind that a plausible future
// edit undoes without anything else noticing.

const ROOT = join(import.meta.dirname);
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const ROUTE = read("(public)/[locale]/legal/[doc]/route.ts");
const UPLOADS = read("uploads/[...key]/route.ts");
const FOOTER = read("(public)/[locale]/_components/footer.tsx");

describe("the registry", () => {
  it("gives every document a setting that the settings schema knows", () => {
    for (const key of LEGAL_DOCUMENT_KEYS) {
      const settingKey = LEGAL_DOCUMENT_SETTING[key];
      expect(SETTINGS_SCHEMAS, settingKey).toHaveProperty(settingKey);
    }
  });

  it("addresses a document by OUR path, never by the file's", () => {
    for (const key of LEGAL_DOCUMENT_KEYS) {
      expect(legalDocumentPath(key)).toBe(`/legal/${key}`);
    }
  });
});

describe("what a legal-document setting may hold", () => {
  const schema = SETTINGS_SCHEMAS["legal.termsDocument"];

  it("accepts the two internal shapes that actually reach it", () => {
    // A seeded install points at a committed file; an admin's upload points
    // at the storage driver.
    expect(schema.safeParse("/legal/terms.pdf").success).toBe(true);
    expect(schema.safeParse("/uploads/9f2c1a3b4d5e6f70.pdf").success).toBe(true);
  });

  it("accepts empty — a document this installation has not published", () => {
    expect(schema.safeParse("").success).toBe(true);
  });

  it("refuses an external URL", () => {
    // A legal document hosted elsewhere can be moved, paywalled or edited by
    // someone who does not work here, while the footer keeps asserting it is
    // ours.
    expect(schema.safeParse("https://example.com/terms.pdf").success).toBe(false);
  });

  it("refuses a protocol-relative URL, which passes every naive startsWith('/')", () => {
    expect(schema.safeParse("//evil.example/terms.pdf").success).toBe(false);
  });
});

describe("the route", () => {
  it("serves a stored upload INLINE — the one exception to ADR-034 §1", () => {
    expect(ROUTE).toContain('"Content-Disposition": "inline"');
  });

  it("allows that exception for PDF and nothing else", () => {
    // The MIME recorded at upload decides, not the extension and not the
    // route's wish. Without this an admin could point the setting at any
    // stored file and have it rendered under a PDF header.
    expect(ROUTE).toContain("LEGAL_DOCUMENT_MIME");
    expect(ROUTE).toContain("!== LEGAL_DOCUMENT_MIME");
    expect(LEGAL_DOCUMENT_MIME).toBe("application/pdf");
  });

  it("leaves /uploads/[...key]'s attachment default alone", () => {
    // The narrowness IS the argument. `/uploads/[...key]` still sends every
    // DOCUMENT as an attachment, because nothing there knows it was asked for
    // on purpose — ADR-034 §1 is unchanged everywhere except the route above.
    expect(UPLOADS).toContain("contentDispositionFor");
    expect(UPLOADS).not.toContain('"inline"');
  });

  it("branches on the storage prefix rather than on a file extension", () => {
    expect(ROUTE).toContain("STORED_UPLOAD_PREFIX");
    expect(STORED_UPLOAD_PREFIX).toBe("/uploads/");
  });

  it("404s an unknown document rather than 400ing it", () => {
    // Which documents exist is not something a visitor should be able to
    // enumerate by watching status codes.
    expect(ROUTE).toContain("isLegalDocumentKey");
    expect(ROUTE).not.toContain("status: 400");
  });
});

describe("the footer's link row", () => {
  it("reads the registry rather than naming the three documents", () => {
    expect(FOOTER).toContain("LEGAL_DOCUMENT_KEYS");
    expect(FOOTER).toContain("legalDocumentPath");
  });

  it("omits a document with no file behind it", () => {
    // Absent, not a link to a 404 — an installation that has published two of
    // the three shows two.
    expect(FOOTER).toContain("legalDocuments[index]");
  });

  it("opens each one in a new tab, with the rel that makes that safe", () => {
    expect(FOOTER).toContain('rel="noopener noreferrer"');
  });
});
