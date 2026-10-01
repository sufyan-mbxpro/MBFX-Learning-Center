// The RFC 8058 header pair (ADR-080 #4, changes-54 §9.3).
//
// A message has TWO unsubscribe addresses and they are not interchangeable:
//
//   - the footer LINK a person clicks, which must be a page, because a GET
//     never mutates (mail scanners fetch every link in a message);
//   - the `List-Unsubscribe` URL a mail CLIENT posts to from its own button,
//     which must be the POST handler — a page route has no POST to answer.
//
// The newsletter welcome used one URL for both, so every client's one-click
// POST landed on `/newsletter/unsubscribe`, a page, and unsubscribed nobody.
// `oneClickUrl` is the handler; it falls back to `url` only for a caller whose
// footer link already IS a POST endpoint.

export interface UnsubscribeLinks {
  /** The footer link: a page whose island POSTs. */
  url: string;
  /** The visible word, from the caller's catalog (code-style #2). */
  label: string;
  /** The RFC 8058 POST handler the header points at. */
  oneClickUrl?: string | undefined;
}

export function listUnsubscribeHeaders(
  unsubscribe: UnsubscribeLinks | undefined,
): Record<string, string> | undefined {
  if (!unsubscribe) return undefined;
  return {
    "List-Unsubscribe": `<${unsubscribe.oneClickUrl ?? unsubscribe.url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
