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
  admin: string;
  /** The unprefixed locale (Module 06 routing). */
  defaultLocale?: string;
}

export function resetPasswordPath(user: ResetLinkUser, token: string, origins: ResetLinkOrigins) {
  const query = `?token=${encodeURIComponent(token)}`;
  if (user.userType === "STAFF") return `${origins.admin}/admin/reset-password${query}`;
  const defaultLocale = origins.defaultLocale ?? "en";
  // Every locale but the default carries its segment, so the link lands in
  // the reader's language.
  const prefix = user.locale && user.locale !== defaultLocale ? `/${user.locale}` : "";
  return `${origins.site}${prefix}/reset-password${query}`;
}
