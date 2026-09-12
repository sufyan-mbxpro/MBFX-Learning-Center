// Rendering a template into one message (ADR-078 #6, #7).
//
// The order is the security property: sanitise, assemble, THEN substitute,
// with every value escaped on the way in. A value can therefore never
// introduce markup — and a URL-typed variable is parsed before it is allowed
// anywhere near an `href`, because the sanitiser saw `{{reset.url}}` as a
// harmless relative path.
import {
  EMAIL_TEMPLATES,
  findTemplateVariables,
  isUrlEmailVariable,
  replaceTemplateVariables,
  type EmailBodyMode,
  type EmailTemplateKey,
} from "@repo/contracts";
import { inlineEditorialStyles, renderEmailShell, type EmailPalette } from "./layout.ts";
import { sanitizeEmailHtml } from "./sanitize.ts";

export class EmailRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailRenderError";
  }
}

export interface EmailShellOptions {
  siteName: string;
  logoUrl?: string | undefined;
  footerText?: string | undefined;
  postalAddress?: string | undefined;
  /** Both halves together: a package may not invent the label (code-style #2). */
  unsubscribe?: { url: string; label: string } | undefined;
}

export interface RenderEmailInput {
  key: EmailTemplateKey;
  mode: EmailBodyMode;
  subject: string;
  preheader?: string | undefined;
  bodyHtml: string;
  variables: Readonly<Record<string, string>>;
  palette: EmailPalette;
  shell: EmailShellOptions;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A header takes one line. A newline in a subject is how a Bcc gets added. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function resolveValue(
  name: string,
  variables: Readonly<Record<string, string>>,
  key: EmailTemplateKey,
): string {
  const value = variables[name];
  if (value === undefined) {
    // Rendering `{{reset.url}}` into somebody's inbox is worse than failing.
    throw new EmailRenderError(`Template ${key} used {{${name}}}, which was not provided.`);
  }
  if (isUrlEmailVariable(name)) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new EmailRenderError(`Variable {{${name}}} is not a URL.`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      // The sanitiser could not catch this: it saw a relative href.
      throw new EmailRenderError(`Variable {{${name}}} must be http(s), not ${parsed.protocol}`);
    }
  }
  return value;
}

/**
 * HTML → a plain-text alternative. Deliberately small and dependency-free:
 * the goal is a readable fallback with its links visible, not a converter.
 */
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      // A link's destination is invisible in plain text unless it is spelled out.
      .replace(
        /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
        (_match, href: string, label) =>
          `${String(label)
            .replace(/<[^>]+>/g, "")
            .trim()} (${href})`,
      )
      .replace(/<(br|\/p|\/div|\/tr|\/h[1-4]|\/li)\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim()
  );
}

export function renderEmail(input: RenderEmailInput): RenderedEmail {
  const definition = EMAIL_TEMPLATES[input.key];

  // A required variable missing from the BODY is a save-time failure
  // (@repo/contracts). Missing from the CALLER is this one.
  for (const name of definition.required) {
    if (input.variables[name] === undefined) {
      throw new EmailRenderError(`Template ${input.key} requires {{${name}}}.`);
    }
  }

  const sanitizedBody = sanitizeEmailHtml(input.bodyHtml, input.mode);

  const assembled =
    input.mode === "RICH"
      ? renderEmailShell({
          bodyHtml: inlineEditorialStyles(sanitizedBody, input.palette),
          palette: input.palette,
          preheader: input.preheader,
          siteName: input.shell.siteName,
          logoUrl: input.shell.logoUrl,
          footerText: input.shell.footerText,
          postalAddress: input.shell.postalAddress,
          unsubscribe: input.shell.unsubscribe,
        })
      : // A hand-built document is the designer's whole document. Wrapping it
        // in our shell would put two <body> elements in one message.
        sanitizedBody;

  const html = replaceTemplateVariables(assembled, (name) =>
    escapeHtml(resolveValue(name, input.variables, input.key)),
  );

  const subject = singleLine(
    replaceTemplateVariables(input.subject, (name) =>
      singleLine(resolveValue(name, input.variables, input.key)),
    ),
  );

  return { subject, html, text: htmlToText(html) };
}

/** Which variables a body still needs — for the admin's preview and tests. */
export function missingVariables(
  text: string,
  variables: Readonly<Record<string, string>>,
): string[] {
  return findTemplateVariables(text).filter((name) => variables[name] === undefined);
}
