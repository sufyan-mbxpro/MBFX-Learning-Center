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
   * `NEXT_PUBLIC_ADMIN_URL`, which by convention ends in the portal prefix
   * `/keystone` (see `.env.example`; an older value ends in `/admin`) — but
   * falls back to the bare site origin when it is unset. `adminPortalBase`
   * normalises all three.
   */
  admin: string;
  /** The unprefixed locale (Module 06 routing). */
  defaultLocale?: string;
}

/**
 * The staff portal's base, with exactly one `/keystone` segment (ADR-151).
 *
 * Three inputs are real and they differ: `NEXT_PUBLIC_ADMIN_URL` is
 * documented as `http://localhost:3000/keystone`, an `.env` written before
 * ADR-151 still says `…/admin`, and the fallback when it is unset is the bare
 * site origin. Appending the prefix unconditionally once produced
 * `/admin/admin/reset-password`; not appending it would send staff to the
 * LEARNER screen whenever the variable is absent — the worse of the two, since
 * the public surface names no portal (ADR-052). A trailing `/admin` is
 * replaced, because that prefix now answers 404.
 */
export function adminPortalBase(adminUrl: string): string {
  const trimmed = adminUrl.replace(/\/+$/, "").replace(/\/admin$/, "");
  return trimmed.endsWith("/keystone") ? trimmed : `${trimmed}/keystone`;
}

/**
 * Where the staff credential screens are served: `/keystone`, on the admin
 * portal's origin (ADR-146). The portal's own prefix since ADR-151, so this
 * is the portal base itself.
 */
export function staffAuthBase(adminUrl: string): string {
  return adminPortalBase(adminUrl);
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
