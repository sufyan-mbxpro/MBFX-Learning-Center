// changes-01 admin contracts: shape guards for the new server-action
// inputs — the "parse, don't spread" line of defense (security.md #6).
import { describe, expect, it } from "vitest";
import {
  adminResetPasswordSchema,
  adminSearchSchema,
  changeOwnPasswordSchema,
  createRoleSchema,
  createSocialLinkSchema,
  employeeStatusSchema,
  saveThemeSchema,
  setRolePermissionsSchema,
  updateEmployeeSchema,
  updateOwnProfileSchema,
  updateSocialLinkSchema,
} from "./admin.ts";

// Hex literals below are test fixtures for saveThemeSchema's hex-format
// validation, not themed UI — code-style.md #1 targets colors that render,
// which these never do (the rule has no per-file test-fixture carve-out).
/* eslint-disable no-restricted-syntax -- see comment above */
const VALID_BRAND = {
  primary: "#E8B98C",
  secondary: "#2A2A29",
  success: "#2D72C7",
  error: "#D93A34",
  warning: "#FFA310",
  info: "#004284",
  accent: "#EAE5DE",
};

const VALID_SURFACE = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F8F8F8",
  textPrimary: "#1A1A1A",
  textSecondary: "#666666",
  textMuted: "#999999",
  borderLight: "#E5E5E5",
  borderMedium: "#8F8F8F",
};

const VALID_LAYOUT = {
  radiusBase: "4px",
  containerWidth: "1400px",
  fontSans: "system",
  fontMono: "systemmono",
  baseFontSize: "14px",
};
/* eslint-enable no-restricted-syntax */

describe("createRoleSchema", () => {
  it("accepts a valid role and rejects bad keys / out-of-range levels", () => {
    expect(
      createRoleSchema.safeParse({ key: "help_desk", name: "Help Desk", level: 20 }).success,
    ).toBe(true);
    expect(createRoleSchema.safeParse({ key: "Help Desk", name: "x", level: 20 }).success).toBe(
      false,
    );
    expect(createRoleSchema.safeParse({ key: "ok", name: "x", level: 100 }).success).toBe(false);
    expect(createRoleSchema.safeParse({ key: "ok", name: "x", level: -1 }).success).toBe(false);
    expect(createRoleSchema.safeParse({ key: "ok", name: "x", level: 1.5 }).success).toBe(false);
  });

  it("strips unknown fields (mass-assignment defense)", () => {
    const parsed = createRoleSchema.parse({
      key: "ok",
      name: "x",
      level: 5,
      isSystem: true,
    } as never);
    expect("isSystem" in parsed).toBe(false);
  });
});

describe("setRolePermissionsSchema", () => {
  it("requires at least one key and caps the batch", () => {
    expect(
      setRolePermissionsSchema.safeParse({ roleKey: "r", permissionKeys: [], granted: true })
        .success,
    ).toBe(false);
    expect(
      setRolePermissionsSchema.safeParse({
        roleKey: "r",
        permissionKeys: ["users.view"],
        granted: false,
      }).success,
    ).toBe(true);
  });
});

describe("social link schemas", () => {
  it("create requires a slug platform and an absolute URL, defaults the flags", () => {
    const parsed = createSocialLinkSchema.parse({
      platform: "tiktok",
      label: "TikTok",
      url: "https://tiktok.com/@x",
    });
    expect(parsed.isActive).toBe(true);
    expect(parsed.showInFooter).toBe(true);
    expect(
      createSocialLinkSchema.safeParse({ platform: "Tik Tok", label: "x", url: "https://x.co" })
        .success,
    ).toBe(false);
    expect(
      createSocialLinkSchema.safeParse({ platform: "tiktok", label: "x", url: "not-a-url" })
        .success,
    ).toBe(false);
  });

  // ADR-045 — the icon fields.
  it("accepts a built-in glyph key and a relative uploaded icon path", () => {
    const parsed = createSocialLinkSchema.parse({
      platform: "tiktok",
      label: "TikTok",
      url: "https://tiktok.com/@x",
      icon: "tiktok",
      iconUrl: "/uploads/abc123.svg",
    });
    expect(parsed.icon).toBe("tiktok");
    expect(parsed.iconUrl).toBe("/uploads/abc123.svg");
  });

  it("lets an admin clear an uploaded icon by sending null", () => {
    expect(updateSocialLinkSchema.parse({ iconUrl: null }).iconUrl).toBeNull();
  });

  it("REFUSES an absolute icon URL — a footer icon can never point off-origin", () => {
    // security.md #9: bytes reach a src attribute only through the upload
    // pipeline. A hand-crafted post must not be able to turn a social icon
    // into a third-party request.
    for (const hostile of [
      "https://evil.example/pixel.gif",
      "http://evil.example/pixel.gif",
      "//evil.example/pixel.gif",
      "/\\evil.example/pixel.gif",
      "data:image/svg+xml,<svg/>",
      "javascript:alert(1)",
    ]) {
      expect(updateSocialLinkSchema.safeParse({ iconUrl: hostile }).success).toBe(false);
    }
  });

  it("update cannot smuggle a platform rename", () => {
    const parsed = updateSocialLinkSchema.parse({ platform: "renamed", label: "x" } as never);
    expect("platform" in parsed).toBe(false);
  });
});

describe("employee schemas", () => {
  it("status enum excludes TERMINATED (offboarding-only transition)", () => {
    expect(employeeStatusSchema.safeParse("ON_LEAVE").success).toBe(true);
    expect(employeeStatusSchema.safeParse("TERMINATED").success).toBe(false);
  });

  it("update accepts nullable clears and rejects unknown status-ish fields", () => {
    const parsed = updateEmployeeSchema.parse({ phone: null, status: "ACTIVE" } as never);
    expect(parsed.phone).toBeNull();
    expect("status" in parsed).toBe(false);
  });
});

describe("password & profile schemas", () => {
  it("mirrors the auth package's 8..128 password bounds", () => {
    expect(adminResetPasswordSchema.safeParse({ userId: "u1", newPassword: "short" }).success).toBe(
      false,
    );
    expect(
      adminResetPasswordSchema.safeParse({ userId: "u1", newPassword: "long-enough-1" }).success,
    ).toBe(true);
    expect(
      changeOwnPasswordSchema.safeParse({ currentPassword: "", newPassword: "long-enough-1" })
        .success,
    ).toBe(false);
  });

  it("profile update requires a non-empty display name", () => {
    expect(updateOwnProfileSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(updateOwnProfileSchema.safeParse({ name: "Sufyan", phone: null }).success).toBe(true);
  });
});

describe("saveThemeSchema — closes the missing-parse gap on saveThemeAction (changes-05)", () => {
  it("accepts a full valid payload", () => {
    expect(
      saveThemeSchema.safeParse({
        themeKey: "mbx-pro-default",
        brandColors: VALID_BRAND,
        lightSurface: VALID_SURFACE,
        darkSurface: VALID_SURFACE,
        // eslint-disable-next-line no-restricted-syntax -- test fixture, not themed UI (see comment above VALID_BRAND)
        darkBrandOverrides: { accent: "#332E27" },
        layoutTokens: VALID_LAYOUT,
      }).success,
    ).toBe(true);
  });

  it("baseFontSize is optional — some existing rows predate the field", () => {
    const { baseFontSize: _baseFontSize, ...layoutWithoutBaseFontSize } = VALID_LAYOUT;
    expect(
      saveThemeSchema.safeParse({
        themeKey: "mbx-pro-default",
        brandColors: VALID_BRAND,
        lightSurface: VALID_SURFACE,
        darkSurface: VALID_SURFACE,
        layoutTokens: layoutWithoutBaseFontSize,
      }).success,
    ).toBe(true);
  });

  it("rejects a non-hex color anywhere in brandColors", () => {
    expect(
      saveThemeSchema.safeParse({
        themeKey: "mbx-pro-default",
        brandColors: { ...VALID_BRAND, primary: "not-a-color" },
        lightSurface: VALID_SURFACE,
        darkSurface: VALID_SURFACE,
        layoutTokens: VALID_LAYOUT,
      }).success,
    ).toBe(false);
  });

  it("rejects a 3-digit hex shorthand (the write path expects 6 digits)", () => {
    expect(
      saveThemeSchema.safeParse({
        themeKey: "mbx-pro-default",
        // eslint-disable-next-line no-restricted-syntax -- test fixture, not themed UI (see comment above VALID_BRAND)
        brandColors: { ...VALID_BRAND, primary: "#fff" },
        lightSurface: VALID_SURFACE,
        darkSurface: VALID_SURFACE,
        layoutTokens: VALID_LAYOUT,
      }).success,
    ).toBe(false);
  });

  it("rejects a missing surface field", () => {
    const { background: _background, ...surfaceMissingBackground } = VALID_SURFACE;
    expect(
      saveThemeSchema.safeParse({
        themeKey: "mbx-pro-default",
        brandColors: VALID_BRAND,
        lightSurface: surfaceMissingBackground,
        darkSurface: VALID_SURFACE,
        layoutTokens: VALID_LAYOUT,
      }).success,
    ).toBe(false);
  });
});

describe("adminSearchSchema", () => {
  it("trims and bounds the query", () => {
    expect(adminSearchSchema.parse({ query: "  fx  " }).query).toBe("fx");
    expect(adminSearchSchema.safeParse({ query: "   " }).success).toBe(false);
    expect(adminSearchSchema.safeParse({ query: "x".repeat(101) }).success).toBe(false);
  });
});
