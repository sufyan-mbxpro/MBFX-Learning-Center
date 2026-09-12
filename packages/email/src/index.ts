// @repo/email — transport, sealed credentials, and (from F3) rendering.
//
// A domain package that owns its own tables, the way @repo/settings and
// @repo/theme own theirs. It exists as a package rather than living in
// @repo/core because core already imports @repo/auth, and auth is what has to
// send email: the other direction would be a cycle (ADR-078 #1).
export {
  EMAIL_SECRET_KEY_ENV,
  EmailSecretInvalidError,
  EmailSecretKeyMissingError,
  generateEmailSecretKey,
  hasEmailSecretKey,
  openSecret,
  sealSecret,
} from "./secret.ts";

export {
  TRANSPORT_ID,
  loadTransportDriver,
  logDriver,
  smtpDriver,
  smtpTransportOptions,
  type EmailTransportDriver,
  type OutgoingEmail,
  type SmtpConfig,
  type SmtpSecurity,
} from "./transport.ts";

export { sanitizeEmailHtml, sanitizeEmailHtmlWith } from "./sanitize.ts";
export {
  editorialStyle,
  inlineEditorialStyles,
  renderEmailShell,
  type EmailPalette,
  type EmailShellInput,
} from "./layout.ts";
export {
  EmailRenderError,
  htmlToText,
  missingVariables,
  renderEmail,
  type EmailShellOptions,
  type RenderEmailInput,
  type RenderedEmail,
} from "./render.ts";
