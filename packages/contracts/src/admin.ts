// Admin-surface contracts (changes-01: users/roles/employees/social/profile
// screens). Every server action parses its input through these before any
// service call — the mass-assignment defense is "parse, don't spread"
// (security.md #6).
import { z } from "zod";

// ─── Roles ───────────────────────────────────────────────────

export const roleKeySchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9_]+$/, "Lowercase letters, digits and underscores only");

export const createRoleSchema = z.object({
  key: roleKeySchema,
  name: z.string().trim().min(1).max(100),
  // Level ceiling mirrors the seed: super_admin sits at 100 and is the only
  // role allowed there; canAssignRole's strict-< guard does the actor-side
  // enforcement.
  level: z.int().min(0).max(99),
  description: z.string().trim().max(500).optional(),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  level: z.int().min(0).max(99).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

/** Bulk grant/revoke — one action per "select all (group)" / "grant all" toggle. */
export const setRolePermissionsSchema = z.object({
  roleKey: roleKeySchema,
  permissionKeys: z.array(z.string().min(1).max(100)).min(1).max(200),
  granted: z.boolean(),
});
export type SetRolePermissionsInput = z.infer<typeof setRolePermissionsSchema>;

// ─── Social links ────────────────────────────────────────────

export const socialLinkPlatformSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits and hyphens only");

/**
 * ADR-045. `icon` names a built-in glyph (same character set as a platform
 * key); `iconUrl` is an admin-uploaded asset and WINS over `icon`.
 *
 * `iconUrl` is a RELATIVE path only — it is written by the upload widget
 * from what `storeImage()` returned, never typed. Rejecting an absolute
 * URL here is the same posture as the rest of the upload pipeline
 * (security.md #9: no arbitrary URL ever enters a src attribute), so a
 * hand-crafted form post cannot turn a footer icon into a third-party
 * beacon.
 */
export const socialLinkIconUrlSchema = z
  .string()
  .trim()
  .max(500)
  // A leading "/" is not enough: "//evil.example/x" is PROTOCOL-RELATIVE
  // (and "/\evil.example/x" is treated the same way by browsers), so both
  // are absolute off-origin URLs that a naive `^/` check would wave
  // through. The second character must be neither slash.
  .regex(/^\/(?![/\\])[^\s]*$/, "Must be a relative upload path")
  .nullable();

export const createSocialLinkSchema = z.object({
  platform: socialLinkPlatformSchema,
  label: z.string().trim().min(1).max(100),
  url: z.url().max(500),
  icon: socialLinkPlatformSchema.optional(),
  iconUrl: socialLinkIconUrlSchema.optional(),
  handle: z.string().trim().max(100).optional(),
  isActive: z.boolean().default(true),
  openInNewTab: z.boolean().default(true),
  showInHeader: z.boolean().default(false),
  showInFooter: z.boolean().default(true),
});
export type CreateSocialLinkInput = z.infer<typeof createSocialLinkSchema>;

export const updateSocialLinkSchema = createSocialLinkSchema.omit({ platform: true }).partial();
export type UpdateSocialLinkInput = z.infer<typeof updateSocialLinkSchema>;

// ─── Employees ───────────────────────────────────────────────

/** TERMINATED is deliberately absent — that transition exists only through
 * the transactional offboarding flow (Module 10), never a status dropdown. */
export const employeeStatusSchema = z.enum(["ACTIVE", "ON_LEAVE", "NOTICE_PERIOD", "RESIGNED"]);
export type EmployeeStatusInput = z.infer<typeof employeeStatusSchema>;

export const updateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  location: z.string().trim().max(150).nullable().optional(),
  departmentId: z.string().max(50).nullable().optional(),
  designationId: z.string().max(50).nullable().optional(),
  reportingToId: z.string().max(50).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

// ─── Passwords & profile ─────────────────────────────────────

/** Mirrors @repo/auth's emailAndPassword config (min 8 / max 128). */
export const passwordSchema = z.string().min(8).max(128);

export const adminResetPasswordSchema = z.object({
  userId: z.string().min(1).max(64),
  newPassword: passwordSchema,
});
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;

export const updateOwnProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
});
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

// ─── Admin user record (changes-45, ADR-142) ─────────────────

/** "Login as user": the one field the start endpoint accepts. */
export const impersonateUserSchema = z.object({ userId: z.string().min(1).max(64) });
export type ImpersonateUserInput = z.infer<typeof impersonateUserSchema>;

/**
 * The admin user page's "Edit details" dialog. Only columns the User row
 * actually has — the reference's address, city and KYC fields describe a
 * brokerage account, and a field that saves nowhere is code-style #28's bug.
 * `name` is derived from first + last by the service, as the learner's own
 * profile form does.
 *
 * changes-46: the address is editable too. Lower-cased and trimmed here, as
 * newsletter signup does and as Better Auth stores a sign-up, so "Ada@X.com"
 * and "ada@x.com" cannot become two accounts through this dialog.
 */
export const adminUpdateUserSchema = z.object({
  userId: z.string().min(1).max(64),
  email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100),
  phone: z.string().trim().max(32),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"]),
  emailVerified: z.boolean(),
});
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

// ─── Theme ───────────────────────────────────────────────────

export const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "6-digit hex color");

/** Mirrors @repo/theme's BrandColors — the seven admin-editable brand swatches. */
const brandColorsSchema = z.object({
  primary: hexColorSchema,
  secondary: hexColorSchema,
  success: hexColorSchema,
  error: hexColorSchema,
  warning: hexColorSchema,
  info: hexColorSchema,
  accent: hexColorSchema,
});

/** Mirrors @repo/theme's SurfacePalette — one mode's eight editable tokens. */
const surfacePaletteSchema = z.object({
  background: hexColorSchema,
  surface: hexColorSchema,
  surfaceMuted: hexColorSchema,
  textPrimary: hexColorSchema,
  textSecondary: hexColorSchema,
  textMuted: hexColorSchema,
  borderLight: hexColorSchema,
  borderMedium: hexColorSchema,
});

/** Mirrors @repo/theme's LayoutTokens. fontSans/fontMono are validated as
 * curated keys at the read layer (isCuratedFontKey) rather than here, to
 * avoid this package depending on @repo/theme for one enum. baseFontSize is
 * optional: some pre-existing theme rows predate that field and carry no
 * value for it, so requiring it here would break their otherwise-valid
 * saves over a gap this fix isn't scoped to backfill. */
const layoutTokensSchema = z.object({
  radiusBase: z.string().trim().min(1).max(20),
  containerWidth: z.string().trim().min(1).max(20),
  fontSans: z.string().trim().min(1).max(200),
  fontMono: z.string().trim().min(1).max(200),
  // ADR-102. Optional for the same reason baseFontSize is: every Theme row
  // that exists predates the field, and requiring it would reject saves this
  // change was never scoped to touch. Absent resolves to fontSans at the read
  // layer, so an old row keeps rendering exactly as it does today.
  fontDisplay: z.string().trim().min(1).max(200).optional(),
  baseFontSize: z.string().trim().min(1).max(20).optional(),
});

export const saveThemeSchema = z.object({
  themeKey: z.string().trim().min(1).max(100),
  brandColors: brandColorsSchema,
  lightSurface: surfacePaletteSchema,
  darkSurface: surfacePaletteSchema,
  darkBrandOverrides: brandColorsSchema.partial().optional(),
  layoutTokens: layoutTokensSchema,
});
export type SaveThemeSchemaInput = z.infer<typeof saveThemeSchema>;

/**
 * "Save as preset" (changes-46): the editor's current tokens under a new
 * name. The same token schemas as a save, so a preset cannot hold a palette a
 * save would refuse; the key is derived by the service, never typed.
 */
export const saveThemePresetSchema = saveThemeSchema.omit({ themeKey: true }).extend({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
});
export type SaveThemePresetInput = z.infer<typeof saveThemePresetSchema>;

export const themePresetKeySchema = z.string().trim().min(1).max(50);

// ─── Users listing filters & admin search ────────────────────

export const userTypeFilterSchema = z.enum(["LEARNER", "STAFF"]);
export const userStatusFilterSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "PENDING_VERIFICATION",
]);

export const adminSearchSchema = z.object({
  query: z.string().trim().min(1).max(100),
});
export type AdminSearchInput = z.infer<typeof adminSearchSchema>;
