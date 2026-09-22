// @repo/email — transport, sealed credentials, and (from F3) rendering.
//
// A domain package that owns its own tables, the way @repo/settings and
// @repo/theme own theirs. It exists as a package rather than living in
// @repo/core because BOTH layers send — auth the reset and verification mail,
// core the admin notice and the newsletter — and a package they both need
// cannot live in either. Email in core would force auth → core, dragging rbac,
// settings, theme, i18n and blocks onto the session path (ADR-078 #1).
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
  sendgridDriver,
  sendgridMailBody,
  smtpDriver,
  smtpTransportOptions,
  type EmailTransportDriver,
  type SendgridConfig,
  type SentEmail,
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

export {
  DEFAULT_EMAIL_LOCALE,
  emailTemplateKeys,
  loadEmailRenderContext,
  sendTemplatedEmail,
  verifyTransport,
  SANDBOX_REASON,
  type DeliveryResult,
  type DeliveryStatus,
  type EmailRenderContext,
  type SendTemplatedEmailInput,
} from "./send.ts";
