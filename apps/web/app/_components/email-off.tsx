// Shields an email address from Cloudflare's Email Address Obfuscation.
//
// That feature rewrites every address in the HTML into `[email protected]`
// plus a `/cdn-cgi/l/email-protection` href, and injects a decoder script to
// undo it in the browser. Our CSP (`'strict-dynamic'` + nonce) blocks that
// script, as it should, so the reader is left with the placeholder — which is
// what the footer and `/support` showed on 2026-10-02. Loosening the CSP is
// not an option (host allowlisting is ignored under `'strict-dynamic'`), and
// the switch lives in a dashboard the app cannot reach, so the page opts out
// itself: Cloudflare leaves anything between `<!--email_off-->` and
// `<!--/email_off-->` untouched.
//
// React cannot render an HTML comment, so each marker rides in an empty,
// hidden span's inner HTML. The rewriter reads the response as a stream, so
// the markers only need to bracket the address in DOCUMENT ORDER, not share a
// parent. The strings are constants — nothing user-supplied reaches the HTML.
import type { ReactNode } from "react";

export function EmailOff({ children }: { children: ReactNode }) {
  return (
    <>
      <span hidden dangerouslySetInnerHTML={{ __html: "<!--email_off-->" }} />
      {children}
      <span hidden dangerouslySetInnerHTML={{ __html: "<!--/email_off-->" }} />
    </>
  );
}
