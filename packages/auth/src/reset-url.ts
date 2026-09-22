// Where a password-reset link points (ADR-079 #2).
//
// Its own module, with no imports, because the rule it encodes is the one
// worth testing in isolation: the link is chosen by WHO THE USER IS, never by
// which screen asked. A learner who types their address into the staff screen
// still receives a public link, and the public surface goes on advertising no
// administrator entry point at all (ADR-052).
export interface ResetLinkUser {
  userType?: string | null;
  locale?: string | null;
}

export interface ResetLinkOrigins {
  site: string;
  /**
   * `NEXT_PUBLIC_ADMIN_URL`, which by convention ALREADY ends in `/admin`
   * (see `.env.example`) — but falls back to the bare site origin when it is
   * unset. `adminPortalBase` normalises both.
   */
  admin: string;
  /** The unprefixed locale (Module 06 routing). */
  defaultLocale?: string;
}

/**
 * The admin portal's base, with exactly one `/admin` segment.
 *
 * Both inputs are real and they differ: `NEXT_PUBLIC_ADMIN_URL` is documented
 * as `http://localhost:3000/admin`, while the fallback when it is unset is the
 * bare site origin. Appending `/admin` unconditionally produced
 * `/admin/admin/reset-password`; not appending it would send staff to the
 * LEARNER screen whenever the variable is absent — the worse of the two, since
 * the public surface names no portal (ADR-052).
 */
export function adminPortalBase(adminUrl: string): string {
  const trimmed = adminUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/admin") ? trimmed : `${trimmed}/admin`;
}

/**
 * Where the staff credential screens are SERVED (changes-49, ADR-146):
 * `/keystone`, on the admin portal's origin. The files still live under
 * `/admin/*`, but the proxy answers those addresses with a 404 — only the
 * rewrite reaches them — so a link has to name the public address.
 */
export function staffAuthBase(adminUrl: string): string {
  return `${adminPortalBase(adminUrl).replace(/\/admin$/, "")}/keystone`;
}

export function resetPasswordPath(user: ResetLinkUser, token: string, origins: ResetLinkOrigins) {
  const query = `?token=${encodeURIComponent(token)}`;
  if (user.userType === "STAFF") {
    return `${staffAuthBase(origins.admin)}/reset-password${query}`;
  }
  const defaultLocale = origins.defaultLocale ?? "en";
  // Every locale but the default carries its segment, so the link lands in
  // the reader's language.
  const prefix = user.locale && user.locale !== defaultLocale ? `/${user.locale}` : "";
  return `${origins.site}${prefix}/reset-password${query}`;
}
