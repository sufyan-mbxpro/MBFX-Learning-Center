// Pure unit test — no Testcontainers. Everything else in paths.ts touches
// the database and is covered by pages.integration.test.ts instead.
import { describe, expect, it } from "vitest";
import { PageKind } from "@repo/db";
import { ReservedPathError } from "./errors.ts";
import { assertPathNotReserved } from "./paths.ts";

describe("assertPathNotReserved", () => {
  it("refuses a STATIC path starting with a reserved segment", () => {
    expect(() => assertPathNotReserved("/news", PageKind.STATIC)).toThrow(ReservedPathError);
    expect(() => assertPathNotReserved("/admin/whatever", PageKind.STATIC)).toThrow(
      ReservedPathError,
    );
  });

  it("allows an ordinary STATIC path", () => {
    expect(() => assertPathNotReserved("/about", PageKind.STATIC)).not.toThrow();
  });

  it("exempts COLLECTION pages — their path is the content type's hosting route", () => {
    expect(() => assertPathNotReserved("/news", PageKind.COLLECTION)).not.toThrow();
  });
});
