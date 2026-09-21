// The legal documents (changes-33, ADR-110).
//
// Three of them: Terms, Privacy, Agreement. The SET is code — a legal
// document is not something an editor adds, it is something the company is
// required to publish — and the FILE behind each one is data, chosen in
// admin. That is ADR-042's split again, after email templates (ADR-078),
// the tools registry (ADR-086) and the AI features (ADR-097).
//
// Four things read this registry and none of them may re-type the list: the
// footer's link row, `/legal/[doc]`, the `/sitemap` page, and the settings
// seed. A fourth document is an entry here, a setting key, and a catalog
// string — and `legal.test.ts` names whichever half you forget.
import type { SettingKey } from "./settings.ts";

/** The URL segment. `/legal/terms`, `/legal/privacy`, `/legal/agreement`. */
export const LEGAL_DOCUMENT_KEYS = ["terms", "privacy", "agreement"] as const;

export type LegalDocumentKey = (typeof LEGAL_DOCUMENT_KEYS)[number];

export function isLegalDocumentKey(value: string): value is LegalDocumentKey {
  return (LEGAL_DOCUMENT_KEYS as readonly string[]).includes(value);
}

/** Which setting holds each document's stored path. */
export const LEGAL_DOCUMENT_SETTING = {
  terms: "legal.termsDocument",
  privacy: "legal.privacyDocument",
  agreement: "legal.agreementDocument",
} as const satisfies Record<LegalDocumentKey, SettingKey>;

/**
 * The prefix that means "this lives in the storage driver". Anything else is
 * a static file the app serves itself.
 *
 * `/legal/[doc]` branches on it because the two need different handling:
 * stored bytes come back through `readStoredFile` and are sent INLINE, while
 * a static path is simply redirected to — Next serves `public/` with no
 * `Content-Disposition` at all, which is already inline.
 */
export const STORED_UPLOAD_PREFIX = "/uploads/";

/**
 * The public path. Ours, not the file's — see ADR-110. It stays the same when
 * an admin replaces the document, which is the whole point: a link in a
 * message sent last year still resolves, and the page source never publishes
 * a storage key.
 */
export function legalDocumentPath(key: LegalDocumentKey): string {
  return `/legal/${key}`;
}

/**
 * The only media type a legal document may be. Narrow on purpose: `/legal/…`
 * is the one route in the repository that serves an uploaded file INLINE
 * rather than as an attachment (ADR-034 §1 is otherwise unchanged), and that
 * exception is only defensible for a format browsers render in a sandboxed
 * viewer of their own. An admin who points one of these at a `.docx` would
 * get a download whatever we sent, so the route refuses it rather than
 * pretending.
 */
export const LEGAL_DOCUMENT_MIME = "application/pdf";
